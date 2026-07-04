import type { MotionComponent, IterationCount } from "@openmotion/shared";
import { createId, now } from "../../utils/id.js";
import { HttpError } from "../middleware/error.js";
import { ensureProjectExists } from "./projectService.js";
import {
  listComponents,
  getComponent,
  patchComponent,
  createComponent,
  deleteComponent,
  type ComponentPatch,
} from "../../db/repositories/components.js";
import { instantiateTemplate } from "../../motion/templates/index.js";

export interface CreateComponentInput {
  name?: string;
  templateId?: string;
  sceneId?: string;
  selector?: string;
  durationMs?: number;
  delayMs?: number;
  iterationCount?: IterationCount;
  direction?: MotionComponent["direction"];
  fillMode?: MotionComponent["fillMode"];
  easing?: MotionComponent["easing"];
  keyframes?: MotionComponent["keyframes"];
  style?: MotionComponent["style"];
  orderIndex?: number;
}

export function listProjectComponents(projectId: string): MotionComponent[] {
  ensureProjectExists(projectId);
  return listComponents(projectId);
}

export function createProjectComponent(
  projectId: string,
  input: CreateComponentInput,
): MotionComponent {
  ensureProjectExists(projectId);
  const id = createId("c_");
  const ts = now();
  const tpl = input.templateId ? instantiateTemplate(input.templateId, projectId)[0] : null;
  const existing = listComponents(projectId);
  const maxOrder = existing.reduce((max, c) => Math.max(max, c.orderIndex), -1);
  const component: MotionComponent = {
    id,
    projectId,
    sceneId: input.sceneId ?? null,
    name: input.name ?? "Layer",
    selector: input.selector ?? null,
    templateId: input.templateId ?? tpl?.templateId ?? null,
    durationMs: tpl?.durationMs ?? input.durationMs ?? 800,
    delayMs: tpl?.delayMs ?? input.delayMs ?? 0,
    iterationCount: tpl?.iterationCount ?? input.iterationCount ?? 1,
    direction: tpl?.direction ?? input.direction ?? "normal",
    fillMode: tpl?.fillMode ?? input.fillMode ?? "forwards",
    playState: "running",
    easing: tpl?.easing ?? input.easing ?? { type: "preset", name: "ease-out" },
    keyframes: tpl?.keyframes ?? input.keyframes ?? [],
    style: tpl?.style ?? input.style ?? {},
    orderIndex: input.orderIndex ?? maxOrder + 1,
    createdAt: ts,
    updatedAt: ts,
  };
  createComponent(component);
  return component;
}

export function getProjectComponent(projectId: string, componentId: string): MotionComponent {
  ensureProjectExists(projectId);
  const c = getComponent(projectId, componentId);
  if (!c) throw new HttpError(404, "component not found");
  return c;
}

export function patchProjectComponent(
  projectId: string,
  componentId: string,
  patch: ComponentPatch,
): MotionComponent {
  ensureProjectExists(projectId);
  const updated = patchComponent(projectId, componentId, patch);
  if (!updated) throw new HttpError(404, "component not found");
  return updated;
}

export function deleteProjectComponent(projectId: string, componentId: string): void {
  ensureProjectExists(projectId);
  const ok = deleteComponent(projectId, componentId);
  if (!ok) throw new HttpError(404, "component not found");
}
