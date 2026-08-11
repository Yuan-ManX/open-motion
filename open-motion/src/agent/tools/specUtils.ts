// Shared helpers for pro-level motion tool executors: component resolution,
// style patching, keyframe construction, and layer creation.

import type { Easing, Keyframe, MotionComponent } from "@openmotion/shared";
import { createId, now } from "../../utils/id.js";
import { draft } from "../../motion/templates/helper.js";
import { createComponent, getComponent, listComponents, patchComponent } from "../../db/repositories/components.js";
import type { ToolResult } from "./registry.js";

/** Build a success result. */
export function ok(summary: string, specChanged = true, data?: unknown): ToolResult {
  return { ok: true, summary, specChanged, data };
}

/** Build a failure result. */
export function fail(summary: string): ToolResult {
  return { ok: false, summary, specChanged: false };
}

/** Resolve a component id, honoring __first__ / __last__ placeholders. */
export function resolveComponent(
  projectId: string,
  componentId: string,
): MotionComponent | null | undefined {
  if (componentId === "__last__") {
    const all = listComponents(projectId);
    return all.length ? all[all.length - 1] : undefined;
  }
  if (componentId === "__first__") {
    const all = listComponents(projectId);
    return all.length ? all[0] : undefined;
  }
  return getComponent(projectId, componentId);
}

/** Merge CSS style tokens onto a component, returning a ToolResult. */
export function patchStyle(
  projectId: string,
  componentId: string,
  style: Record<string, string | number>,
  summary: string,
): ToolResult {
  const comp = resolveComponent(projectId, componentId);
  if (!comp) return fail(`component ${componentId} not found`);
  patchComponent(projectId, comp.id, { style: { ...comp.style, ...style } });
  return ok(summary, true, { componentId: comp.id });
}

/** Rewrite a component's keyframes, returning a ToolResult. */
export function patchKeyframes(
  projectId: string,
  componentId: string,
  keyframes: Keyframe[],
  summary: string,
): ToolResult {
  const comp = resolveComponent(projectId, componentId);
  if (!comp) return fail(`component ${componentId} not found`);
  patchComponent(projectId, comp.id, { keyframes });
  return ok(summary, true, { componentId: comp.id, keyframeCount: keyframes.length });
}

/** Create a new layer from a draft, returning its id. */
export function addLayer(
  projectId: string,
  name: string,
  opts: Partial<Pick<MotionComponent, "style" | "keyframes" | "durationMs" | "delayMs" | "iterationCount" | "easing" | "trigger" | "parentId">> = {},
): string {
  const ts = now();
  const d = draft(name, {
    style: opts.style,
    keyframes: opts.keyframes,
    durationMs: opts.durationMs,
    delayMs: opts.delayMs,
    iterationCount: opts.iterationCount,
    easing: opts.easing,
    trigger: opts.trigger,
  });
  const component: MotionComponent = {
    ...d,
    id: createId("c_"),
    projectId,
    parentId: opts.parentId ?? d.parentId,
    createdAt: ts,
    updatedAt: ts,
  };
  createComponent(component);
  return component.id;
}

/** A CSS keyframe pair representing a discrete animation step. */
export function buildSteps(
  from: Record<string, string | number>,
  to: Record<string, string | number>,
  easing?: Easing,
): Keyframe[] {
  return [
    { offset: 0, properties: from, easing },
    { offset: 1, properties: to, easing },
  ];
}

/** Quantize a numeric input with a fallback default. */
export function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
