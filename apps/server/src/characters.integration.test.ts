import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import Fastify from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { io as createClient, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { armorItems, prompts, weaponItems } from '@type-arena/game-data';
import * as schema from './database/schema.js';
import type { BattleSnapshot } from './battles/battle-manager.js';

// Explicitly opt in with a disposable PostgreSQL schema; never touch the application's tables.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const mockState = vi.hoisted(() => ({ database: null as ReturnType<typeof drizzle<typeof import('./database/schema.js')>> | null }));
vi.mock('./database/client.js', () => ({ get db() { return mockState.database; }, pool: null }));
vi.mock('./auth/bearer.js', () => ({
  authenticateBearer: async (header?: string) => header?.startsWith('Bearer test-')
    ? { ok: true, identity: { uid: header.slice('Bearer '.length) } }
    : { ok: false, status: 401, code: 'missing-token' },
}));

import profileRoutes from './routes/profile.js';
import { attachRealtime } from './realtime.js';
import gameRoutes from './routes/game.js';
import { persistBattleOutcome } from './battles/result-service.js';
import type { BattleOutcome } from './battles/battle-manager.js';

const waitFor = <T>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timed out waiting for ${event}`)); }, timeoutMs);
  const handler = (data: T) => { clearTimeout(timer); resolve(data); };
  socket.once(event, handler);
});
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(!testDatabaseUrl)('character purchase and online integration (PostgreSQL)', () => {
  const schemaName = `character_test_${randomUUID().replace(/-/g, '')}`;
  const admin = new Pool({ connectionString: testDatabaseUrl });
  let pool: Pool;
  const app = Fastify();
  const server = createServer();
  const realtime = attachRealtime(server);
  const clients: Socket[] = [];
  let port: number;
  const request = (uid: string, method: 'GET' | 'POST', payload?: object) => app.inject({
    method, url: '/api/me/characters', headers: { authorization: `Bearer ${uid}` }, ...(payload ? { payload } : {}),
  });

  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    pool = new Pool({ connectionString: testDatabaseUrl, max: 5, options: `-c search_path=${schemaName}` });
    await pool.query(`CREATE TABLE users (
      id text PRIMARY KEY, firebase_uid text NOT NULL UNIQUE, display_name text NOT NULL,
      photo_url text, rating integer NOT NULL DEFAULT 1200, coins integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await pool.query(`CREATE TABLE coin_ledger (
      id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), amount integer NOT NULL,
      reason text NOT NULL, reference_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, reason, reference_id)
    )`);
    await pool.query('CREATE TABLE items (id text PRIMARY KEY, code text NOT NULL UNIQUE, type text NOT NULL)');
    await pool.query(`CREATE TABLE inventory (
      user_id text NOT NULL REFERENCES users(id), item_id text NOT NULL REFERENCES items(id),
      quantity integer NOT NULL DEFAULT 1, acquired_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, item_id)
    )`);
    await pool.query(`CREATE TABLE equipment (
      user_id text NOT NULL REFERENCES users(id), slot text NOT NULL, item_id text NOT NULL REFERENCES items(id),
      equipped_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, slot)
    )`);
    await pool.query(`CREATE TABLE matches (
      id text PRIMARY KEY, mode text NOT NULL DEFAULT 'ranked', player_one_id text NOT NULL REFERENCES users(id), player_two_id text NOT NULL REFERENCES users(id), winner_id text REFERENCES users(id), player_one_result text NOT NULL DEFAULT 'win',
      player_one_wpm integer NOT NULL DEFAULT 0, player_two_wpm integer NOT NULL DEFAULT 0, player_one_accuracy integer NOT NULL DEFAULT 100, player_two_accuracy integer NOT NULL DEFAULT 100,
      player_one_characters integer NOT NULL DEFAULT 0, player_two_characters integer NOT NULL DEFAULT 0, player_one_mistakes integer NOT NULL DEFAULT 0, player_two_mistakes integer NOT NULL DEFAULT 0,
      player_one_max_combo integer NOT NULL DEFAULT 0, player_two_max_combo integer NOT NULL DEFAULT 0, player_one_rating_change integer NOT NULL DEFAULT 0, player_two_rating_change integer NOT NULL DEFAULT 0,
      player_one_coin_reward integer NOT NULL DEFAULT 0, player_two_coin_reward integer NOT NULL DEFAULT 0, completed_at timestamptz NOT NULL DEFAULT now()
    )`);
    await pool.query("INSERT INTO users (id, firebase_uid, display_name, rating) VALUES ('old', 'test-old', 'Old', 1220), ('old-opponent', 'test-old-opponent', 'Old opponent', 1180)");
    await pool.query("INSERT INTO matches (id, mode, player_one_id, player_two_id) VALUES ('old-ranked-1', 'ranked', 'old', 'old-opponent'), ('old-ranked-2', 'ranked', 'old', 'old-opponent'), ('old-private', 'private', 'old', 'old-opponent')");
    await pool.query(await readFile(new URL('../drizzle/0004_bizarre_hardball.sql', import.meta.url), 'utf8'));
    await pool.query(await readFile(new URL('../drizzle/0005_nostalgic_veda.sql', import.meta.url), 'utf8'));
    await pool.query(await readFile(new URL('../drizzle/0006_sour_captain_marvel.sql', import.meta.url), 'utf8'));
    await pool.query("INSERT INTO users (id, firebase_uid, display_name, coins) VALUES ('one', 'test-one', 'One', 6000), ('two', 'test-two', 'Two', 3000), ('poor', 'test-poor', 'Poor', 2999)");
    await pool.query('INSERT INTO items (id, code, type) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)', [
      'test-weapon', weaponItems[1].code, 'weapon', 'test-armor', armorItems[1].code, 'armor',
      'starter-weapon', weaponItems[0].code, 'weapon', 'starter-armor', armorItems[0].code, 'armor',
    ]);
    await pool.query("INSERT INTO equipment (user_id, slot, item_id) VALUES ('one', 'weapon', 'test-weapon'), ('two', 'armor', 'test-armor')");
    mockState.database = drizzle(pool, { schema });
    await app.register(profileRoutes);
    await app.register(gameRoutes);
    await app.ready();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  it('starts a new account at 500 rating with the balanced character and grants its welcome coins only once', async () => {
    const bootstrap = () => app.inject({ method: 'POST', url: '/api/auth/session', headers: { authorization: 'Bearer test-new' } });
    const first = await bootstrap();
    expect(first.statusCode).toBe(200);
    expect(first.json().user).toMatchObject({ rating: 500, coins: 100 });
    const next = await bootstrap();
    expect(next.statusCode).toBe(200);
    expect(next.json().user).toMatchObject({ rating: 500, coins: 100 });
    expect((await request('test-new', 'GET')).json()).toMatchObject({ coins: 100, selected: 'balanced', unlocked: ['balanced'] });
  });

  afterAll(async () => {
    clients.forEach((client) => client.disconnect());
    await realtime.shutdownGracefully();
    await app.close();
    mockState.database = null;
    await pool?.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await admin.end();
  });

  it('charges 3000 once even for concurrent requests, rejects locked selections and persists ownership', async () => {
    expect((await request('test-one', 'GET')).json()).toMatchObject({ coins: 6000, selected: 'balanced', unlocked: ['balanced'] });
    expect((await request('test-one', 'POST', { character: 'long', action: 'select' })).json()).toMatchObject({ error: 'character-locked' });
    expect((await request('test-poor', 'POST', { character: 'word', action: 'unlock', expectedPrice: 3000 })).json()).toMatchObject({ error: 'insufficient-coins' });
    const unlocks = await Promise.all([request('test-one', 'POST', { character: 'long', action: 'unlock', expectedPrice: 3000 }), request('test-one', 'POST', { character: 'long', action: 'unlock', expectedPrice: 3000 })]);
    expect(unlocks.map((response) => response.statusCode)).toEqual([200, 200]);
    expect((await request('test-one', 'POST', { character: 'long', action: 'select' })).statusCode).toBe(200);
    expect((await request('test-one', 'GET')).json()).toMatchObject({ coins: 3000, selected: 'long', unlocked: ['balanced', 'long'] });
    const ledger = await pool.query("SELECT amount, reference_id FROM coin_ledger WHERE user_id = 'one'");
    expect(ledger.rows).toEqual([{ amount: -3000, reference_id: 'long' }]);
    expect((await request('test-two', 'POST', { character: 'word', action: 'unlock', expectedPrice: 3000 })).statusCode).toBe(200);
    expect((await request('test-two', 'POST', { character: 'word', action: 'select' })).statusCode).toBe(200);
    expect((await request('test-two', 'GET')).json()).toMatchObject({ coins: 0, selected: 'word', unlocked: ['balanced', 'word'] });
  });

  it('allows only one of two simultaneous character purchases when the wallet has 3000 coins', async () => {
    await pool.query("INSERT INTO users (id, firebase_uid, display_name, coins) VALUES ('race', 'test-race', 'Race', 3000)");
    const results = await Promise.all([
      request('test-race', 'POST', { character: 'long', action: 'unlock', expectedPrice: 3000 }),
      request('test-race', 'POST', { character: 'word', action: 'unlock', expectedPrice: 3000 }),
    ]);
    expect(results.map((response) => response.statusCode).sort()).toEqual([200, 400]);
    expect(results.find((response) => response.statusCode === 400)?.json()).toMatchObject({ error: 'insufficient-coins' });
    const roster = (await request('test-race', 'GET')).json();
    expect(roster).toMatchObject({ coins: 0, selected: 'balanced' });
    expect(roster.unlocked).toHaveLength(2);
    const ledger = await pool.query("SELECT amount FROM coin_ledger WHERE user_id = 'race' AND reason = 'character-unlock'");
    expect(ledger.rows).toEqual([{ amount: -3000 }]);
  });

  it('rejects stale clients and old prices without charging coins', async () => {
    await pool.query("INSERT INTO users (id, firebase_uid, display_name, coins) VALUES ('stale', 'test-stale', 'Stale', 3000)");
    expect((await request('test-stale', 'POST', { character: 'long', action: 'unlock' })).json()).toMatchObject({ error: 'price-changed', price: 3000 });
    expect((await request('test-stale', 'POST', { character: 'long', action: 'unlock', expectedPrice: 500 })).json()).toMatchObject({ error: 'price-changed', price: 3000 });
    expect((await request('test-stale', 'GET')).json()).toMatchObject({ coins: 3000, unlocked: ['balanced'] });
  });

  it('keeps previously unlocked characters when the price changes', async () => {
    await pool.query("INSERT INTO users (id, firebase_uid, display_name, coins) VALUES ('legacy-owner', 'test-legacy-owner', 'Legacy', 0)");
    await pool.query("INSERT INTO coin_ledger (id, user_id, amount, reason, reference_id) VALUES ('legacy-unlock', 'legacy-owner', -500, 'character-unlock', 'long')");
    expect((await request('test-legacy-owner', 'GET')).json()).toMatchObject({ coins: 0, unlocked: ['balanced', 'long'] });
    expect((await request('test-legacy-owner', 'POST', { character: 'long', action: 'select' })).statusCode).toBe(200);
    expect((await request('test-legacy-owner', 'GET')).json()).toMatchObject({ coins: 0, selected: 'long' });
  });

  it('saves online magic upgrades and spends a point only once under concurrency', async () => {
    await pool.query("UPDATE users SET growth_points = 1 WHERE firebase_uid = 'test-new'");
    const growthRequest = (method: 'GET' | 'POST', payload?: object) => app.inject({ method, url: '/api/me/growth', headers: { authorization: 'Bearer test-new' }, ...(payload ? { payload } : {}) });
    expect((await growthRequest('GET')).json()).toMatchObject({ points: 1, magicAttack: 0, magicDefense: 0 });
    const attempts = await Promise.all([growthRequest('POST', { stat: 'magicAttack' }), growthRequest('POST', { stat: 'magicDefense' })]);
    expect(attempts.map((response) => response.statusCode).sort()).toEqual([200, 400]);
    const saved = (await growthRequest('GET')).json();
    expect(saved.points).toBe(0);
    expect(saved.magicAttack + saved.magicDefense).toBe(1);
    expect((await growthRequest('POST', { stat: 'magicAttack' })).json()).toMatchObject({ error: 'insufficient-points' });
    expect((await growthRequest('POST', { stat: 'untrusted' })).statusCode).toBe(400);
  });

  it('migrates old ratings, counts five ranked results, and displays real leaderboard positions', async () => {
    const legacy = await pool.query("SELECT rating, placement_matches FROM users WHERE id = 'old'");
    expect(legacy.rows[0]).toEqual({ rating: 520, placement_matches: 2 });
    await pool.query("INSERT INTO users (id, firebase_uid, display_name) VALUES ('rank-one', 'test-rank-one', 'Rank one'), ('rank-two', 'test-rank-two', 'Rank two')");
    const rankRequest = (uid: string) => app.inject({ method: 'GET', url: '/api/me/rank', headers: { authorization: `Bearer ${uid}` } });
    expect((await rankRequest('test-rank-one')).json()).toMatchObject({ rating: 500, placementMatches: 0, title: '未認定', position: null });
    const outcome = (id: string, winnerUid = 'test-rank-one'): BattleOutcome => ({
      matchId: id, winnerUid, loserUid: winnerUid === 'test-rank-one' ? 'test-rank-two' : 'test-rank-one', reason: 'knockout', finishedAt: Date.now(),
      players: [
        { firebaseUid: 'test-rank-one', userId: 'rank-one', rating: 500, wpm: 80, accuracy: 100, characters: 80, mistakes: 0, maxCombo: 12 },
        { firebaseUid: 'test-rank-two', userId: 'rank-two', rating: 500, wpm: 70, accuracy: 95, characters: 70, mistakes: 1, maxCombo: 11 },
      ],
    });
    for (let i = 0; i < 4; i += 1) await persistBattleOutcome(mockState.database!, outcome(`ranked-${i}`, i === 3 ? 'test-rank-two' : 'test-rank-one'));
    const growthBefore = await app.inject({ method: 'GET', url: '/api/me/growth', headers: { authorization: 'Bearer test-rank-one' } });
    expect(growthBefore.json()).toMatchObject({ points: 10, magicAttack: 0, magicDefense: 0 });
    const magicUpgrade = await app.inject({ method: 'POST', url: '/api/me/growth', headers: { authorization: 'Bearer test-rank-one' }, payload: { stat: 'magicAttack' } });
    expect(magicUpgrade.json()).toMatchObject({ points: 9, magicAttack: 1 });
    const four = (await rankRequest('test-rank-one')).json();
    expect(four).toMatchObject({ placementMatches: 4, title: '未認定', position: null });
    expect(four.rating).not.toBe(500);
    expect((await app.inject({ method: 'GET', url: '/api/leaderboard' })).json().ranking).toEqual([]);
    await persistBattleOutcome(mockState.database!, outcome('private-placement'), 'private');
    expect((await rankRequest('test-rank-one')).json()).toMatchObject({ rating: four.rating, placementMatches: 4 });
    await Promise.all([persistBattleOutcome(mockState.database!, outcome('ranked-4')), persistBattleOutcome(mockState.database!, outcome('ranked-4'))]);
    expect((await rankRequest('test-rank-one')).json()).toMatchObject({ placementMatches: 5, title: 'シルバー', position: 1 });
    expect((await app.inject({ method: 'GET', url: '/api/me/growth', headers: { authorization: 'Bearer test-rank-one' } })).json()).toMatchObject({ points: 12, magicAttack: 1 });
    const leaderboard = (await app.inject({ method: 'GET', url: '/api/leaderboard' })).json().ranking;
    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]).toMatchObject({ displayName: 'Rank one', rank: 1, title: 'シルバー' });
    await pool.query("UPDATE users SET rating = 1750, created_at = '2020-01-01 00:00:00.123456+00' WHERE id IN ('rank-one', 'rank-two')");
    expect((await rankRequest('test-rank-one')).json()).toMatchObject({ title: 'タイプキング #1', position: 1 });
    expect((await rankRequest('test-rank-two')).json()).toMatchObject({ title: 'タイプキング #2', position: 2 });
    expect((await app.inject({ method: 'GET', url: '/api/leaderboard' })).json().ranking.map((player: { title: string }) => player.title)).toEqual(['タイプキング #1', 'タイプキング #2']);
    expect((await app.inject({ method: 'GET', url: '/api/leaderboard?limit=1&offset=1' })).json()).toMatchObject({ total: 2, offset: 1, ranking: [{ rank: 2, title: 'タイプキング #2' }] });
  });

  it('uses the saved characters in private matches too', async () => {
    await pool.query("INSERT INTO users (id, firebase_uid, display_name, coins) VALUES ('private-one', 'test-private-one', 'Private one', 3000), ('private-two', 'test-private-two', 'Private two', 3000)");
    for (const [uid, character] of [['test-private-one', 'mage-long'], ['test-private-two', 'mage-word']]) {
      expect((await request(uid, 'POST', { character, action: 'unlock', expectedPrice: 3000 })).statusCode).toBe(200);
      expect((await request(uid, 'POST', { character, action: 'select' })).statusCode).toBe(200);
    }
    await pool.query("UPDATE users SET growth_points = 1 WHERE id = 'private-one'");
    const upgraded = await app.inject({ method: 'POST', url: '/api/me/growth', headers: { authorization: 'Bearer test-private-one' }, payload: { stat: 'magicAttack' } });
    expect(upgraded.json()).toMatchObject({ points: 0, magicAttack: 1 });
    const one = createClient(`http://127.0.0.1:${port}`, { auth: { token: 'test-private-one' }, transports: ['websocket'], reconnection: false });
    const two = createClient(`http://127.0.0.1:${port}`, { auth: { token: 'test-private-two' }, transports: ['websocket'], reconnection: false });
    clients.push(one, two);
    await Promise.all([waitFor(one, 'connect'), waitFor(two, 'connect')]);
    const created = waitFor<{ code: string }>(one, 'private:created');
    one.emit('private:create');
    const { code } = await created;
    const oneStart = waitFor<BattleSnapshot & { mode: string }>(one, 'battle:starting');
    const twoStart = waitFor<BattleSnapshot & { mode: string }>(two, 'battle:starting');
    two.emit('private:join', { code });
    const [longView, wordView] = await Promise.all([oneStart, twoStart]);
    expect(longView).toMatchObject({ mode: 'private', character: 'mage-long', prompt: { category: '長文' }, opponent: { character: 'mage-word' } });
    expect(wordView).toMatchObject({ mode: 'private', character: 'mage-word', prompt: { category: '単語' }, opponent: { character: 'mage-long' } });
    expect(longView).toMatchObject({ ownMp: 30, growth: { magicAttack: 1 } });
    await pause(Math.max(0, longView.startsAt - Date.now()) + 30);
    const hit = waitFor<{ damage: number; type: string }>(one, 'battle:damage');
    const updated = waitFor<BattleSnapshot>(one, 'battle:update');
    one.emit('battle:spell', { matchId: longView.matchId });
    expect(await hit).toMatchObject({ type: 'magic', damage: expect.any(Number) });
    expect(await updated).toMatchObject({ ownMp: 20 });
    const cooldown = waitFor<{ code: string }>(one, 'battle:spell-error');
    one.emit('battle:spell', { matchId: longView.matchId });
    expect(await cooldown).toMatchObject({ code: 'spell-cooldown' });
  }, 10000);

  it('uses each purchased character and applies its damage in an actual online match', async () => {
    const one = createClient(`http://127.0.0.1:${port}`, { auth: { token: 'test-one' }, transports: ['websocket'], reconnection: false });
    const two = createClient(`http://127.0.0.1:${port}`, { auth: { token: 'test-two' }, transports: ['websocket'], reconnection: false });
    clients.push(one, two);
    await Promise.all([waitFor(one, 'connect'), waitFor(two, 'connect')]);
    const oneStart = waitFor<BattleSnapshot>(one, 'battle:starting');
    const twoStart = waitFor<BattleSnapshot>(two, 'battle:starting');
    one.emit('matchmaking:join');
    await waitFor(one, 'matchmaking:queued');
    two.emit('matchmaking:join');
    const [longView, wordView] = await Promise.all([oneStart, twoStart]);
    expect(longView).toMatchObject({ character: 'long', prompt: { category: '長文' }, opponent: { character: 'word' } });
    expect(wordView).toMatchObject({ character: 'word', prompt: { category: '単語' }, opponent: { character: 'long' } });
    await pause(Math.max(0, longView.startsAt - Date.now()) + 30);
    const longAnswer = prompts.find((prompt) => prompt.id === longView.prompt.id)!.romaji[0];
    const wordAnswer = prompts.find((prompt) => prompt.id === wordView.prompt.id)!.romaji[0];
    const incomplete = waitFor<{ code: string }>(one, 'battle:error');
    one.emit('battle:submit', { matchId: longView.matchId, promptId: longView.prompt.id });
    expect(await incomplete).toMatchObject({ code: 'incomplete-input' });
    const play = async (socket: Socket, view: BattleSnapshot, answer: string) => {
      for (const key of answer) {
        const state = waitFor<{ typed: string }>(socket, 'battle:input-state');
        socket.emit('battle:key', { matchId: view.matchId, promptId: view.prompt.id, key });
        await state;
        await pause(70);
      }
      const damage = waitFor<{ attacker: number; damage: number }>(socket, 'battle:damage');
      socket.emit('battle:submit', { matchId: view.matchId, promptId: view.prompt.id });
      return damage;
    };
    // Capture both attacks on the same socket to distinguish attacker IDs.
    const nextWordView = waitFor<BattleSnapshot>(two, 'battle:update');
    const wordDamage = await play(two, wordView, wordAnswer);
    let currentWordView = await nextWordView;
    const wordViewAfterLongAttack = waitFor<BattleSnapshot>(two, 'battle:update');
    const longDamage = await play(one, longView, longAnswer);
    currentWordView = await wordViewAfterLongAttack;
    expect(longDamage.damage).toBeGreaterThan(wordDamage.damage);
    expect(wordDamage.damage).toBeLessThan(18);
    expect(longDamage.damage).toBeGreaterThanOrEqual(32);
    const finished = waitFor<{ result: string; resultSaved: boolean }>(two, 'battle:finished', 20000);
    for (let i = 0; i < 11 && currentWordView.opponentHp > 0; i += 1) {
      const nextView = waitFor<BattleSnapshot>(two, 'battle:update');
      const answer = prompts.find((prompt) => prompt.id === currentWordView.prompt.id)!.romaji[0];
      await play(two, currentWordView, answer);
      currentWordView = await nextView;
    }
    expect(currentWordView.opponentHp).toBe(0);
    expect(await finished).toMatchObject({ result: 'win', resultSaved: true });
    const rank = await app.inject({ method: 'GET', url: '/api/me/rank', headers: { authorization: 'Bearer test-two' } });
    expect(rank.json()).toMatchObject({ placementMatches: 1, title: '未認定' });
    expect(rank.json().rating).toBeGreaterThan(500);
  }, 30000);
});
