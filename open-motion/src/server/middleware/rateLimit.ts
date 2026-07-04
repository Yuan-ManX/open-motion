import type { RequestHandler } from "express";

interface RateLimitEntry {
  timestamps: number[];
}

const buckets = new Map<string, RateLimitEntry>();

function cleanup(ip: string, windowMs: number): number[] {
  const entry = buckets.get(ip);
  if (!entry) return [];
  const now = Date.now();
  const fresh = entry.timestamps.filter((t) => now - t < windowMs);
  entry.timestamps = fresh;
  return fresh;
}

/**
 * Sliding-window in-memory rate limiter. Tracks request timestamps per IP
 * and rejects with 429 when the window is full.
 */
export function createRateLimiter(max: number, windowMs: number): RequestHandler {
  return (req, res, next) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const fresh = cleanup(ip, windowMs);

    if (fresh.length >= max) {
      const oldest = fresh[0] ?? Date.now();
      const retryAfter = Math.ceil((oldest + windowMs - Date.now()) / 1000);
      res.set("Retry-After", String(Math.max(1, retryAfter)));
      res.status(429).json({ error: "rate_limited", retryAfter: Math.max(1, retryAfter) });
      return;
    }

    fresh.push(Date.now());
    buckets.set(ip, { timestamps: fresh });
    next();
  };
}
