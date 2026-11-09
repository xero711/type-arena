import { config } from './config.js';
import { buildApp } from './app.js';
import { attachRealtime } from './realtime.js';

const app = await buildApp();
const realtime = attachRealtime(app.server);
app.addHook('onClose', async () => { realtime.close(); });
try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
