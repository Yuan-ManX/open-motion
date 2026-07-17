import type { RequestHandler } from "express";

interface RateLimitEntry {
  timestamps: number[];
}

/**
 * Sliding-window in-memory rate limiter. Tracks request timestamps per IP
 * and rejects with 429 when the window is full. Each instance owns a private
 * bucket map so limiter scopes do not bleed into each other.
 */
export function createRateLimiter(max: number, windowMs: number): RequestHandler {
  const buckets = new Map<string, RateLimitEntry>();

  return (req, res, next) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const entry = buckets.get(ip);
    const now = Date.now();
    const fresh = entry
      ? entry.timestamps.filter((t) => now - t < windowMs)
      : [];

    if (fresh.length >= max) {
      const oldest = fresh[0] ?? now;
      const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
      res.set("Retry-After", String(Math.max(1, retryAfter)));
      res.status(429).json({ error: "rate_limited", retryAfter: Math.max(1, retryAfter) });
      return;
    }

    fresh.push(now);
    buckets.set(ip, { timestamps: fresh });
    next();
  };
}
