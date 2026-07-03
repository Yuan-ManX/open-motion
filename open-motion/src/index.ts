import { createApp } from "./server/app.js";
import { ensureDirs } from "./db/index.js";
import { migrate } from "./db/migrate.js";
import { config, providerMode } from "./config.js";
import { logger } from "./utils/logger.js";
import { getProvider } from "./agent/provider/index.js";
import { hasPuppeteer, hasFfmpeg, hasNodeSqlite } from "./utils/env.js";

async function main(): Promise<void> {
  process.on("uncaughtException", (err) => {
    logger.error("uncaughtException", { stack: err?.stack ?? String(err) });
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("unhandledRejection", { reason: String(reason) });
  });

  ensureDirs();
  migrate();

  const app = createApp();

  // Warm the provider so the first chat is fast and any provider error surfaces now.
  await getProvider();

  const [db, puppeteer, ffmpeg] = await Promise.all([
    hasNodeSqlite(),
    hasPuppeteer(),
    hasFfmpeg(),
  ]);

  app.listen(config.PORT, () => {
    logger.info(`OpenMotion server listening on http://localhost:${config.PORT}`, {
      provider: providerMode(),
      db,
      puppeteer,
      ffmpeg,
    });
    logger.info(`API root: http://localhost:${config.PORT}/api`);
    logger.info(`Health:   http://localhost:${config.PORT}/api/health`);
  });
}

main().catch((err) => {
  logger.error("fatal startup error", { stack: err?.stack ?? String(err) });
  process.exit(1);
});
