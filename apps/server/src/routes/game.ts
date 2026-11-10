import type { FastifyPluginAsync } from 'fastify';
import { asc, desc, eq, gte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { PLACEMENT_MATCHES, rankName } from '@type-arena/game-data';
import { authenticateBearer } from '../auth/bearer.js';
import { db } from '../database/client.js';
import { matches, users } from '../database/schema.js';

const listQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
const leaderboardQuerySchema = listQuerySchema.extend({ offset: z.coerce.number().int().min(0).max(2_147_483_647).default(0) });

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
  app.get('/api/leaderboard', async (request, reply) => {
    const database = db;
    if (!database) return reply.code(503).send({ error: 'database-not-configured' });
    const parsed = leaderboardQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-limit' });
    const ranking = await database.select({ id: users.id, displayName: users.displayName, photoUrl: users.photoUrl, rating: users.rating })
      .from(users).where(gte(users.placementMatches, PLACEMENT_MATCHES)).orderBy(desc(users.rating), asc(users.createdAt), asc(users.id)).limit(parsed.data.limit).offset(parsed.data.offset);
    const [total] = await database.select({ count: sql<number>`count(*)::int` }).from(users).where(gte(users.placementMatches, PLACEMENT_MATCHES));
    return { ranking: ranking.map((player, index) => ({ rank: parsed.data.offset + index + 1, ...player, title: rankName(player.rating, PLACEMENT_MATCHES, parsed.data.offset + index + 1) })), total: total.count, offset: parsed.data.offset, limit: parsed.data.limit };
  });

  app.get('/api/me/rank', async (request, reply) => {
    const auth = await authenticateBearer(request.headers.authorization);
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.code });
    const database = db;
    if (!database) return reply.code(503).send({ error: 'database-not-configured' });
    const [user] = await database.select({ id: users.id, rating: users.rating, placementMatches: users.placementMatches })
      .from(users).where(eq(users.firebaseUid, auth.identity.uid)).limit(1);
    if (!user) return reply.code(404).send({ error: 'profile-not-found' });
    let position: number | null = null;
    if (user.placementMatches >= PLACEMENT_MATCHES) {
      const ranked = database.select({
        id: users.id,
        position: sql<number>`row_number() over (order by ${users.rating} desc, ${users.createdAt} asc, ${users.id} asc)::int`.as('position'),
      }).from(users).where(gte(users.placementMatches, PLACEMENT_MATCHES)).as('ranked_users');
      const [standing] = await database.select({ position: ranked.position }).from(ranked).where(eq(ranked.id, user.id));
      position = standing?.position ?? null;
    }
    return { rating: user.rating, placementMatches: user.placementMatches, placementRequired: PLACEMENT_MATCHES, position, title: rankName(user.rating, user.placementMatches, position) };
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
