import type { RequestHandler } from "express";
import { config } from "../../config.js";

/**
 * API key gate. When OPENMOTION_API_KEY is unset (dev mode), all requests pass
 * through. When set, clients must send the key via X-API-Key header or
 * Authorization: Bearer <key>. Health endpoint is always exempt.
 */
export const authMiddleware: RequestHandler = (req, res, next) => {
  if (!config.OPENMOTION_API_KEY) return next();
  if (req.path === "/api/health") return next();

  const headerKey = req.get("x-api-key");
  const bearer = req.get("authorization");
  const bearerKey = bearer?.startsWith("Bearer ") ? bearer.slice(7) : null;
  const key = headerKey ?? bearerKey;

  if (key !== config.OPENMOTION_API_KEY) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
};
