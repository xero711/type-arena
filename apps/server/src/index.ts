import { config } from './config.js';
import { buildApp } from './app.js';
import { attachRealtime } from './realtime.js';

const app = await buildApp();
const realtime = attachRealtime(app.server);
app.addHook('onClose', async () => { await realtime.shutdownGracefully(); });

let shutdownStarted = false;
const shutdown = async (signal: NodeJS.Signals) => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  app.log.info({ signal }, 'Stopping TYPE ARENA gracefully');
  try {
    await app.close();
  } catch (error) {
    app.log.error(error, 'TYPE ARENA shutdown failed');
    process.exitCode = 1;
  }
};

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
