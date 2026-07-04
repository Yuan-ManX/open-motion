import { Router } from "express";
import { createId, now } from "../../utils/id.js";
import { HttpError } from "../middleware/error.js";
import { runAsync } from "../../utils/async.js";
import { getProject } from "../../db/repositories/projects.js";
import {
  listComponents,
  getComponent,
  patchComponent,
  createComponent,
  deleteComponent,
  type ComponentPatch,
} from "../../db/repositories/components.js";
import { instantiateTemplate } from "../../motion/templates/index.js";

export const componentsRouter = Router({ mergeParams: true });

componentsRouter.get(
  "/",
  runAsync(async (req, res) => {
    const projectId = req.params.id;
    if (!getProject(projectId)) throw new HttpError(404, "project not found");
    res.json(listComponents(projectId));
  }),
);

componentsRouter.post(
  "/",
  runAsync(async (req, res) => {
    const projectId = req.params.id;
    if (!getProject(projectId)) throw new HttpError(404, "project not found");
    const body = req.body ?? {};
    const id = createId("c_");
    const ts = now();
    const tpl = body.templateId
      ? instantiateTemplate(body.templateId, projectId)[0]
      : null;
    const existing = listComponents(projectId);
    const maxOrder = existing.reduce((max, c) => Math.max(max, c.orderIndex), -1);
    const component = {
      id,
      projectId,
      sceneId: body.sceneId ?? null,
      name: body.name ?? "Layer",
      selector: body.selector ?? null,
      templateId: body.templateId ?? tpl?.templateId ?? null,
      durationMs: tpl?.durationMs ?? body.durationMs ?? 800,
      delayMs: tpl?.delayMs ?? body.delayMs ?? 0,
      iterationCount: tpl?.iterationCount ?? body.iterationCount ?? 1,
      direction: tpl?.direction ?? body.direction ?? "normal",
      fillMode: tpl?.fillMode ?? body.fillMode ?? "forwards",
      playState: "running" as const,
      easing: tpl?.easing ?? body.easing ?? { type: "preset", name: "ease-out" },
      keyframes: tpl?.keyframes ?? body.keyframes ?? [],
      style: tpl?.style ?? body.style ?? {},
      orderIndex: body.orderIndex ?? (maxOrder + 1),
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    res.status(201).json(component);
  }),
);

componentsRouter.get(
  "/:cid",
  runAsync(async (req, res) => {
    const c = getComponent(req.params.id, req.params.cid);
    if (!c) throw new HttpError(404, "component not found");
    res.json(c);
  }),
);

componentsRouter.patch(
  "/:cid",
  runAsync(async (req, res) => {
    const patch = (req.body ?? {}) as ComponentPatch;
    const updated = patchComponent(req.params.id, req.params.cid, patch);
    if (!updated) throw new HttpError(404, "component not found");
    res.json(updated);
  }),
);

componentsRouter.delete(
  "/:cid",
  runAsync(async (req, res) => {
    const ok = deleteComponent(req.params.id, req.params.cid);
    if (!ok) throw new HttpError(404, "component not found");
    res.status(204).end();
  }),
);
