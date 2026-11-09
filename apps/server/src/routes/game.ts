import { randomInt, randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { and, asc, desc, eq, gte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { equipmentItems } from '@type-arena/game-data';
import { authenticateBearer } from '../auth/bearer.js';
import { GACHA_COST, gachaCost, rollRarity, type GachaItemResult, type GachaResponse } from '../economy/gacha.js';
import { db } from '../database/client.js';
import { coinLedger, equipment, gachaPulls, gachaRequests, inventory, items, matches, users } from '../database/schema.js';

const listQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
const pullBodySchema = z.object({ count: z.union([z.literal(1), z.literal(10)]).default(1) }).strict();
const idempotencyKeySchema = z.string().uuid();
const equipBodySchema = z.object({ itemCode: z.string().min(1).max(100) }).strict();

type Database = NonNullable<typeof db>;
type UserSummary = Pick<typeof users.$inferSelect, 'id' | 'displayName' | 'photoUrl' | 'rating' | 'coins'>;
type UserResult =
  | { ok: true; user: UserSummary }
  | { ok: false; status: 401 | 404 | 503; error: string };

async function resolveUser(database: Database, authorization: string | undefined): Promise<UserResult> {
  const auth = await authenticateBearer(authorization);
  if (!auth.ok) return { ok: false, status: auth.status, error: auth.code };
  const [user] = await database.select({
    id: users.id,
    displayName: users.displayName,
    photoUrl: users.photoUrl,
    rating: users.rating,
    coins: users.coins,
  }).from(users).where(eq(users.firebaseUid, auth.identity.uid)).limit(1);
  if (!user) return { ok: false, status: 404, error: 'profile-not-found' };
  return { ok: true, user };
}

const gameRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/items', async () => ({ items: equipmentItems }));

  app.get('/api/leaderboard', async (request, reply) => {
    const database = db;
    if (!database) return reply.code(503).send({ error: 'database-not-configured' });
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-limit' });
    const ranking = await database.select({ id: users.id, displayName: users.displayName, photoUrl: users.photoUrl, rating: users.rating })
      .from(users).orderBy(desc(users.rating), asc(users.createdAt), asc(users.id)).limit(parsed.data.limit);
    return { ranking: ranking.map((player, index) => ({ rank: index + 1, ...player })) };
  });

  app.get('/api/me/inventory', async (request, reply) => {
    const database = db;
    if (!database) return reply.code(503).send({ error: 'database-not-configured' });
    const context = await resolveUser(database, request.headers.authorization);
    if (!context.ok) return reply.code(context.status).send({ error: context.error });
    const rows = await database.select({ code: items.code, quantity: inventory.quantity, acquiredAt: inventory.acquiredAt })
      .from(inventory).innerJoin(items, eq(items.id, inventory.itemId)).where(eq(inventory.userId, context.user.id))
      .orderBy(desc(inventory.acquiredAt), asc(items.code));
    const equippedRows = await database.select({ slot: equipment.slot, code: items.code })
      .from(equipment).innerJoin(items, eq(items.id, equipment.itemId)).where(eq(equipment.userId, context.user.id));
    const equipped = Object.fromEntries(equippedRows.map((row) => [row.slot, row.code]));
    const master = new Map(equipmentItems.map((item) => [item.code, item]));
    return {
      items: rows.map((row) => ({ ...master.get(row.code), code: row.code, quantity: row.quantity, acquiredAt: row.acquiredAt })),
      equipped: { armor: equipped.armor ?? null, weapon: equipped.weapon ?? null },
      coins: context.user.coins,
    };
  });

  app.post('/api/me/equipment', async (request, reply) => {
    const database = db;
    if (!database) return reply.code(503).send({ error: 'database-not-configured' });
    const context = await resolveUser(database, request.headers.authorization);
    if (!context.ok) return reply.code(context.status).send({ error: context.error });
    const parsed = equipBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-equipment' });
    const [owned] = await database.select({ id: items.id, code: items.code, type: items.type })
      .from(inventory).innerJoin(items, eq(items.id, inventory.itemId))
      .where(and(eq(inventory.userId, context.user.id), eq(items.code, parsed.data.itemCode), eq(items.enabled, true))).limit(1);
    if (!owned) return reply.code(404).send({ error: 'item-not-owned' });
    if (owned.type !== 'armor' && owned.type !== 'weapon') return reply.code(400).send({ error: 'unsupported-equipment-slot' });
    await database.insert(equipment).values({ userId: context.user.id, slot: owned.type, itemId: owned.id })
      .onConflictDoUpdate({ target: [equipment.userId, equipment.slot], set: { itemId: owned.id, equippedAt: new Date() } });
    return { equipped: { slot: owned.type, itemCode: owned.code } };
  });

  app.post('/api/gacha/pull', async (request, reply) => {
    const database = db;
    if (!database) return reply.code(503).send({ error: 'database-not-configured' });
    const context = await resolveUser(database, request.headers.authorization);
    if (!context.ok) return reply.code(context.status).send({ error: context.error });
    const parsed = pullBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-pull-count' });
    const parsedKey = idempotencyKeySchema.safeParse(request.headers['idempotency-key']);
    if (!parsedKey.success) return reply.code(400).send({ error: 'invalid-idempotency-key' });
    const count = parsed.data.count;
    const totalCost = gachaCost(count)!;
    const idempotencyKey = parsedKey.data;

    try {
      const result = await database.transaction(async (tx) => {
        const [claim] = await tx.insert(gachaRequests).values({
          userId: context.user.id,
          idempotencyKey,
          count,
        }).onConflictDoNothing({ target: [gachaRequests.userId, gachaRequests.idempotencyKey] })
          .returning({ id: gachaRequests.id });

        if (!claim) {
          const [existing] = await tx.select({ count: gachaRequests.count, response: gachaRequests.response })
            .from(gachaRequests)
            .where(and(eq(gachaRequests.userId, context.user.id), eq(gachaRequests.idempotencyKey, idempotencyKey)))
            .limit(1);
          if (!existing || !existing.response) throw new Error('gacha-idempotency-record-unavailable');
          if (existing.count !== count) return { statusCode: 409, body: { error: 'idempotency-key-reused' } };
          return { statusCode: existing.response.ok ? 200 : 409, body: existing.response };
        }

        const [wallet] = await tx.update(users)
          .set({ coins: sql`${users.coins} - ${totalCost}`, updatedAt: new Date() })
          .where(and(eq(users.id, context.user.id), gte(users.coins, totalCost)))
          .returning({ coins: users.coins });
        if (!wallet) {
          const [current] = await tx.select({ coins: users.coins }).from(users).where(eq(users.id, context.user.id)).limit(1);
          const response: GachaResponse = { ok: false, error: 'insufficient-coins', coins: current?.coins ?? 0 };
          await tx.update(gachaRequests).set({ response }).where(eq(gachaRequests.id, claim.id));
          return { statusCode: 409, body: response };
        }

        const catalog = await tx.select({ id: items.id, code: items.code, name: items.name, rarity: items.rarity, type: items.type, attack: items.attack, defense: items.defense })
          .from(items).where(eq(items.enabled, true)).orderBy(asc(items.code));
        const pulled: GachaItemResult[] = [];
        for (let index = 0; index < count; index += 1) {
          const rarity = rollRarity();
          const candidates = catalog.filter((item) => item.rarity === rarity);
          if (candidates.length === 0) throw new Error('gacha-catalog-empty');
          const item = candidates[randomInt(candidates.length)];
          const pullId = randomUUID();
          const perPullCost = GACHA_COST.single;
          await tx.insert(gachaPulls).values({ id: pullId, userId: context.user.id, itemId: item.id, cost: perPullCost });
          await tx.insert(inventory).values({ userId: context.user.id, itemId: item.id, quantity: 1 })
            .onConflictDoUpdate({ target: [inventory.userId, inventory.itemId], set: { quantity: sql`${inventory.quantity} + 1` } });
          await tx.insert(coinLedger).values({ userId: context.user.id, amount: -perPullCost, reason: 'gacha', referenceId: pullId });
          pulled.push(item);
        }
        const response: GachaResponse = { ok: true, coins: wallet.coins, items: pulled, count, cost: totalCost };
        await tx.update(gachaRequests).set({ response }).where(eq(gachaRequests.id, claim.id));
        return { statusCode: 200, body: response };
      });
      return reply.code(result.statusCode).send(result.body);
    } catch {
      request.log.error({ event: 'gacha-pull-failed' }, 'Could not complete a gacha pull');
      return reply.code(503).send({ error: 'gacha-unavailable' });
    }
  });

  app.get('/api/me/gacha-history', async (request, reply) => {
    const database = db;
    if (!database) return reply.code(503).send({ error: 'database-not-configured' });
    const context = await resolveUser(database, request.headers.authorization);
    if (!context.ok) return reply.code(context.status).send({ error: context.error });
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-limit' });
    const history = await database.select({ itemCode: items.code, itemName: items.name, rarity: items.rarity, type: items.type, cost: gachaPulls.cost, pulledAt: gachaPulls.pulledAt })
      .from(gachaPulls).innerJoin(items, eq(items.id, gachaPulls.itemId))
      .where(eq(gachaPulls.userId, context.user.id)).orderBy(desc(gachaPulls.pulledAt)).limit(parsed.data.limit);
    return { history, coins: context.user.coins };
  });

  app.get('/api/me/matches', async (request, reply) => {
    const database = db;
    if (!database) return reply.code(503).send({ error: 'database-not-configured' });
    const context = await resolveUser(database, request.headers.authorization);
    if (!context.ok) return reply.code(context.status).send({ error: context.error });
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-limit' });
    const rows = await database.select().from(matches)
      .where(or(eq(matches.playerOneId, context.user.id), eq(matches.playerTwoId, context.user.id)))
      .orderBy(desc(matches.completedAt)).limit(parsed.data.limit);
    const history = rows.map((match) => {
      const isPlayerOne = match.playerOneId === context.user.id;
      const playerOneResult = match.playerOneResult;
      const result = playerOneResult === 'draw' || playerOneResult === 'disconnect'
        ? playerOneResult
        : (playerOneResult === 'win') === isPlayerOne ? 'win' : 'lose';
      return {
        matchId: match.id,
        mode: match.mode,
        result,
        opponentId: isPlayerOne ? match.playerTwoId : match.playerOneId,
        wpm: isPlayerOne ? match.playerOneWpm : match.playerTwoWpm,
        accuracy: isPlayerOne ? match.playerOneAccuracy : match.playerTwoAccuracy,
        characters: isPlayerOne ? match.playerOneCharacters : match.playerTwoCharacters,
        mistakes: isPlayerOne ? match.playerOneMistakes : match.playerTwoMistakes,
        maxCombo: isPlayerOne ? match.playerOneMaxCombo : match.playerTwoMaxCombo,
        ratingChange: isPlayerOne ? match.playerOneRatingChange : match.playerTwoRatingChange,
        coins: isPlayerOne ? match.playerOneCoinReward : match.playerTwoCoinReward,
        completedAt: match.completedAt,
      };
    });
    return { history };
  });
};

export default gameRoutes;
