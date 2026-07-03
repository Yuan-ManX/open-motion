import type { Easing, Keyframe, MotionComponent, ToolName, TransformProperty } from "@openmotion/shared";
import { easingSpring } from "@openmotion/shared";
import { createId, now } from "../../utils/id.js";
import {
  getComponent,
  patchComponent,
  createComponent,
  deleteComponent,
  type ComponentPatch,
} from "../../db/repositories/components.js";
import { getProject, updateProject } from "../../db/repositories/projects.js";
import { draft } from "../../motion/templates/helper.js";
import type { ToolContext, ToolResult } from "./registry.js";

/** Human-readable easing label for summaries. */
function describeEasing(easing: Easing): string {
  if (easing.type === "preset") return easing.name;
  if (easing.type === "bezier") return `bezier(${easing.p1.join(",")},${easing.p2.join(",")})`;
  return `spring(stiffness=${easing.stiffness},damping=${easing.damping},mass=${easing.mass})`;
}

function ok(summary: string, specChanged = true, data?: unknown): ToolResult {
  return { ok: true, summary, specChanged, data };
}
function fail(summary: string): ToolResult {
  return { ok: false, summary, specChanged: false };
}

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

export const motionExecutors: Partial<Record<ToolName, Executor>> = {
  set_easing: (args, ctx) => {
    const componentId = String(args.componentId);
    const easing = args.easing as Easing;
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    patchComponent(ctx.projectId, componentId, { easing });
    return ok(`set easing of "${current.name}" to ${describeEasing(easing)}`);
  },

  set_spring: (args, ctx) => {
    const componentId = String(args.componentId);
    const stiffness = Number(args.stiffness);
    const damping = Number(args.damping);
    const mass = Number(args.mass ?? 1);
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    patchComponent(ctx.projectId, componentId, { easing: easingSpring(stiffness, damping, mass) });
    return ok(`set "${current.name}" to a spring (stiffness=${stiffness}, damping=${damping})`);
  },

  set_duration: (args, ctx) => {
    const componentId = String(args.componentId);
    const durationMs = Number(args.durationMs);
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    patchComponent(ctx.projectId, componentId, { durationMs });
    return ok(`set duration of "${current.name}" to ${durationMs}ms`);
  },

  set_delay: (args, ctx) => {
    const componentId = String(args.componentId);
    const delayMs = Number(args.delayMs);
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    patchComponent(ctx.projectId, componentId, { delayMs });
    return ok(`set delay of "${current.name}" to ${delayMs}ms`);
  },

  set_loop: (args, ctx) => {
    const componentId = String(args.componentId);
    const iterationCount = args.iterationCount as number | "infinite";
    const direction = args.direction as ComponentPatch["direction"];
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    patchComponent(ctx.projectId, componentId, { iterationCount, direction });
    const loopLabel = iterationCount === "infinite" ? "loop forever" : `repeat ${iterationCount} times`;
    return ok(`set "${current.name}" to ${loopLabel}`);
  },

  set_fill_mode: (args, ctx) => {
    const componentId = String(args.componentId);
    const fillMode = args.fillMode as ComponentPatch["fillMode"];
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    patchComponent(ctx.projectId, componentId, { fillMode });
    return ok(`set fill mode of "${current.name}" to ${fillMode}`);
  },

  set_color: (args, ctx) => {
    const componentId = String(args.componentId);
    const color = String(args.color);
    const target = (args.target ?? "text") as "text" | "background";
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    const style = { ...current.style };
    if (target === "text") style.color = color;
    else style.backgroundColor = color;
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`set ${target} color of "${current.name}" to ${color}`);
  },

  set_static_style: (args, ctx) => {
    const componentId = String(args.componentId);
    const incoming = args.style as Record<string, string | number>;
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    const style = { ...current.style, ...incoming };
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`updated static style of "${current.name}" (${Object.keys(incoming).join(", ")})`);
  },

  set_transform: (args, ctx) => {
    const componentId = String(args.componentId);
    const property = args.property as TransformProperty;
    const inputFrames = args.keyframes as { offset: number; value: string | number; easing?: Easing }[];
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    const keyframes: Keyframe[] = inputFrames.map((f) => ({
      offset: f.offset,
      properties: { [property]: f.value } as Keyframe["properties"],
      easing: f.easing,
    }));
    patchComponent(ctx.projectId, componentId, { keyframes });
    return ok(`set ${property} track of "${current.name}" (${keyframes.length} keyframes)`);
  },

  set_keyframe: (args, ctx) => {
    const componentId = String(args.componentId);
    const property = args.property as TransformProperty;
    const offset = Number(args.offset);
    const value = args.value as string | number;
    const easing = args.easing as Easing | undefined;
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    const keyframes = [...current.keyframes];
    const existing = keyframes.find((k) => Math.abs(k.offset - offset) < 1e-6);
    if (existing) {
      existing.properties = { ...existing.properties, [property]: value };
      if (easing) existing.easing = easing;
    } else {
      keyframes.push({
        offset,
        properties: { [property]: value } as Keyframe["properties"],
        easing,
      });
      keyframes.sort((a, b) => a.offset - b.offset);
    }
    patchComponent(ctx.projectId, componentId, { keyframes });
    return ok(`set ${property} at offset ${offset} on "${current.name}"`);
  },

  set_global_timing: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const totalDurationMs = args.totalDurationMs != null ? Number(args.totalDurationMs) : undefined;
    updateProject(ctx.projectId, {
      globalTiming: { ...project.globalTiming, totalDurationMs },
    });
    return ok(`set project total duration to ${totalDurationMs ?? "auto"}ms`);
  },

  add_layer: (args, ctx) => {
    const name = String(args.name);
    const selector = args.selector ? String(args.selector) : null;
    const sceneId = args.sceneId ? String(args.sceneId) : null;
    const ts = now();
    const d = draft(name, { selector, sceneId });
    const component: MotionComponent = {
      ...d,
      id: createId("c_"),
      projectId: ctx.projectId,
      templateId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    return ok(`added layer "${name}" (${component.id})`, true, { componentId: component.id });
  },

  remove_component: (args, ctx) => {
    const componentId = String(args.componentId);
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    deleteComponent(ctx.projectId, componentId);
    return ok(`removed layer "${current.name}"`);
  },

  add_scene: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const name = String(args.name);
    const durationMs = args.durationMs != null ? Number(args.durationMs) : undefined;
    const scene = { id: createId("s_"), name, durationMs };
    updateProject(ctx.projectId, { scenes: [...project.scenes, scene] });
    return ok(`added scene "${name}" (${scene.id})`, true, { sceneId: scene.id });
  },
};
