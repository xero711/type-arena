import type { FastifyPluginAsync } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { characters, isCharacterId, MAX_GROWTH_LEVEL, type GrowthStat } from '@type-arena/game-data';
import { z } from 'zod';
import { db } from '../database/client.js';
import { coinLedger, users } from '../database/schema.js';
import { authenticateBearer } from '../auth/bearer.js';

const updateProfileSchema = z.object({ displayName: z.string().trim().min(1).max(24) }).strict();

const profileRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/auth/session', async (request, reply) => {
    const auth = await authenticateBearer(request.headers.authorization);
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.code });
    if (!db) return reply.code(503).send({ error: 'database-not-configured' });

    const displayName = (auth.identity.name || 'タイパー').trim().slice(0, 24) || 'タイパー';
    const photoUrl = typeof auth.identity.picture === 'string' ? auth.identity.picture : null;
    const user = await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({
        firebaseUid: auth.identity.uid,
        displayName,
        photoUrl,
      }).onConflictDoNothing({ target: users.firebaseUid })
        .returning({ id: users.id, displayName: users.displayName, photoUrl: users.photoUrl, rating: users.rating, coins: users.coins });
      let profile = created;
      if (profile) {
        profile = { ...profile, coins: profile.coins + 100 };
        await tx.update(users).set({ coins: profile.coins }).where(eq(users.id, profile.id));
        await tx.insert(coinLedger).values({ userId: profile.id, amount: 100, reason: 'welcome', referenceId: 'welcome-v1' }).onConflictDoNothing();
      } else {
        const [existing] = await tx.update(users).set({ photoUrl, updatedAt: new Date() })
          .where(eq(users.firebaseUid, auth.identity.uid))
          .returning({ id: users.id, displayName: users.displayName, photoUrl: users.photoUrl, rating: users.rating, coins: users.coins });
        profile = existing;
      }
      if (!profile) throw new Error('profile-upsert-failed');

      return profile;
    });

    return { user };
  });

  app.get('/api/me/characters', async (request, reply) => {
    const auth = await authenticateBearer(request.headers.authorization);
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.code });
    if (!db) return reply.code(503).send({ error: 'database-not-configured' });
    const [user] = await db.select({ id: users.id, coins: users.coins, selected: users.selectedCharacter }).from(users).where(eq(users.firebaseUid, auth.identity.uid)).limit(1);
    if (!user) return reply.code(404).send({ error: 'profile-not-found' });
    const unlocks = await db.select({ character: coinLedger.referenceId }).from(coinLedger).where(and(eq(coinLedger.userId, user.id), eq(coinLedger.reason, 'character-unlock')));
    return { coins: user.coins, selected: isCharacterId(user.selected) ? user.selected : 'balanced', unlocked: ['balanced', ...unlocks.map((row) => row.character).filter(isCharacterId)] };
  });

  app.post('/api/me/characters', async (request, reply) => {
    const auth = await authenticateBearer(request.headers.authorization);
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.code });
    if (!db) return reply.code(503).send({ error: 'database-not-configured' });
    const body = z.object({ character: z.string(), action: z.enum(['unlock', 'select']), expectedPrice: z.number().int().min(0).optional() }).strict().safeParse(request.body);
    if (!body.success || !isCharacterId(body.data.character)) return reply.code(400).send({ error: 'invalid-character' });
    const { character, action } = body.data;
    const result = await db.transaction(async (tx) => {
      const [user] = await tx.select({ id: users.id, coins: users.coins }).from(users).where(eq(users.firebaseUid, auth.identity.uid)).for('update');
      if (!user) return { error: 'profile-not-found' as const };
      const [existing] = await tx.select({ id: coinLedger.id }).from(coinLedger).where(and(eq(coinLedger.userId, user.id), eq(coinLedger.reason, 'character-unlock'), eq(coinLedger.referenceId, character))).limit(1);
      const owned = character === 'balanced' || Boolean(existing);
      if (action === 'select') {
        if (!owned) return { error: 'character-locked' as const };
        await tx.update(users).set({ selectedCharacter: character, updatedAt: new Date() }).where(eq(users.id, user.id));
      } else if (!owned) {
        const price = characters[character].price;
        if (body.data.expectedPrice !== price) return { error: 'price-changed' as const, price };
        if (user.coins < price) return { error: 'insufficient-coins' as const };
        await tx.update(users).set({ coins: user.coins - price, updatedAt: new Date() }).where(eq(users.id, user.id));
        await tx.insert(coinLedger).values({ userId: user.id, amount: -price, reason: 'character-unlock', referenceId: character });
      }
      return { ok: true as const };
    });
    if ('error' in result) return reply.code(result.error === 'profile-not-found' ? 404 : 400).send(result);
    return result;
  });

  app.get('/api/me/growth', async (request, reply) => {
    const auth = await authenticateBearer(request.headers.authorization);
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.code });
    if (!db) return reply.code(503).send({ error: 'database-not-configured' });
    const [growth] = await db.select({ points: users.growthPoints, attack: users.attackLevel, defense: users.defenseLevel, magicAttack: users.magicAttackLevel, magicDefense: users.magicDefenseLevel })
      .from(users).where(eq(users.firebaseUid, auth.identity.uid)).limit(1);
    if (!growth) return reply.code(404).send({ error: 'profile-not-found' });
    return growth;
  });

  app.post('/api/me/growth', async (request, reply) => {
    const auth = await authenticateBearer(request.headers.authorization);
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.code });
    if (!db) return reply.code(503).send({ error: 'database-not-configured' });
    const body = z.object({ stat: z.enum(['attack', 'defense', 'magicAttack', 'magicDefense']) }).strict().safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid-stat' });
    const stat: GrowthStat = body.data.stat;
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select({ id: users.id, points: users.growthPoints, attack: users.attackLevel, defense: users.defenseLevel, magicAttack: users.magicAttackLevel, magicDefense: users.magicDefenseLevel })
        .from(users).where(eq(users.firebaseUid, auth.identity.uid)).for('update');
      if (!current) return { error: 'profile-not-found' as const };
      if (current.points < 1) return { error: 'insufficient-points' as const };
      if (current[stat] >= MAX_GROWTH_LEVEL) return { error: 'stat-maxed' as const };
      const field = { attack: 'attackLevel', defense: 'defenseLevel', magicAttack: 'magicAttackLevel', magicDefense: 'magicDefenseLevel' } as const;
      await tx.update(users).set({ growthPoints: current.points - 1, [field[stat]]: current[stat] + 1, updatedAt: new Date() }).where(eq(users.id, current.id));
      return { points: current.points - 1, attack: current.attack, defense: current.defense, magicAttack: current.magicAttack, magicDefense: current.magicDefense, [stat]: current[stat] + 1 };
    });
    if ('error' in result) return reply.code(result.error === 'profile-not-found' ? 404 : 400).send(result);
    return result;
  });

  app.get('/api/me', async (request, reply) => {
    const auth = await authenticateBearer(request.headers.authorization);
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.code });
    if (!db) return reply.code(503).send({ error: 'database-not-configured' });

    const [user] = await db.select({ id: users.id, displayName: users.displayName, photoUrl: users.photoUrl, rating: users.rating, coins: users.coins, createdAt: users.createdAt })
      .from(users).where(eq(users.firebaseUid, auth.identity.uid)).limit(1);
    if (!user) return reply.code(404).send({ error: 'profile-not-found' });
    return { user };
  });

  app.patch('/api/me', async (request, reply) => {
    const auth = await authenticateBearer(request.headers.authorization);
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.code });
    if (!db) return reply.code(503).send({ error: 'database-not-configured' });
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-profile', issues: parsed.error.issues.map(({ path, code }) => ({ field: path.join('.'), code })) });

    const [user] = await db.update(users).set({ displayName: parsed.data.displayName, updatedAt: new Date() })
      .where(eq(users.firebaseUid, auth.identity.uid))
      .returning({ id: users.id, displayName: users.displayName, photoUrl: users.photoUrl, rating: users.rating, coins: users.coins });
    if (!user) return reply.code(404).send({ error: 'profile-not-found' });
    return { user };
  });
};

export default profileRoutes;
