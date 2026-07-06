import { Router } from "express";
import { z } from "zod";
import { CreateSkillInputSchema, EasingSchema } from "@openmotion/shared";
import { validate, validated } from "../middleware/validate.js";
import { runAsync } from "../../utils/async.js";
import {
  listSkillSummaries,
  getSkillOrThrow,
  getSkillCodeOrThrow,
  createSkill,
  invokeSkillOrThrow,
  deleteSkillOrThrow,
} from "../services/skillService.js";

export const skillsRouter = Router();

const InvokeInputSchema = z.object({
  easing: EasingSchema.optional(),
  durationMs: z.number().int().positive().optional(),
  iterationCount: z.union([z.number().int().positive(), z.literal("infinite")]).optional(),
});

skillsRouter.get(
  "/skills",
  runAsync(async (_req, res) => {
    res.json(listSkillSummaries());
  }),
);

skillsRouter.post(
  "/skills",
  validate(CreateSkillInputSchema),
  runAsync(async (req, res) => {
    const input = validated<z.infer<typeof CreateSkillInputSchema>>(req);
    res.status(201).json(createSkill(input));
  }),
);

skillsRouter.get(
  "/skills/:id",
  runAsync(async (req, res) => {
    res.json(getSkillOrThrow(req.params.id));
  }),
);

skillsRouter.get(
  "/skills/:id/code",
  runAsync(async (req, res) => {
    res.json(getSkillCodeOrThrow(req.params.id));
  }),
);

skillsRouter.post(
  "/skills/:id/invoke",
  validate(InvokeInputSchema),
  runAsync(async (req, res) => {
    const input = validated<z.infer<typeof InvokeInputSchema>>(req);
    res.json(invokeSkillOrThrow(req.params.id, input));
  }),
);

skillsRouter.delete(
  "/skills/:id",
  runAsync(async (req, res) => {
    deleteSkillOrThrow(req.params.id);
    res.status(204).end();
  }),
);
