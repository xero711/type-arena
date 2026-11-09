import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../database/client.js';
import { users } from '../database/schema.js';
import { authenticateBearer } from '../auth/bearer.js';

const updateProfileSchema = z.object({ displayName: z.string().trim().min(1).max(24) }).strict();

const profileRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/auth/session', async (request, reply) => {
    const auth = await authenticateBearer(request.headers.authorization);
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.code });
    if (!db) return reply.code(503).send({ error: 'database-not-configured' });

    const displayName = (auth.identity.name || 'タイパー').trim().slice(0, 24) || 'タイパー';
    const photoUrl = typeof auth.identity.picture === 'string' ? auth.identity.picture : null;
    const [user] = await db.insert(users).values({
      firebaseUid: auth.identity.uid,
      displayName,
      photoUrl,
    }).onConflictDoUpdate({
      target: users.firebaseUid,
      set: { photoUrl, updatedAt: new Date() },
    }).returning({ id: users.id, displayName: users.displayName, photoUrl: users.photoUrl, rating: users.rating, coins: users.coins });

    return { user };
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
