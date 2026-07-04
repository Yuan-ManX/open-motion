import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type Location = "body" | "query" | "params";

/** Validate req.body / req.query / req.params against a zod schema; 400 on failure. */
export function validate<T>(schema: ZodType<T>, location: Location = "body"): RequestHandler {
  return (req, res, next) => {
    const source = req[location];
    const parsed = schema.safeParse(source);
    if (!parsed.success) {
      res.status(400).json({
        error: "validation_error",
        location,
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
      return;
    }
    (req as unknown as Record<string, unknown>)[`_validated_${location}`] = parsed.data;
    next();
  };
}

export function validated<T>(req: unknown, location: Location = "body"): T {
  return (req as Record<string, unknown>)[`_validated_${location}`] as T;
}
