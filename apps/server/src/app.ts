import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { checkDatabase, pool } from './database/client.js';
import profileRoutes from './routes/profile.js';
import gameRoutes from './routes/game.js';

export async function buildApp() {
  const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] } });
  const allowedOrigins = config.WEB_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
  await app.register(cors, { origin: allowedOrigins, credentials: true });
  await app.register(profileRoutes);
  await app.register(gameRoutes);

  const healthCheck = async () => {
    let database: 'online' | 'offline' | 'not-configured' = 'not-configured';
    if (config.DATABASE_URL) {
      try { database = await checkDatabase() ? 'online' : 'offline'; }
      catch { database = 'offline'; }
    }
    return { status: 'ok', service: 'type-arena-api', database };
  };
  app.get('/health', healthCheck);
  app.get('/api/health', healthCheck);

  app.get('/ready', async (_request, reply) => {
    try {
      if (await checkDatabase()) return { status: 'ready' };
      return reply.code(503).send({ status: 'not-ready', reason: 'database-not-configured' });
    } catch {
      return reply.code(503).send({ status: 'not-ready', reason: 'database-unavailable' });
    }
  });
  app.addHook('onClose', async () => { await pool?.end(); });
  return app;
}
