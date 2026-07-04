import { Router } from "express";
import { VERSION, providerMode } from "../../config.js";
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
      toolCallSupported: true,
      puppeteer,
      ffmpeg,
    });
  }),
);
