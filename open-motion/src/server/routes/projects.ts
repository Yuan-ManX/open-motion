import { Router } from "express";
import { z } from "zod";
import { CreateProjectInputSchema, SceneSchema } from "@openmotion/shared";
import { validate, validated } from "../middleware/validate.js";
import { runAsync } from "../../utils/async.js";
import {
  listProjectsWithSpec,
  getProjectWithSpec,
  createProjectWithSpec,
  updateProjectOrThrow,
  deleteProjectOrThrow,
  duplicateProjectWithSpec,
} from "../services/projectService.js";

const UpdateProjectSchema = z.object({
  name: z.string().optional(),
  totalDurationMs: z.number().optional(),
  scenes: z.array(SceneSchema).optional(),
  tokens: z.record(z.union([z.string(), z.number()])).optional(),
});

export const projectsRouter = Router();

projectsRouter.get(
  "/projects",
  runAsync(async (_req, res) => {
    res.json(listProjectsWithSpec());
  }),
);

projectsRouter.post(
  "/projects",
  validate(CreateProjectInputSchema),
  runAsync(async (req, res) => {
    const input = validated<z.infer<typeof CreateProjectInputSchema>>(req);
    res.status(201).json(createProjectWithSpec(input));
  }),
);

projectsRouter.get(
  "/projects/:id",
  runAsync(async (req, res) => {
    res.json(getProjectWithSpec(req.params.id));
  }),
);

projectsRouter.put(
  "/projects/:id",
  validate(UpdateProjectSchema),
  runAsync(async (req, res) => {
    const patch = validated<z.infer<typeof UpdateProjectSchema>>(req);
    res.json(updateProjectOrThrow(req.params.id, patch));
  }),
);

projectsRouter.delete(
  "/projects/:id",
  runAsync(async (req, res) => {
    deleteProjectOrThrow(req.params.id);
    res.status(204).end();
  }),
);

projectsRouter.post(
  "/projects/:id/duplicate",
  runAsync(async (req, res) => {
    res.status(201).json(duplicateProjectWithSpec(req.params.id));
  }),
);
