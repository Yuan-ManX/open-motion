import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../../utils/logger.js";

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "validation_error", issues: err.issues });
    return;
  }
  const status = (err as { status?: number }).status ?? 500;
  const message = (err as Error).message || "internal_error";
  logger.error(message, { stack: (err as Error).stack });
  res.status(status).json({ error: message });
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const notFound = (): RequestHandler => (_req, res) => {
  res.status(404).json({ error: "not_found" });
};
