import { Router } from "express";
import { z } from "zod";
import { CreateProjectInputSchema } from "@openmotion/shared";
import { HttpError } from "../middleware/error.js";
import { validate, validated } from "../middleware/validate.js";
import { runAsync } from "../../utils/async.js";
import {
  listProjects,
  getProject,
  getProjectSpec,
  createProject,
  updateProject,
  deleteProject,
  duplicateProject,
} from "../../db/repositories/projects.js";

export const projectsRouter = Router();

projectsRouter.get(
  "/projects",
  runAsync(async (_req, res) => {
    const projects = listProjects();
    const withSpec = projects.map((p) => {
      const spec = getProjectSpec(p.id);
      return { ...p, spec };
    });
    res.json(withSpec);
  }),
);

projectsRouter.post(
  "/projects",
  validate(CreateProjectInputSchema),
  runAsync(async (req, res) => {
    const input = validated<z.infer<typeof CreateProjectInputSchema>>(req);
    const project = createProject(input);
    const spec = getProjectSpec(project.id);
    res.status(201).json({ ...project, spec });
  }),
);

projectsRouter.get(
  "/projects/:id",
  runAsync(async (req, res) => {
    const project = getProject(req.params.id);
    if (!project) throw new HttpError(404, "project not found");
    const spec = getProjectSpec(project.id);
    res.json({ ...project, spec });
  }),
);

projectsRouter.put(
  "/projects/:id",
  runAsync(async (req, res) => {
    const patch = req.body ?? {};
    const updated = updateProject(req.params.id, patch);
    if (!updated) throw new HttpError(404, "project not found");
    res.json(updated);
  }),
);

projectsRouter.delete(
  "/projects/:id",
  runAsync(async (req, res) => {
    const ok = deleteProject(req.params.id);
    if (!ok) throw new HttpError(404, "project not found");
    res.status(204).end();
  }),
);

projectsRouter.post(
  "/projects/:id/duplicate",
  runAsync(async (req, res) => {
    const copy = duplicateProject(req.params.id);
    if (!copy) throw new HttpError(404, "project not found");
    const spec = getProjectSpec(copy.id);
    res.status(201).json({ ...copy, spec });
  }),
);
