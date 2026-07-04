import { Router } from "express";
import { runAsync } from "../../utils/async.js";
import {
  listProjectComponents,
  createProjectComponent,
  getProjectComponent,
  patchProjectComponent,
  deleteProjectComponent,
  type CreateComponentInput,
} from "../services/componentService.js";
import type { ComponentPatch } from "../../db/repositories/components.js";

export const componentsRouter = Router({ mergeParams: true });

componentsRouter.get(
  "/",
  runAsync(async (req, res) => {
    res.json(listProjectComponents(req.params.id));
  }),
);

componentsRouter.post(
  "/",
  runAsync(async (req, res) => {
    const input = (req.body ?? {}) as CreateComponentInput;
    res.status(201).json(createProjectComponent(req.params.id, input));
  }),
);

componentsRouter.get(
  "/:cid",
  runAsync(async (req, res) => {
    res.json(getProjectComponent(req.params.id, req.params.cid));
  }),
);

componentsRouter.patch(
  "/:cid",
  runAsync(async (req, res) => {
    const patch = (req.body ?? {}) as ComponentPatch;
    res.json(patchProjectComponent(req.params.id, req.params.cid, patch));
  }),
);

componentsRouter.delete(
  "/:cid",
  runAsync(async (req, res) => {
    deleteProjectComponent(req.params.id, req.params.cid);
    res.status(204).end();
  }),
);
