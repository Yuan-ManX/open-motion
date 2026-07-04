import type { RequestHandler } from "express";
import { logger } from "../../utils/logger.js";

/**
 * Log each HTTP request on response finish: method, path, status, duration.
 * Health checks are skipped to avoid log noise during polling.
 */
export const requestLog: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path === "/api/health") return;
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
};
