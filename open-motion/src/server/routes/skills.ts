import { Router } from "express";
import { z } from "zod";
import { CreateSkillInputSchema, EasingSchema } from "@openmotion/shared";
import { HttpError } from "../middleware/error.js";
import { validate, validated } from "../middleware/validate.js";
import { runAsync } from "../../utils/async.js";
import { listSkills, getSkill, deleteSkill } from "../../db/repositories/skills.js";
import { packageSkill } from "../../skills/packager.js";
import { invokeSkill, type InvokeSkillArgs } from "../../skills/registry.js";

export const skillsRouter = Router();

skillsRouter.get(
  "/skills",
  runAsync(async (_req, res) => {
    const skills = listSkills().map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      version: s.version,
      tags: s.tags,
      outputType: s.manifest.outputType,
      sourceProjectId: s.sourceProjectId,
      createdAt: s.createdAt,
    }));
    res.json(skills);
  }),
);

skillsRouter.post(
  "/skills",
  validate(CreateSkillInputSchema),
  runAsync(async (req, res) => {
    const input = validated<z.infer<typeof CreateSkillInputSchema>>(req);
    const skill = packageSkill(input);
    if (!skill) throw new HttpError(404, "source project not found");
    res.status(201).json(skill);
  }),
);

skillsRouter.get(
  "/skills/:id",
  runAsync(async (req, res) => {
    const skill = getSkill(req.params.id);
    if (!skill) throw new HttpError(404, "skill not found");
    res.json(skill);
  }),
);

skillsRouter.get(
  "/skills/:id/code",
  runAsync(async (req, res) => {
    const skill = getSkill(req.params.id);
    if (!skill) throw new HttpError(404, "skill not found");
    res.json({ id: skill.id, codeHtml: skill.codeHtml });
  }),
);

const InvokeInputSchema = z.object({
  easing: EasingSchema.optional(),
  durationMs: z.number().int().positive().optional(),
  iterationCount: z.union([z.number().int().positive(), z.literal("infinite")]).optional(),
});

skillsRouter.post(
  "/skills/:id/invoke",
  runAsync(async (req, res) => {
    const parsed = InvokeInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new HttpError(400, "invalid invoke args");
    const result = invokeSkill(req.params.id, parsed.data as InvokeSkillArgs);
    if (!result) throw new HttpError(404, "skill not found");
    res.json(result);
  }),
);

skillsRouter.delete(
  "/skills/:id",
  runAsync(async (req, res) => {
    const ok = deleteSkill(req.params.id);
    if (!ok) throw new HttpError(404, "skill not found");
    res.status(204).end();
  }),
);
