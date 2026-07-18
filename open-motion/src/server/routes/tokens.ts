import { Router } from "express";
import { z } from "zod";
import { runAsync } from "../../utils/async.js";
import {
  listTokens,
  createToken,
  updateToken,
  deleteToken,
  type TokenCategory,
} from "../../db/repositories/tokens.js";

export const tokensRouter = Router();

const CreateTokenSchema = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "name must be lowercase kebab-case"),
  category: z.enum(["duration", "easing", "color", "spacing", "radius", "shadow", "font"]),
  value: z.string().min(1).max(500),
  description: z.string().max(500).optional().default(""),
});

const UpdateTokenSchema = z.object({
  value: z.string().min(1).max(500).optional(),
  description: z.string().max(500).optional(),
  category: z.enum(["duration", "easing", "color", "spacing", "radius", "shadow", "font"]).optional(),
});

tokensRouter.get(
  "/projects/:id/tokens",
  runAsync(async (req, res) => {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    res.json(listTokens(req.params.id, category));
  }),
);

tokensRouter.post(
  "/projects/:id/tokens",
  runAsync(async (req, res) => {
    const parsed = CreateTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid token input" });
      return;
    }
    const token = createToken({
      projectId: req.params.id,
      name: parsed.data.name,
      category: parsed.data.category as TokenCategory,
      value: parsed.data.value,
      description: parsed.data.description,
    });
    res.status(201).json(token);
  }),
);

tokensRouter.patch(
  "/projects/:id/tokens/:name",
  runAsync(async (req, res) => {
    const parsed = UpdateTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid patch input" });
      return;
    }
    const token = updateToken(req.params.id, req.params.name, parsed.data);
    if (!token) {
      res.status(404).json({ error: "token not found" });
      return;
    }
    res.json(token);
  }),
);

tokensRouter.delete(
  "/projects/:id/tokens/:name",
  runAsync(async (req, res) => {
    const ok = deleteToken(req.params.id, req.params.name);
    if (!ok) {
      res.status(404).json({ error: "token not found" });
      return;
    }
    res.status(204).end();
  }),
);
