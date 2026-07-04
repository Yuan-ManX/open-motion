import { Router } from "express";
import { z } from "zod";
import { CreateProjectInputSchema } from "@openmotion/shared";
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
  runAsync(async (req, res) => {
    const patch = req.body ?? {};
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
