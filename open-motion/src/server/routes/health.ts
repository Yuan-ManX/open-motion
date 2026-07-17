import { Router } from "express";
import { VERSION, providerMode, getProviderConfigs } from "../../config.js";
import { listConfiguredProviders } from "../../agent/provider/index.js";
import { hasNodeSqlite, hasPuppeteer, hasFfmpeg } from "../../utils/env.js";
import { runAsync } from "../../utils/async.js";

export const healthRouter = Router();

healthRouter.get(
  "/health",
  runAsync(async (_req, res) => {
    const [db, puppeteer, ffmpeg] = await Promise.all([
      hasNodeSqlite(),
      hasPuppeteer(),
      hasFfmpeg(),
    ]);
    res.json({
      status: "ok",
      version: VERSION,
      db,
      provider: providerMode(),
      providers: listConfiguredProviders(),
      providerConfigs: getProviderConfigs().map((c) => ({ type: c.type, model: c.model, baseUrl: c.baseUrl })),
      toolCallSupported: true,
      puppeteer,
      ffmpeg,
    });
  }),
);
