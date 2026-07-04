import type { RequestHandler } from "express";

/** Wrap an async express handler so rejections flow to the error middleware. */
export const runAsync =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
