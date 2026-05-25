import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createDb } from './memory/db.js';
import { registerHealthRoute } from './routes/health.js';
import { registerDuerOsRoute } from './routes/dueros.js';
import { registerRawBodyHook } from './utils/raw-body.js';

export async function buildApp() {
  const config = loadConfig();
  const logger = createLogger(config);
  const db = createDb(config.DB_PATH);
  const app = Fastify({ logger });

  app.decorate('config', config);
  app.decorate('db', db);
  registerRawBodyHook(app);
  app.addHook('onClose', async () => {
    db.close();
  });

  await registerHealthRoute(app);
  await registerDuerOsRoute(app, config, db);

  return app;
}

async function main() {
  const app = await buildApp();
  const config = loadConfig();
  await app.listen({ host: config.HOST, port: config.PORT });
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? resolve(process.argv[1]) : '';

if (currentFile === entryFile) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
