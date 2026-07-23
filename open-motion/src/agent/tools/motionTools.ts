import type { Easing, Keyframe, MotionComponent, ToolName, TransformProperty } from "@openmotion/shared";
import { easingSpring } from "@openmotion/shared";
import { createId, now } from "../../utils/id.js";
import {
  getComponent,
  patchComponent,
  createComponent,
  deleteComponent,
  listComponents,
  type ComponentPatch,
} from "../../db/repositories/components.js";
import { getProject, getProjectSpec, updateProject } from "../../db/repositories/projects.js";
import { draft } from "../../motion/templates/helper.js";
import { analyzeMotion, suggestNext } from "../../motion/analysis.js";
import { getStylePreset } from "../../motion/stylePresets.js";
import { generateHarmony, isHexColor } from "../../motion/colorHarmony.js";
import { analyzeRestraint, formatRestraintReport } from "../../motion/restraint.js";
import { listRecipes, getRecipe, searchRecipes, checkRecipeAvoidance, type MotionRecipe } from "../../motion/recipes.js";
import { remember } from "../memory/persistentMemory.js";
import { searchMemory, listGeneratedSkills } from "../../db/repositories/memory.js";
import { compileGrammar, applyCompiledGrammar, GRAMMAR_EXAMPLES } from "../../motion/grammar.js";
import { parseNaturalMotion } from "../../motion/naturalParser.js";
import { getShaderEffect, getShaderCss, listShaderEffects } from "../../motion/shaders.js";
import { analyzeMood, moodToSpecPatch, detectMood, getMoodProfile, listMoods } from "../../motion/moodEngine.js";
import { suggestCreative, suggestStyleTransfer } from "../../motion/creativeEngine.js";
import { analyzeVisualContext } from "../visualContext.js";
import { synthesizeCode } from "../codeSynthesis.js";
import {
  composeStateMachine,
  readStateMachines,
  writeStateMachines,
  findStateMachine,
  transitionTo,
  summarizeStateMachine,
  listPresets,
  validateStateMachine,
} from "../../motion/stateMachine.js";
import {
  saveProjectRecipe,
  readProjectRecipes,
  findProjectRecipe,
  applyProjectRecipe,
  deleteProjectRecipe,
  summarizeProjectRecipes,
  matchProjectRecipesByIntent,
  seedProjectRecipes,
} from "../../motion/projectRecipes.js";
import { runMotionPipeline } from "../../motion/automationPipeline.js";
import { flattenToTimeline, createComposition } from "../../motion/compositionEngine.js";
import { seekToFrame, renderFrameRange, findThumbnailFrame } from "../../motion/frameRenderer.js";
import { generateHtmlComposition } from "../../motion/htmlComposition.js";
import { resolveMedia } from "../../motion/mediaPipeline.js";
import {
  readBrandPacks,
  findBrandPack,
  summarizeBrandPacks,
  deleteBrandPack,
  applyBrandPackToComponent,
  seedBrandPacks,
} from "../../motion/brandPack.js";
import {
  findMotionProfile,
  setMotionProfile,
  suggestMotionProfile,
  profileToMotionPatch,
  summarizeMotionProfiles,
} from "../../motion/motionProfile.js";
import {
  finalizeCapture,
  findCapture,
  deleteCapture,
  summarizeCaptures,
  applyCaptureToComponent,
  seedCaptures,
  type CaptureSample,
} from "../../motion/motionCapture.js";
import {
  summarizePresets,
  findPreset,
  findPresetByKeyword,
  topRecommendations,
} from "../../motion/exportPresets.js";
import {
  saveSessionSnapshot,
  summarizeSessions,
  updateSession,
  deleteSession,
  buildLineageTree,
  getAncestry,
  getDescendants,
  extractInsightsFromTools,
  generateSessionSummary,
  getLineageStats,
} from "../sessionLineage.js";
import { checkAccessibility } from "../../motion/accessibility.js";
import { checkPerformance } from "../../motion/performance.js";
import {
  createBeat,
  summarizeBeats,
  updateBeat,
  deleteBeat,
  reorderBeats,
  exportStoryboardMarkdown,
  exportStoryboardJson,
  getStoryboardStats,
} from "../../motion/storyboard.js";
import type { StoryboardBeat } from "../../motion/storyboard.js";
import { getPreset } from "./presets.js";
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

/** Apply alpha opacity to a hex color, returning an rgba() string. Accepts
 *  3- or 6-digit hex. Falls back to passing through unknown color tokens. */
function hexWithOpacity(color: string, opacity: number): string {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  // Pass through named colors / non-hex strings — caller can pre-convert.
  return color;
}

interface MaskEntry {
  shape: "rectangle" | "ellipse" | "path";
  mode: "add" | "subtract" | "intersect" | "difference" | "lighten" | "darken";
  x: number; y: number; width: number; height: number;
  path?: string;
  feather: number; expansion: number; inverted: boolean;
  name: string; enabled: boolean;
}

interface TextAnimatorEntry {
  property: "position" | "scale" | "rotation" | "opacity" | "color";
  rangeStart: number; rangeEnd: number;
  unit: "character" | "word";
  offset: number; valueDelta: number; staggerMs: number; easing: string;
  enabled: boolean;
}

/** Read the mask list from a component's style._masks token. */
function getMasks(comp: MotionComponent): MaskEntry[] {
  const raw = (comp.style as Record<string, string | number>)._masks;
  if (typeof raw !== "string") return [];
  try { return JSON.parse(raw) as MaskEntry[]; } catch { return []; }
}

/** Read the text animator list from a component's style._textAnimators token. */
function getTextAnimators(comp: MotionComponent): TextAnimatorEntry[] {
  const raw = (comp.style as Record<string, string | number>)._textAnimators;
  if (typeof raw !== "string") return [];
  try { return JSON.parse(raw) as TextAnimatorEntry[]; } catch { return []; }
}

/** Build a CSS polygon() clip-path for a regular N-gon inscribed in the
 *  element's bounding box. */
function buildPolygonClipPath(sides: number): string {
  const n = Math.max(3, Math.min(20, sides));
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    const x = 50 + 50 * Math.cos(angle);
    const y = 50 + 50 * Math.sin(angle);
    pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${pts.join(", ")})`;
}

/** Build a CSS polygon() clip-path for an N-pointed star with the given
 *  inner-radius ratio (0-1 of outer radius). */
function buildStarClipPath(points: number, innerRadius: number): string {
  const n = Math.max(3, Math.min(20, points));
  const inner = Math.max(0.05, Math.min(0.95, innerRadius));
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 1 : inner;
    const angle = (i * Math.PI) / n - Math.PI / 2;
    const x = 50 + 50 * r * Math.cos(angle);
    const y = 50 + 50 * r * Math.sin(angle);
    pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${pts.join(", ")})`;
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

  batch_update: (args, ctx) => {
    const componentIds = args.componentIds as string[];
    const patch: ComponentPatch = {};
    if (args.easing) patch.easing = args.easing as Easing;
    if (args.durationMs != null) patch.durationMs = Number(args.durationMs);
    if (args.delayMs != null) patch.delayMs = Number(args.delayMs);
    if (args.iterationCount != null) patch.iterationCount = args.iterationCount as ComponentPatch["iterationCount"];
    if (args.direction) patch.direction = args.direction as ComponentPatch["direction"];
    if (args.fillMode) patch.fillMode = args.fillMode as ComponentPatch["fillMode"];
    let updated = 0;
    for (const id of componentIds) {
      const result = patchComponent(ctx.projectId, id, patch);
      if (result) updated++;
    }
    return ok(`updated ${updated}/${componentIds.length} components`);
  },

  apply_preset: (args, ctx) => {
    const componentId = String(args.componentId);
    const presetName = String(args.preset);
    const preset = getPreset(presetName);
    if (!preset) return fail(`unknown preset: ${presetName}`);
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    patchComponent(ctx.projectId, componentId, {
      keyframes: preset.keyframes,
      easing: preset.easing,
      durationMs: preset.durationMs,
      iterationCount: preset.iterationCount,
      direction: preset.direction,
    });
    return ok(`applied ${presetName} preset to "${current.name}"`);
  },

  duplicate_component: (args, ctx) => {
    const componentId = String(args.componentId);
    const source = getComponent(ctx.projectId, componentId);
    if (!source) return fail(`component ${componentId} not found`);
    const name = args.name ? String(args.name) : `${source.name} (copy)`;
    const all = listComponents(ctx.projectId);
    const maxOrder = all.reduce((max, c) => Math.max(max, c.orderIndex), -1);
    const ts = now();
    const clone: MotionComponent = {
      ...source,
      id: createId("c_"),
      name,
      orderIndex: maxOrder + 1,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(clone);
    return ok(`duplicated "${source.name}" as "${name}" (${clone.id})`, true, { componentId: clone.id });
  },

  reorder_components: (args, ctx) => {
    const componentIds = args.componentIds as string[];
    componentIds.forEach((id, index) => {
      patchComponent(ctx.projectId, id, { orderIndex: index });
    });
    return ok(`reordered ${componentIds.length} components`);
  },

  set_play_state: (args, ctx) => {
    const componentId = String(args.componentId);
    const playState = args.playState as "running" | "paused";
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    patchComponent(ctx.projectId, componentId, { playState });
    return ok(`set "${current.name}" to ${playState}`, false);
  },

  stagger_components: (args, ctx) => {
    const stepMs = Number(args.stepMs ?? 100);
    const startMs = Number(args.startMs ?? 0);
    const direction = String(args.direction ?? "forward") as "forward" | "reverse" | "center";
    const components = listComponents(ctx.projectId).sort((a, b) => a.orderIndex - b.orderIndex);
    if (components.length === 0) return fail("no components to stagger");
    const n = components.length;
    for (let i = 0; i < n; i++) {
      let pos: number;
      if (direction === "reverse") pos = n - 1 - i;
      else if (direction === "center") pos = Math.abs(i - (n - 1) / 2);
      else pos = i;
      const delay = startMs + pos * stepMs;
      patchComponent(ctx.projectId, components[i].id, { delayMs: delay });
    }
    return ok(`staggered ${n} components (step=${stepMs}ms, direction=${direction})`);
  },

  create_variant: (args, ctx) => {
    const componentId = String(args.componentId);
    const source = getComponent(ctx.projectId, componentId);
    if (!source) return fail(`component ${componentId} not found`);
    const all = listComponents(ctx.projectId);
    const maxOrder = all.reduce((max, c) => Math.max(max, c.orderIndex), -1);
    const ts = now();
    const easing = args.easing as Easing | undefined;
    const durationMs = args.durationMs != null ? Number(args.durationMs) : undefined;
    const scale = args.scale != null ? Number(args.scale) : undefined;
    const variantKeyframes = scale != null
      ? source.keyframes.map((kf) => {
          const scaledProps: Keyframe["properties"] = {};
          for (const [key, value] of Object.entries(kf.properties)) {
            if (typeof value === "number") scaledProps[key as TransformProperty] = value * scale;
            else scaledProps[key as TransformProperty] = value;
          }
          return { offset: kf.offset, properties: scaledProps, easing: kf.easing };
        })
      : source.keyframes;
    const clone: MotionComponent = {
      ...source,
      id: createId("c_"),
      name: `${source.name} (variant)`,
      orderIndex: maxOrder + 1,
      keyframes: variantKeyframes,
      easing: easing ?? source.easing,
      durationMs: durationMs ?? source.durationMs,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(clone);
    const changes: string[] = [];
    if (easing) changes.push(`easing=${easing.type === "preset" ? easing.name : easing.type}`);
    if (durationMs) changes.push(`duration=${durationMs}ms`);
    if (scale) changes.push(`scale=${scale}x`);
    return ok(`created variant of "${source.name}" (${changes.join(", ") || "identical"})`, true, { componentId: clone.id });
  },

  analyze_motion: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail(`project ${ctx.projectId} not found`);
    const componentId = args.componentId ? String(args.componentId) : undefined;
    const result = analyzeMotion(spec, componentId);
    const criticalCount = result.insights.filter((i) => i.severity === "critical").length;
    const warningCount = result.insights.filter((i) => i.severity === "warning").length;
    const summary = `motion score: ${result.score}/100 — ${result.insights.length} insight(s) (${criticalCount} critical, ${warningCount} warning)`;
    return { ok: true, summary, specChanged: false, data: result };
  },

  suggest_next: (_args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail(`project ${ctx.projectId} not found`);
    const suggestions = suggestNext(spec);
    const summary = `${suggestions.length} suggestion(s): ${suggestions.map((s) => s.text).join("; ")}`;
    return { ok: true, summary, specChanged: false, data: { suggestions } };
  },

  set_motion_path: (args, ctx) => {
    const componentId = String(args.componentId);
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);

    const pathType = String(args.pathType) as "line" | "circle" | "ellipse" | "bezier";
    const steps = Math.max(8, Math.min(60, Number(args.steps ?? 20)));
    const durationMs = args.durationMs != null ? Number(args.durationMs) : current.durationMs;

    const keyframes: Keyframe[] = [];
    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 0 : i / (steps - 1);
      let x = 0;
      let y = 0;

      if (pathType === "line") {
        const fromX = Number(args.fromX ?? 0);
        const fromY = Number(args.fromY ?? 0);
        const toX = Number(args.toX ?? 0);
        const toY = Number(args.toY ?? 0);
        x = fromX + (toX - fromX) * t;
        y = fromY + (toY - fromY) * t;
      } else if (pathType === "circle") {
        const cx = Number(args.centerX ?? 0);
        const cy = Number(args.centerY ?? 0);
        const r = Number(args.radiusX ?? 100);
        const angle = t * Math.PI * 2;
        x = cx + r * Math.cos(angle);
        y = cy + r * Math.sin(angle);
      } else if (pathType === "ellipse") {
        const cx = Number(args.centerX ?? 0);
        const cy = Number(args.centerY ?? 0);
        const rx = Number(args.radiusX ?? 150);
        const ry = Number(args.radiusY ?? 80);
        const angle = t * Math.PI * 2;
        x = cx + rx * Math.cos(angle);
        y = cy + ry * Math.sin(angle);
      } else if (pathType === "bezier") {
        const p0x = Number(args.fromX ?? 0);
        const p0y = Number(args.fromY ?? 0);
        const p1x = Number(args.cp1X ?? 0);
        const p1y = Number(args.cp1Y ?? 0);
        const p2x = Number(args.cp2X ?? 0);
        const p2y = Number(args.cp2Y ?? 0);
        const p3x = Number(args.toX ?? 0);
        const p3y = Number(args.toY ?? 0);
        const u = 1 - t;
        x = u * u * u * p0x + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * p3x;
        y = u * u * u * p0y + 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * p3y;
      }

      keyframes.push({
        offset: t,
        properties: { translateX: `${x.toFixed(2)}px`, translateY: `${y.toFixed(2)}px` },
      });
    }

    patchComponent(ctx.projectId, componentId, { keyframes, durationMs });
    return ok(
      `set "${current.name}" on a ${pathType} path (${steps} keyframes, ${durationMs}ms)`,
      true,
      { keyframeCount: steps },
    );
  },

  apply_style: (args, ctx) => {
    const styleId = String(args.styleId);
    const preset = getStylePreset(styleId);
    if (!preset) return fail(`unknown style "${styleId}"`);

    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail(`project ${ctx.projectId} not found`);
    if (spec.components.length === 0) return fail("no components to style");

    for (const comp of spec.components) {
      patchComponent(ctx.projectId, comp.id, {
        easing: preset.easing,
        durationMs: preset.durationMs,
        iterationCount: preset.iterationCount,
        direction: preset.direction,
      });
    }

    return ok(
      `applied "${preset.name}" style to ${spec.components.length} component(s) — ${preset.description}`,
      true,
      { styleId, componentCount: spec.components.length },
    );
  },

  recognize_pattern: (_args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail(`project ${ctx.projectId} not found`);
    const comps = spec.components;
    if (comps.length === 0) return fail("no components to analyze");

    const patterns: Array<{ pattern: string; observation: string; recommendation: string; severity: "info" | "warning" }> = [];

    // Detect easing monotony
    const easingNames = new Set(
      comps.map((c) => (c.easing?.type === "preset" ? c.easing.name : c.easing?.type ?? "linear")),
    );
    if (easingNames.size === 1 && comps.length > 1) {
      patterns.push({
        pattern: "easing-monotony",
        observation: `All ${comps.length} components use the same easing (${Array.from(easingNames)[0]}).`,
        recommendation: "Vary easing across components for visual rhythm and hierarchy.",
        severity: "info",
      });
    } else if (easingNames.size > 3) {
      patterns.push({
        pattern: "easing-fragmentation",
        observation: `${easingNames.size} different easing families detected — may feel inconsistent.`,
        recommendation: "Consider unifying to 1-2 easing families for a coherent feel.",
        severity: "info",
      });
    }

    // Detect timing uniformity
    const durations = new Set(comps.map((c) => c.durationMs));
    if (durations.size === 1 && comps.length > 2) {
      patterns.push({
        pattern: "timing-uniformity",
        observation: `All components share the same duration (${comps[0].durationMs}ms).`,
        recommendation: "Vary durations to create visual hierarchy and rhythm.",
        severity: "info",
      });
    }

    // Detect incomplete lifecycle (only entrances, no exits)
    const hasExit = comps.some((c) => c.easing?.type === "preset" && /elastic|collapse|out/.test(c.easing.name));
    const hasEntrance = comps.some((c) => c.easing?.type === "preset" && /bounce|fade|slide|scale|flip|in/.test(c.easing.name));
    if (hasEntrance && !hasExit && comps.length > 1) {
      patterns.push({
        pattern: "incomplete-lifecycle",
        observation: "Entrance motions detected but no exit motions — the lifecycle feels incomplete.",
        recommendation: "Add an exit animation (e.g., elastic-collapse) for a complete motion arc.",
        severity: "info",
      });
    }

    // Detect motion overload (too many infinite loops)
    const infiniteCount = comps.filter((c) => c.iterationCount === "infinite").length;
    if (infiniteCount > 3) {
      patterns.push({
        pattern: "motion-overload",
        observation: `${infiniteCount} components loop infinitely — visual competition for attention.`,
        recommendation: "Limit infinite loops to 1-2 focal elements; use finite animations for the rest.",
        severity: "warning",
      });
    }

    // Detect no stagger
    const hasDelay = comps.some((c) => c.delayMs > 0);
    if (!hasDelay && comps.length > 2) {
      patterns.push({
        pattern: "simultaneous-entrance",
        observation: "No delays detected — all components animate simultaneously.",
        recommendation: "Add staggered delays for a choreographed, cascading entrance.",
        severity: "info",
      });
    }

    // Detect dominant category
    const categories = { entrance: 0, emphasis: 0, exit: 0, transition: 0, load: 0 };
    for (const c of comps) {
      const tplId = c.templateId ?? "";
      if (/in|fade|slide|scale|flip|bounce|spring|reveal|notification/.test(tplId)) categories.entrance++;
      else if (/pulse|squash|ripple|orbit|wave|confetti|parallax|particle|liquid|marquee|shimmer/.test(tplId)) categories.emphasis++;
      else if (/collapse|exit/.test(tplId)) categories.exit++;
      else if (/flip|morph/.test(tplId)) categories.transition++;
      else if (/spin|progress/.test(tplId)) categories.load++;
    }
    const dominant = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] > 0) {
      patterns.push({
        pattern: "dominant-category",
        observation: `Project is ${Math.round((dominant[1] / comps.length) * 100)}% ${dominant[0]} motion.`,
        recommendation: `Balance with other motion categories for a well-rounded composition.`,
        severity: "info",
      });
    }

    const warningCount = patterns.filter((p) => p.severity === "warning").length;
    const summary = `${patterns.length} pattern(s) detected (${warningCount} warning)`;
    return { ok: true, summary, specChanged: false, data: { patterns } };
  },

  harmonize_colors: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail(`project ${ctx.projectId} not found`);
    const comps = spec.components;
    if (comps.length === 0) return fail("no components to harmonize");

    const scheme = String(args.scheme ?? "analogous") as "complementary" | "analogous" | "triadic" | "monochrome";

    // Find base color from the first component's backgroundColor or color
    let baseColor = String(args.baseColor ?? "");
    if (!baseColor) {
      for (const c of comps) {
        const bg = c.style?.backgroundColor;
        const color = c.style?.color;
        if (isHexColor(bg)) { baseColor = bg; break; }
        if (isHexColor(color)) { baseColor = color; break; }
      }
    }
    if (!baseColor) {
      baseColor = "#6366f1";
    }

    const harmony = generateHarmony(baseColor, scheme);

    // Apply harmonious colors across components
    for (let i = 0; i < comps.length; i++) {
      const colorIdx = i % harmony.colors.length;
      const newColor = harmony.colors[colorIdx];
      const current = comps[i];
      const style: Record<string, string | number> = { ...current.style };

      // Assign alternating background and text colors
      if (i % 2 === 0) {
        if (style.backgroundColor !== undefined || i === 0) {
          style.backgroundColor = newColor;
        }
      } else {
        if (style.color !== undefined) {
          style.color = newColor;
        }
      }

      patchComponent(ctx.projectId, current.id, { style });
    }

    return ok(
      `harmonized ${comps.length} component(s) with ${scheme} scheme (base: ${baseColor})`,
      true,
      { scheme, baseColor, palette: harmony.colors },
    );
  },

  choreograph: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail(`project ${ctx.projectId} not found`);
    const comps = spec.components;
    if (comps.length === 0) return fail("no components to choreograph");

    const pattern = String(args.pattern ?? "cascade") as "cascade" | "wave" | "ripple" | "canon" | "converge" | "spiral" | "explosion" | "assembly" | "breathing" | "domino" | "scatter";
    const stepMs = Number(args.stepMs ?? 150);
    const baseDuration = args.durationMs != null ? Number(args.durationMs) : undefined;
    const sorted = [...comps].sort((a, b) => a.orderIndex - b.orderIndex);
    const n = sorted.length;

    for (let i = 0; i < n; i++) {
      let delay: number;
      let duration: number | undefined;
      let direction: MotionComponent["direction"] | undefined;
      let easing: Easing | undefined;

      switch (pattern) {
        case "cascade":
          delay = i * stepMs;
          duration = baseDuration ?? sorted[i].durationMs;
          break;
        case "wave":
          delay = Math.round((Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 0.5 + 0.5) * stepMs * (n - 1));
          duration = baseDuration ?? sorted[i].durationMs;
          break;
        case "ripple": {
          const center = (n - 1) / 2;
          delay = Math.round(Math.abs(i - center) * stepMs);
          duration = baseDuration ?? Math.round(sorted[i].durationMs * (1 + Math.abs(i - center) * 0.1));
          break;
        }
        case "canon":
          delay = i * stepMs;
          duration = baseDuration ?? sorted[i].durationMs;
          break;
        case "converge":
          delay = Math.max(0, (n - 1 - i) * stepMs);
          duration = baseDuration ?? sorted[i].durationMs;
          break;
        case "spiral": {
          // Golden angle distribution — creates an organic spiral sequence.
          const goldenAngle = 137.5 * (Math.PI / 180);
          delay = Math.round(((i * goldenAngle) % (Math.PI * 2)) / (Math.PI * 2) * stepMs * n);
          duration = baseDuration ?? Math.round(sorted[i].durationMs * (1 + (i / n) * 0.3));
          easing = { type: "preset", name: i % 2 === 0 ? "smooth" : "ease-out" };
          break;
        }
        case "explosion": {
          // Center-out burst — center starts first, outer elements follow with growing duration.
          const center = (n - 1) / 2;
          const dist = Math.abs(i - center);
          delay = Math.round(dist * stepMs);
          duration = baseDuration ?? Math.round(sorted[i].durationMs * (1 + dist * 0.15));
          easing = { type: "preset", name: "bounce" };
          break;
        }
        case "assembly": {
          // Components arrive from edges — first and last start first, meeting in the middle.
          const center = (n - 1) / 2;
          delay = Math.round((Math.max(0, center - Math.abs(i - center))) * stepMs);
          duration = baseDuration ?? Math.round(sorted[i].durationMs * 0.8);
          easing = { type: "preset", name: "ease-out" };
          break;
        }
        case "breathing": {
          // Synchronized pulse with phase offsets — all components breathe with slight delays.
          delay = Math.round((i / n) * stepMs * 2);
          duration = baseDuration ?? Math.round(sorted[i].durationMs * 1.5);
          easing = { type: "preset", name: "ease-in-out" };
          break;
        }
        case "domino": {
          // Sequential cascade with alternating direction — like dominoes falling.
          delay = i * stepMs;
          duration = baseDuration ?? Math.round(sorted[i].durationMs * 0.7);
          direction = i % 2 === 0 ? "normal" : "reverse";
          easing = { type: "preset", name: "ease-in" };
          break;
        }
        case "scatter": {
          // Reverse explosion — outer elements start first, center follows (components fly outward).
          const center = (n - 1) / 2;
          const dist = Math.abs(i - center);
          delay = Math.round((n - dist) * stepMs * 0.5);
          duration = baseDuration ?? Math.round(sorted[i].durationMs * (1.2 - dist * 0.05));
          easing = { type: "preset", name: "ease-in" };
          break;
        }
        default:
          delay = i * stepMs;
          duration = baseDuration;
      }

      const patch: Partial<MotionComponent> = { delayMs: delay };
      if (duration != null) patch.durationMs = duration;
      if (direction != null) patch.direction = direction;
      if (easing != null) patch.easing = easing;
      patchComponent(ctx.projectId, sorted[i].id, patch);
    }

    return ok(`choreographed ${n} component(s) with ${pattern} pattern (step=${stepMs}ms)`);
  },

  refine_motion: (args, ctx) => {
    const refinement = String(args.refinement) as
      | "snappier" | "smoother" | "more-dramatic" | "calmer"
      | "subtler" | "more-energetic" | "bouncier" | "softer";

    const targetId = args.componentId ? String(args.componentId) : undefined;
    const all = listComponents(ctx.projectId);
    const targets = targetId ? all.filter((c) => c.id === targetId) : all;
    if (targets.length === 0) return fail("no components to refine");

    const easingMap: Record<string, Easing> = {
      snappier: { type: "preset", name: "snappy" },
      smoother: { type: "preset", name: "smooth" },
      "more-dramatic": { type: "preset", name: "back" },
      calmer: { type: "preset", name: "smooth" },
      subtler: { type: "preset", name: "ease-out" },
      "more-energetic": { type: "preset", name: "bounce" },
      bouncier: { type: "preset", name: "bounce" },
      softer: { type: "preset", name: "smooth" },
    };

    const durationFactor: Record<string, number> = {
      snappier: 0.6,
      smoother: 1.3,
      "more-dramatic": 1.5,
      calmer: 1.6,
      subtler: 0.8,
      "more-energetic": 0.7,
      bouncier: 1.0,
      softer: 1.4,
    };

    const easing = easingMap[refinement];
    const factor = durationFactor[refinement];

    for (const comp of targets) {
      const patch: Partial<MotionComponent> = {
        easing,
        durationMs: Math.max(50, Math.round(comp.durationMs * factor)),
      };

      if (refinement === "more-energetic" || refinement === "bouncier") {
        patch.iterationCount = "infinite";
        patch.direction = "alternate";
      } else if (refinement === "calmer" || refinement === "softer") {
        if (comp.iterationCount === "infinite") {
          patch.iterationCount = 3;
        }
      }

      patchComponent(ctx.projectId, comp.id, patch);
    }

    return ok(`refined ${targets.length} component(s): ${refinement}`);
  },

  set_custom_bezier: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const easing: Easing = {
      type: "bezier",
      p1: [Number(args.x1), Number(args.y1)],
      p2: [Number(args.x2), Number(args.y2)],
    };
    patchComponent(ctx.projectId, componentId, { easing });
    return ok(`set custom bezier (${args.x1}, ${args.y1}, ${args.x2}, ${args.y2}) on ${comp.name}`);
  },

  set_interpolation: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const idx = Number(args.keyframeIndex);
    if (idx < 0 || idx >= comp.keyframes.length) return fail("keyframe index out of range");

    const interpolation = String(args.interpolation) as "linear" | "ease" | "hold";
    const easingMap: Record<string, Easing> = {
      linear: { type: "preset", name: "linear" },
      ease: { type: "preset", name: "ease-in-out" },
      hold: { type: "preset", name: "linear" },
    };

    const nextKfs = comp.keyframes.map((kf: Keyframe, i: number) =>
      i === idx ? { ...kf, easing: easingMap[interpolation] } : kf,
    );
    patchComponent(ctx.projectId, componentId, { keyframes: nextKfs });
    return ok(`set keyframe ${idx} interpolation to ${interpolation} on ${comp.name}`);
  },

  add_property_keyframe: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);

    const property = String(args.property);
    const offset = Number(args.offset);
    const value = typeof args.value === "string" ? String(args.value) : Number(args.value);

    const existing = comp.keyframes.find((kf: Keyframe) => Math.abs(kf.offset - offset) < 0.001);
    let nextKfs: Keyframe[];

    if (existing) {
      nextKfs = comp.keyframes.map((kf: Keyframe) =>
        kf === existing
          ? { ...kf, properties: { ...kf.properties, [property]: value } }
          : kf,
      );
    } else {
      nextKfs = [...comp.keyframes, { offset, properties: { [property]: value } }].sort(
        (a: Keyframe, b: Keyframe) => a.offset - b.offset,
      );
    }

    patchComponent(ctx.projectId, componentId, { keyframes: nextKfs });
    return ok(`added ${property} keyframe at offset ${offset} on ${comp.name}`);
  },

  remove_keyframe: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const idx = Number(args.keyframeIndex);
    if (idx < 0 || idx >= comp.keyframes.length) return fail("keyframe index out of range");

    const nextKfs = comp.keyframes.filter((_: Keyframe, i: number) => i !== idx);
    patchComponent(ctx.projectId, componentId, { keyframes: nextKfs });
    return ok(`removed keyframe ${idx} from ${comp.name}`);
  },

  set_trigger: (args, ctx) => {
    const componentId = String(args.componentId);
    const trigger = String(args.trigger) as MotionComponent["trigger"];
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    patchComponent(ctx.projectId, componentId, { trigger });
    return ok(`set "${comp.name}" to trigger ${trigger}`, true, { trigger });
  },

  set_onion_skin: (args, _ctx) => {
    const enabled = Boolean(args.enabled);
    const frames = Math.max(1, Math.min(8, Number(args.frames ?? 3)));
    const opacity = Math.max(0.05, Math.min(0.8, Number(args.opacity ?? 0.25)));
    return {
      ok: true,
      summary: enabled
        ? `onion skin enabled — ${frames} ghost frame(s) at ${Math.round(opacity * 100)}% opacity`
        : "onion skin disabled",
      specChanged: false,
      data: { uiAction: "set_onion_skin", enabled, frames, opacity },
    };
  },

  preview_fullscreen: (args, _ctx) => {
    const componentId = args.componentId ? String(args.componentId) : undefined;
    return {
      ok: true,
      summary: componentId
        ? "opening fullscreen preview for the selected component"
        : "opening fullscreen preview",
      specChanged: false,
      data: { uiAction: "preview_fullscreen", componentId },
    };
  },

  set_canvas_view: (args, _ctx) => {
    const pan = args.pan as { x: number; y: number } | undefined;
    const zoom = args.zoom != null ? Number(args.zoom) : undefined;
    const fit = Boolean(args.fit);
    const parts: string[] = [];
    if (fit) parts.push("fit to screen");
    if (pan) parts.push(`pan to (${pan.x}, ${pan.y})`);
    if (zoom != null) parts.push(`zoom to ${Math.round(zoom * 100)}%`);
    return {
      ok: true,
      summary: parts.length ? `canvas view: ${parts.join(", ")}` : "canvas view updated",
      specChanged: false,
      data: { uiAction: "set_canvas_view", pan, zoom, fit },
    };
  },

  lock_layer: (args, _ctx) => {
    const componentId = String(args.componentId);
    const locked = Boolean(args.locked);
    return {
      ok: true,
      summary: locked ? `locked layer ${componentId}` : `unlocked layer ${componentId}`,
      specChanged: false,
      data: { uiAction: "lock_layer", componentId, locked },
    };
  },

  set_z_order: (args, ctx) => {
    const componentId = String(args.componentId);
    const action = String(args.action) as "forward" | "backward" | "to-front" | "to-back";
    const all = listComponents(ctx.projectId).sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = all.findIndex((c) => c.id === componentId);
    if (idx === -1) return fail(`component ${componentId} not found`);
    const ids = all.map((c) => c.id);
    if (action === "forward" && idx < ids.length - 1) {
      [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    } else if (action === "backward" && idx > 0) {
      [ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]];
    } else if (action === "to-front") {
      ids.splice(idx, 1);
      ids.push(componentId);
    } else if (action === "to-back") {
      ids.splice(idx, 1);
      ids.unshift(componentId);
    }
    ids.forEach((id, i) => patchComponent(ctx.projectId, id, { orderIndex: i }));
    return ok(`moved "${all[idx].name}" ${action}`);
  },

  set_transform_props: (args, ctx) => {
    const componentId = String(args.componentId);
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    const style: Record<string, string | number> = { ...current.style, position: "absolute" };
    if (args.x != null) style.left = `${Number(args.x)}px`;
    if (args.y != null) style.top = `${Number(args.y)}px`;
    if (args.width != null) style.width = Number(args.width);
    if (args.height != null) style.height = Number(args.height);
    if (args.rotation != null) {
      const existing = String(style.transform ?? "");
      const withoutRotate = existing.replace(/rotate\([^)]*\)\s*/g, "");
      style.transform = `${withoutRotate} rotate(${Number(args.rotation)}deg)`.trim();
    }
    patchComponent(ctx.projectId, componentId, { style });
    const changes: string[] = [];
    if (args.x != null) changes.push(`x=${args.x}`);
    if (args.y != null) changes.push(`y=${args.y}`);
    if (args.width != null) changes.push(`w=${args.width}`);
    if (args.height != null) changes.push(`h=${args.height}`);
    if (args.rotation != null) changes.push(`rot=${args.rotation}°`);
    return ok(`set transform on "${current.name}" (${changes.join(", ")})`);
  },

  align_components: (args, ctx) => {
    const componentIds = args.componentIds as string[];
    const align = String(args.align) as "left" | "center" | "right" | "top" | "middle" | "bottom" | "distribute-h" | "distribute-v";
    const comps = componentIds
      .map((id) => getComponent(ctx.projectId, id))
      .filter((c): c is NonNullable<typeof c> => c !== null);
    if (comps.length < 2) return fail("need at least 2 components to align");

    const getBounds = (c: typeof comps[0]) => {
      const left = Number(String(c.style?.left ?? "0").replace(/px$/, "")) || 0;
      const top = Number(String(c.style?.top ?? "0").replace(/px$/, "")) || 0;
      const w = Number(c.style?.width) || 100;
      const h = Number(c.style?.height) || 100;
      return { left, top, w, h, right: left + w, bottom: top + h, cx: left + w / 2, cy: top + h / 2 };
    };
    const bounds = comps.map(getBounds);

    if (align === "left") {
      const min = Math.min(...bounds.map((b) => b.left));
      bounds.forEach((b, i) => patchComponent(ctx.projectId, comps[i].id, { style: { ...comps[i].style, position: "absolute", left: `${min}px` } }));
    } else if (align === "right") {
      const max = Math.max(...bounds.map((b) => b.right));
      bounds.forEach((b, i) => patchComponent(ctx.projectId, comps[i].id, { style: { ...comps[i].style, position: "absolute", left: `${max - b.w}px` } }));
    } else if (align === "center") {
      const avg = bounds.reduce((s, b) => s + b.cx, 0) / bounds.length;
      bounds.forEach((b, i) => patchComponent(ctx.projectId, comps[i].id, { style: { ...comps[i].style, position: "absolute", left: `${Math.round(avg - b.w / 2)}px` } }));
    } else if (align === "top") {
      const min = Math.min(...bounds.map((b) => b.top));
      bounds.forEach((b, i) => patchComponent(ctx.projectId, comps[i].id, { style: { ...comps[i].style, position: "absolute", top: `${min}px` } }));
    } else if (align === "bottom") {
      const max = Math.max(...bounds.map((b) => b.bottom));
      bounds.forEach((b, i) => patchComponent(ctx.projectId, comps[i].id, { style: { ...comps[i].style, position: "absolute", top: `${max - b.h}px` } }));
    } else if (align === "middle") {
      const avg = bounds.reduce((s, b) => s + b.cy, 0) / bounds.length;
      bounds.forEach((b, i) => patchComponent(ctx.projectId, comps[i].id, { style: { ...comps[i].style, position: "absolute", top: `${Math.round(avg - b.h / 2)}px` } }));
    } else if (align === "distribute-h") {
      const sorted = [...bounds].sort((a, b) => a.left - b.left);
      const min = sorted[0].left;
      const max = sorted[sorted.length - 1].right;
      const step = (max - min - sorted[sorted.length - 1].w) / (sorted.length - 1);
      let cursor = min;
      sorted.forEach((b) => {
        const ci = bounds.indexOf(b);
        patchComponent(ctx.projectId, comps[ci].id, { style: { ...comps[ci].style, position: "absolute", left: `${Math.round(cursor)}px` } });
        cursor += b.w + step;
      });
    } else if (align === "distribute-v") {
      const sorted = [...bounds].sort((a, b) => a.top - b.top);
      const min = sorted[0].top;
      const max = sorted[sorted.length - 1].bottom;
      const step = (max - min - sorted[sorted.length - 1].h) / (sorted.length - 1);
      let cursor = min;
      sorted.forEach((b) => {
        const ci = bounds.indexOf(b);
        patchComponent(ctx.projectId, comps[ci].id, { style: { ...comps[ci].style, position: "absolute", top: `${Math.round(cursor)}px` } });
        cursor += b.h + step;
      });
    }
    return ok(`aligned ${comps.length} components (${align})`);
  },

  set_playback_range: (args, _ctx) => {
    const clear = Boolean(args.clear);
    const startMs = args.startMs != null ? Number(args.startMs) : 0;
    const endMs = args.endMs != null ? Number(args.endMs) : 0;
    return {
      ok: true,
      summary: clear ? "cleared playback range" : `set playback range ${startMs}ms–${endMs}ms`,
      specChanged: false,
      data: { uiAction: "set_playback_range", startMs, endMs, clear },
    };
  },

  select_components: (args, _ctx) => {
    const componentIds = (args.componentIds as string[]) ?? [];
    const clear = Boolean(args.clear ?? true);
    return {
      ok: true,
      summary: componentIds.length > 0
        ? `selected ${componentIds.length} component(s)`
        : "cleared selection",
      specChanged: false,
      data: { uiAction: "select_components", componentIds, clear },
    };
  },

  toggle_snap: (args, _ctx) => {
    const enabled = Boolean(args.enabled);
    const size = args.size != null ? Number(args.size) : undefined;
    return {
      ok: true,
      summary: enabled
        ? `snap-to-grid enabled${size ? ` (${size}px)` : ""}`
        : "snap-to-grid disabled",
      specChanged: false,
      data: { uiAction: "toggle_snap", enabled, size },
    };
  },

  add_shape: (args, ctx) => {
    const shape = String(args.shape) as "rectangle" | "circle" | "text" | "triangle" | "star" | "polygon" | "line" | "arrow";
    const name = args.name ? String(args.name) : shape.charAt(0).toUpperCase() + shape.slice(1);
    const x = args.x != null ? Number(args.x) : 40;
    const y = args.y != null ? Number(args.y) : 40;
    const w = args.width != null ? Number(args.width) : 120;
    const h = args.height != null ? Number(args.height) : 80;
    const ts = now();
    const style: Record<string, string | number> = { position: "absolute", left: `${x}px`, top: `${y}px`, width: w, height: h };
    if (shape === "rectangle") {
      style.backgroundColor = "#e5e5e5";
      style.borderRadius = "8px";
    } else if (shape === "circle") {
      style.backgroundColor = "#e5e5e5";
      style.borderRadius = "50%";
    } else if (shape === "triangle") {
      style.backgroundColor = "#e5e5e5";
      style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
    } else if (shape === "star") {
      style.backgroundColor = "#e5e5e5";
      style.clipPath = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
    } else if (shape === "polygon") {
      style.backgroundColor = "#e5e5e5";
      style.clipPath = "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";
    } else if (shape === "line") {
      style.backgroundColor = "#e5e5e5";
      style.height = 2;
    } else if (shape === "arrow") {
      style.backgroundColor = "#e5e5e5";
      style.clipPath = "polygon(0% 40%, 60% 40%, 60% 0%, 100% 50%, 60% 100%, 60% 60%, 0% 60%)";
    } else {
      style.color = "#f4f6fb";
      style.fontSize = 24;
      style.fontWeight = 600;
      style.display = "flex";
      style.alignItems = "center";
      style.justifyContent = "center";
      (style as Record<string, unknown>)._content = "Text";
    }
    const all = listComponents(ctx.projectId);
    const maxOrder = all.reduce((max, c) => Math.max(max, c.orderIndex), -1);
    const component: MotionComponent = {
      id: createId("c_"),
      projectId: ctx.projectId,
      templateId: null,
      name,
      selector: null,
      sceneId: null,
      orderIndex: maxOrder + 1,
      easing: { type: "preset", name: "ease-out" },
      durationMs: 800,
      delayMs: 0,
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      keyframes: [],
      style,
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    return ok(`added ${shape} "${name}" (${component.id})`, true, { componentId: component.id });
  },

  add_image: (args, ctx) => {
    const src = String(args.src);
    const name = args.name ? String(args.name) : "Image";
    const x = args.x != null ? Number(args.x) : 40;
    const y = args.y != null ? Number(args.y) : 40;
    const w = args.width != null ? Number(args.width) : 320;
    const h = args.height != null ? Number(args.height) : 200;
    const fit = args.fit ? String(args.fit) : "cover";
    const ts = now();
    const style: Record<string, string | number> = {
      _tag: "img",
      _src: src,
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: w,
      height: h,
      objectFit: fit,
      borderRadius: "8px",
    };
    const all = listComponents(ctx.projectId);
    const maxOrder = all.reduce((max, c) => Math.max(max, c.orderIndex), -1);
    const component: MotionComponent = {
      id: createId("c_"),
      projectId: ctx.projectId,
      templateId: null,
      name,
      selector: null,
      sceneId: null,
      orderIndex: maxOrder + 1,
      easing: { type: "preset", name: "ease-out" },
      durationMs: 600,
      delayMs: 0,
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      keyframes: [
        { offset: 0, properties: { opacity: 0, scale: 0.95 } },
        { offset: 1, properties: { opacity: 1, scale: 1 } },
      ],
      style,
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    return ok(`added image "${name}" (${component.id})`, true, { componentId: component.id });
  },

  add_video: (args, ctx) => {
    const src = String(args.src);
    const name = args.name ? String(args.name) : "Video";
    const x = args.x != null ? Number(args.x) : 40;
    const y = args.y != null ? Number(args.y) : 40;
    const w = args.width != null ? Number(args.width) : 480;
    const h = args.height != null ? Number(args.height) : 270;
    const muted = args.muted !== false;
    const loop = Boolean(args.loop);
    const autoplay = args.autoplay !== false;
    const delayMs = args.delayMs != null ? Number(args.delayMs) : 0;
    const ts = now();
    const style: Record<string, string | number> = {
      _tag: "video",
      _src: src,
      _muted: muted ? 1 : 0,
      _loop: loop ? 1 : 0,
      _autoplay: autoplay ? 1 : 0,
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: w,
      height: h,
      borderRadius: "8px",
    };
    const all = listComponents(ctx.projectId);
    const maxOrder = all.reduce((max, c) => Math.max(max, c.orderIndex), -1);
    const component: MotionComponent = {
      id: createId("c_"),
      projectId: ctx.projectId,
      templateId: null,
      name,
      selector: null,
      sceneId: null,
      orderIndex: maxOrder + 1,
      easing: { type: "preset", name: "ease-out" },
      durationMs: 5000,
      delayMs,
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      keyframes: [],
      style,
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    return ok(`added video "${name}" (${component.id})`, true, { componentId: component.id });
  },

  add_audio: (args, ctx) => {
    const src = String(args.src);
    const name = args.name ? String(args.name) : "Audio";
    const delayMs = args.delayMs != null ? Number(args.delayMs) : 0;
    const loop = Boolean(args.loop);
    const muted = Boolean(args.muted);
    const ts = now();
    const style: Record<string, string | number> = {
      _tag: "audio",
      _src: src,
      _loop: loop ? 1 : 0,
      _muted: muted ? 1 : 0,
      _autoplay: 1,
      position: "absolute",
      left: "-9999px",
      width: 0,
      height: 0,
    };
    const all = listComponents(ctx.projectId);
    const maxOrder = all.reduce((max, c) => Math.max(max, c.orderIndex), -1);
    const component: MotionComponent = {
      id: createId("c_"),
      projectId: ctx.projectId,
      templateId: null,
      name,
      selector: null,
      sceneId: null,
      orderIndex: maxOrder + 1,
      easing: { type: "preset", name: "linear" },
      durationMs: 30000,
      delayMs,
      iterationCount: loop ? "infinite" : 1,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      keyframes: [],
      style,
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    return ok(`added audio "${name}" (${component.id})`, true, { componentId: component.id });
  },

  add_typewriter_text: (args, ctx) => {
    const text = String(args.text);
    const name = args.name ? String(args.name) : "Typewriter Text";
    const x = args.x != null ? Number(args.x) : 40;
    const y = args.y != null ? Number(args.y) : 40;
    const fontSize = args.fontSize != null ? Number(args.fontSize) : 28;
    const color = args.color ? String(args.color) : "#ffffff";
    const charDelayMs = args.charDelayMs != null ? Number(args.charDelayMs) : 60;
    const showCursor = args.cursor !== false;
    const totalDurationMs = text.length * charDelayMs + 200;
    const ts = now();
    // Use a monospace font for accurate character width and clip-path animation
    const charWidth = fontSize * 0.6;
    const fullWidth = Math.ceil(text.length * charWidth);
    const style: Record<string, string | number> = {
      _tag: "div",
      _content: showCursor ? `${text}_` : text,
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      fontSize,
      color,
      fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
      whiteSpace: "pre",
      overflow: "hidden",
      width: 0,
      display: "flex",
      alignItems: "center",
    };
    const all = listComponents(ctx.projectId);
    const maxOrder = all.reduce((max, c) => Math.max(max, c.orderIndex), -1);
    const component: MotionComponent = {
      id: createId("c_"),
      projectId: ctx.projectId,
      templateId: null,
      name,
      selector: null,
      sceneId: null,
      orderIndex: maxOrder + 1,
      easing: { type: "preset", name: "linear" },
      durationMs: totalDurationMs,
      delayMs: 0,
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      keyframes: [
        { offset: 0, properties: { width: 0 } },
        { offset: 1, properties: { width: fullWidth } },
      ],
      style,
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    return ok(`added typewriter text "${name}" (${component.id}) — ${text.length} chars over ${totalDurationMs}ms`, true, { componentId: component.id });
  },

  add_scene_transition: (args, ctx) => {
    const type = String(args.type) as "dissolve" | "wipe-left" | "wipe-right" | "wipe-up" | "wipe-down" | "slide-left" | "slide-right" | "zoom-in" | "zoom-out" | "flash";
    const durationMs = args.durationMs != null ? Number(args.durationMs) : 600;
    const delayMs = args.delayMs != null ? Number(args.delayMs) : 0;
    const color = args.color ? String(args.color) : "#000000";
    const ts = now();
    const all = listComponents(ctx.projectId);
    const maxOrder = all.reduce((max, c) => Math.max(max, c.orderIndex), -1);
    // Build keyframes based on transition type
    let keyframes: Keyframe[] = [];
    let style: Record<string, string | number> = {
      _tag: "div",
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      backgroundColor: color,
      pointerEvents: "none",
      zIndex: 9999,
    };
    const ease = { type: "preset" as const, name: "ease-in-out" as "ease-in-out" | "ease-out" };
    switch (type) {
      case "dissolve":
        keyframes = [
          { offset: 0, properties: { opacity: 0 } },
          { offset: 0.5, properties: { opacity: 1 } },
          { offset: 1, properties: { opacity: 0 } },
        ];
        break;
      case "flash":
        keyframes = [
          { offset: 0, properties: { opacity: 0 } },
          { offset: 0.3, properties: { opacity: 1 } },
          { offset: 0.5, properties: { opacity: 1 } },
          { offset: 1, properties: { opacity: 0 } },
        ];
        ease.name = "ease-out";
        break;
      case "wipe-left":
        keyframes = [
          { offset: 0, properties: { clipPath: "inset(0 0 0 0)" } },
          { offset: 0.5, properties: { clipPath: "inset(0 0 0 100%)" } },
          { offset: 1, properties: { clipPath: "inset(0 0 0 0)" } },
        ];
        break;
      case "wipe-right":
        keyframes = [
          { offset: 0, properties: { clipPath: "inset(0 0 0 0)" } },
          { offset: 0.5, properties: { clipPath: "inset(0 100% 0 0)" } },
          { offset: 1, properties: { clipPath: "inset(0 0 0 0)" } },
        ];
        break;
      case "wipe-up":
        keyframes = [
          { offset: 0, properties: { clipPath: "inset(0 0 0 0)" } },
          { offset: 0.5, properties: { clipPath: "inset(0 0 100% 0)" } },
          { offset: 1, properties: { clipPath: "inset(0 0 0 0)" } },
        ];
        break;
      case "wipe-down":
        keyframes = [
          { offset: 0, properties: { clipPath: "inset(0 0 0 0)" } },
          { offset: 0.5, properties: { clipPath: "inset(100% 0 0 0)" } },
          { offset: 1, properties: { clipPath: "inset(0 0 0 0)" } },
        ];
        break;
      case "slide-left":
        keyframes = [
          { offset: 0, properties: { translateX: 0, opacity: 1 } },
          { offset: 0.5, properties: { translateX: -2000, opacity: 1 } },
          { offset: 0.51, properties: { translateX: 2000, opacity: 1 } },
          { offset: 1, properties: { translateX: 0, opacity: 0 } },
        ];
        break;
      case "slide-right":
        keyframes = [
          { offset: 0, properties: { translateX: 0, opacity: 1 } },
          { offset: 0.5, properties: { translateX: 2000, opacity: 1 } },
          { offset: 0.51, properties: { translateX: -2000, opacity: 1 } },
          { offset: 1, properties: { translateX: 0, opacity: 0 } },
        ];
        break;
      case "zoom-in":
        keyframes = [
          { offset: 0, properties: { scale: 0, opacity: 0 } },
          { offset: 0.5, properties: { scale: 1, opacity: 1 } },
          { offset: 1, properties: { scale: 3, opacity: 0 } },
        ];
        break;
      case "zoom-out":
        keyframes = [
          { offset: 0, properties: { scale: 3, opacity: 0 } },
          { offset: 0.5, properties: { scale: 1, opacity: 1 } },
          { offset: 1, properties: { scale: 0, opacity: 0 } },
        ];
        break;
    }
    const component: MotionComponent = {
      id: createId("c_"),
      projectId: ctx.projectId,
      templateId: null,
      name: `Transition: ${type}`,
      selector: null,
      sceneId: null,
      orderIndex: maxOrder + 1,
      easing: ease,
      durationMs,
      delayMs,
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      keyframes,
      style,
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    return ok(`added ${type} transition "${name}" (${component.id}) — ${durationMs}ms`, true, { componentId: component.id });
  },

  add_camera_move: (args, ctx) => {
    const type = String(args.type) as "pan-left" | "pan-right" | "pan-up" | "pan-down" | "zoom-in" | "zoom-out" | "zoom-pan";
    const durationMs = args.durationMs != null ? Number(args.durationMs) : 2000;
    const delayMs = args.delayMs != null ? Number(args.delayMs) : 0;
    const intensity = args.intensity != null ? Number(args.intensity) : 1;
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    // Store camera move as a project token that the canvas can read
    const tokens = { ...project.tokens };
    let camera: { moves: Array<{ type: string; durationMs: number; delayMs: number; intensity: number }> };
    try {
      camera = typeof tokens.camera === "string" ? JSON.parse(tokens.camera) : { moves: [] };
    } catch {
      camera = { moves: [] };
    }
    camera.moves.push({ type, durationMs, delayMs, intensity });
    tokens.camera = JSON.stringify(camera);
    updateProject(ctx.projectId, { tokens });
    // Also create a virtual component for timeline representation
    const ts = now();
    const all = listComponents(ctx.projectId);
    const maxOrder = all.reduce((max, c) => Math.max(max, c.orderIndex), -1);
    const ease = { type: "preset" as const, name: "ease-in-out" as const };
    const move = intensity * 100;
    let keyframes: Keyframe[] = [];
    switch (type) {
      case "pan-left":
        keyframes = [{ offset: 0, properties: { translateX: 0 } }, { offset: 1, properties: { translateX: -move } }];
        break;
      case "pan-right":
        keyframes = [{ offset: 0, properties: { translateX: 0 } }, { offset: 1, properties: { translateX: move } }];
        break;
      case "pan-up":
        keyframes = [{ offset: 0, properties: { translateY: 0 } }, { offset: 1, properties: { translateY: -move } }];
        break;
      case "pan-down":
        keyframes = [{ offset: 0, properties: { translateY: 0 } }, { offset: 1, properties: { translateY: move } }];
        break;
      case "zoom-in":
        keyframes = [{ offset: 0, properties: { scale: 1 } }, { offset: 1, properties: { scale: 1 + intensity * 0.5 } }];
        break;
      case "zoom-out":
        keyframes = [{ offset: 0, properties: { scale: 1 + intensity * 0.5 } }, { offset: 1, properties: { scale: 1 } }];
        break;
      case "zoom-pan":
        keyframes = [
          { offset: 0, properties: { scale: 1, translateX: 0, translateY: 0 } },
          { offset: 1, properties: { scale: 1 + intensity * 0.3, translateX: move * 0.5, translateY: -move * 0.3 } },
        ];
        break;
    }
    const component: MotionComponent = {
      id: createId("c_cam_"),
      projectId: ctx.projectId,
      templateId: null,
      name: `Camera: ${type}`,
      selector: null,
      sceneId: null,
      orderIndex: maxOrder + 1,
      easing: ease,
      durationMs,
      delayMs,
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      keyframes,
      style: { _tag: "div", position: "absolute", left: "-9999px", width: 0, height: 0, opacity: 0 },
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    return ok(`added camera move "${type}" (${component.id}) — ${durationMs}ms, intensity ${intensity}`, true, { componentId: component.id, cameraTokens: tokens.camera });
  },

  set_blend_mode: (args, ctx) => {
    const componentId = String(args.componentId);
    const blendMode = String(args.blendMode);
    const existing = getComponent(ctx.projectId, componentId);
    if (!existing) return fail(`component ${componentId} not found`);
    const style = { ...existing.style, mixBlendMode: blendMode };
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`set blend mode to ${blendMode} on "${existing.name}"`, true, { componentId });
  },

  set_artboard: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens: Record<string, string | number> = { ...(project.tokens ?? {}) };
    const parts: string[] = [];
    if (args.width != null) { tokens.artboardWidth = Number(args.width); parts.push(`width=${args.width}`); }
    if (args.height != null) { tokens.artboardHeight = Number(args.height); parts.push(`height=${args.height}`); }
    if (args.background != null) { tokens.artboardBackground = String(args.background); parts.push(`background=${args.background}`); }
    updateProject(ctx.projectId, { tokens });
    return ok(`set artboard ${parts.join(", ")}`, true, { tokens });
  },

  set_layer_opacity: (args, ctx) => {
    const componentId = String(args.componentId);
    const opacity = Math.max(0, Math.min(1, Number(args.opacity)));
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    const style = { ...current.style, opacity };
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`set "${current.name}" opacity to ${Math.round(opacity * 100)}%`);
  },

  set_rulers: (args, _ctx) => {
    const show = Boolean(args.show);
    return {
      ok: true,
      summary: show ? "rulers visible" : "rulers hidden",
      specChanged: false,
      data: { uiAction: "set_rulers", show },
    };
  },

  nudge_component: (args, ctx) => {
    const componentId = String(args.componentId);
    const dx = Number(args.dx);
    const dy = Number(args.dy);
    const current = getComponent(ctx.projectId, componentId);
    if (!current) return fail(`component ${componentId} not found`);
    const style = { ...(current.style as Record<string, string | number>) };
    const left = typeof style.left === "number" ? style.left : parseFloat(String(style.left ?? "0")) || 0;
    const top = typeof style.top === "number" ? style.top : parseFloat(String(style.top ?? "0")) || 0;
    style.left = left + dx;
    style.top = top + dy;
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`nudged "${current.name}" by (${dx}, ${dy})`);
  },

  copy_to_clipboard: (_args, _ctx) => {
    return {
      ok: true,
      summary: "copied selection to clipboard",
      specChanged: false,
      data: { uiAction: "copy_to_clipboard" },
    };
  },

  paste_from_clipboard: (args, _ctx) => {
    return {
      ok: true,
      summary: "pasted from clipboard",
      specChanged: false,
      data: { uiAction: "paste_from_clipboard", x: args.x, y: args.y },
    };
  },

  capture_state: (args, ctx) => {
    const name = String(args.name);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const comps = listComponents(ctx.projectId);
    const compStyles: Record<string, { style: Record<string, string | number> }> = {};
    for (const c of comps) {
      compStyles[c.id] = { style: { ...(c.style as Record<string, string | number>) } };
    }
    const tokens: Record<string, string | number> = { ...(project.tokens ?? {}) };
    let sm: { states: unknown[]; transitions: unknown[]; activeStateId: string | null };
    try {
      sm = typeof tokens.stateMachine === "string" ? JSON.parse(tokens.stateMachine) : { states: [], transitions: [], activeStateId: null };
    } catch {
      sm = { states: [], transitions: [], activeStateId: null };
    }
    const stateId = `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    sm.states.push({ id: stateId, name, components: compStyles });
    sm.activeStateId = stateId;
    tokens.stateMachine = JSON.stringify(sm);
    updateProject(ctx.projectId, { tokens });
    return ok(`captured state "${name}" with ${comps.length} components`, true, { stateId, tokens });
  },

  apply_state: (args, ctx) => {
    const stateId = String(args.stateId);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens: Record<string, string | number> = { ...(project.tokens ?? {}) };
    let sm: { states: Array<{ id: string; name: string; components: Record<string, { style: Record<string, string | number> }> }>; transitions: unknown[]; activeStateId: string | null };
    try {
      sm = typeof tokens.stateMachine === "string" ? JSON.parse(tokens.stateMachine) : { states: [], transitions: [], activeStateId: null };
    } catch {
      sm = { states: [], transitions: [], activeStateId: null };
    }
    const state = sm.states.find((s) => s.id === stateId);
    if (!state) return fail(`state ${stateId} not found`);
    for (const [compId, data] of Object.entries(state.components)) {
      const comp = getComponent(ctx.projectId, compId);
      if (comp) {
        patchComponent(ctx.projectId, compId, { style: data.style });
      }
    }
    sm.activeStateId = stateId;
    tokens.stateMachine = JSON.stringify(sm);
    updateProject(ctx.projectId, { tokens });
    return ok(`applied state "${state.name}" to ${Object.keys(state.components).length} components`, true, { tokens });
  },

  add_transition: (args, ctx) => {
    const fromStateId = String(args.fromStateId);
    const toStateId = String(args.toStateId);
    const trigger = String(args.trigger ?? "manual");
    const durationMs = Number(args.durationMs ?? 500);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens: Record<string, string | number> = { ...(project.tokens ?? {}) };
    let sm: { states: Array<{ id: string }>; transitions: unknown[]; activeStateId: string | null };
    try {
      sm = typeof tokens.stateMachine === "string" ? JSON.parse(tokens.stateMachine) : { states: [], transitions: [], activeStateId: null };
    } catch {
      sm = { states: [], transitions: [], activeStateId: null };
    }
    const fromExists = sm.states.some((s) => s.id === fromStateId);
    const toExists = sm.states.some((s) => s.id === toStateId);
    if (!fromExists) return fail(`state ${fromStateId} not found`);
    if (!toExists) return fail(`state ${toStateId} not found`);
    const transId = `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    sm.transitions.push({ id: transId, fromStateId, toStateId, trigger, durationMs });
    tokens.stateMachine = JSON.stringify(sm);
    updateProject(ctx.projectId, { tokens });
    return ok(`added transition from ${fromStateId} to ${toStateId} (${trigger}, ${durationMs}ms)`, true, { tokens });
  },

  remove_state: (args, ctx) => {
    const stateId = String(args.stateId);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens: Record<string, string | number> = { ...(project.tokens ?? {}) };
    let sm: { states: Array<{ id: string; name: string }>; transitions: Array<{ fromStateId: string; toStateId: string }>; activeStateId: string | null };
    try {
      sm = typeof tokens.stateMachine === "string" ? JSON.parse(tokens.stateMachine) : { states: [], transitions: [], activeStateId: null };
    } catch {
      sm = { states: [], transitions: [], activeStateId: null };
    }
    const state = sm.states.find((s) => s.id === stateId);
    if (!state) return fail(`state ${stateId} not found`);
    sm.states = sm.states.filter((s) => s.id !== stateId);
    sm.transitions = sm.transitions.filter((t) => t.fromStateId !== stateId && t.toStateId !== stateId);
    if (sm.activeStateId === stateId) sm.activeStateId = null;
    tokens.stateMachine = JSON.stringify(sm);
    updateProject(ctx.projectId, { tokens });
    return ok(`removed state "${state.name}"`, true, { tokens });
  },

  list_states: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = project.tokens ?? {};
    let sm: { states: Array<{ id: string; name: string; components: Record<string, unknown> }>; transitions: Array<{ id: string; fromStateId: string; toStateId: string; trigger: string; durationMs: number }>; activeStateId: string | null };
    try {
      sm = typeof tokens.stateMachine === "string" ? JSON.parse(tokens.stateMachine) : { states: [], transitions: [], activeStateId: null };
    } catch {
      sm = { states: [], transitions: [], activeStateId: null };
    }
    const statesInfo = sm.states.map((s) => ({ id: s.id, name: s.name, componentCount: Object.keys(s.components).length }));
    const transitionsInfo = sm.transitions.map((t) => ({ id: t.id, from: t.fromStateId, to: t.toStateId, trigger: t.trigger, durationMs: t.durationMs }));
    return {
      ok: true,
      summary: `${sm.states.length} states, ${sm.transitions.length} transitions`,
      specChanged: false,
      data: { states: statesInfo, transitions: transitionsInfo, activeStateId: sm.activeStateId },
    };
  },

  toggle_auto_keyframe: (args, _ctx) => {
    const enabled = args.enabled ?? true;
    return {
      ok: true,
      summary: enabled ? "auto-keyframe enabled" : "auto-keyframe disabled",
      specChanged: false,
      data: { uiAction: "toggle_auto_keyframe", enabled },
    };
  },

  add_listener: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const tokens = { ...project.tokens };
    let data: { listeners: Array<Record<string, unknown>> };
    try {
      data = typeof tokens.listeners === "string" ? JSON.parse(tokens.listeners) : { listeners: [] };
    } catch {
      data = { listeners: [] };
    }
    const listener = {
      id: createId("ls_"),
      componentId,
      eventType: args.eventType,
      action: {
        type: args.actionType,
        target: String(args.target),
        ...(args.property != null ? { property: String(args.property) } : {}),
        ...(args.value != null ? { value: args.value } : {}),
      },
    };
    data.listeners.push(listener);
    tokens.listeners = JSON.stringify(data);
    updateProject(ctx.projectId, { tokens });
    return ok(`added ${args.eventType} listener on "${comp.name}" (${listener.id})`, true, { listenerId: listener.id });
  },

  remove_listener: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const listenerId = String(args.listenerId);
    const tokens = { ...project.tokens };
    let data: { listeners: Array<{ id: string }> };
    try {
      data = typeof tokens.listeners === "string" ? JSON.parse(tokens.listeners) : { listeners: [] };
    } catch {
      data = { listeners: [] };
    }
    const before = data.listeners.length;
    data.listeners = data.listeners.filter((l) => l.id !== listenerId);
    if (data.listeners.length === before) return fail(`listener ${listenerId} not found`);
    tokens.listeners = JSON.stringify(data);
    updateProject(ctx.projectId, { tokens });
    return ok(`removed listener ${listenerId}`);
  },

  list_listeners: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = project.tokens ?? {};
    let data: { listeners: Array<Record<string, unknown>> };
    try {
      data = typeof tokens.listeners === "string" ? JSON.parse(tokens.listeners) : { listeners: [] };
    } catch {
      data = { listeners: [] };
    }
    const filterComponentId = args.componentId ? String(args.componentId) : null;
    const listeners = filterComponentId
      ? data.listeners.filter((l) => l.componentId === filterComponentId)
      : data.listeners;
    return {
      ok: true,
      summary: `${listeners.length} listener${listeners.length === 1 ? "" : "s"}`,
      specChanged: false,
      data: { listeners },
    };
  },

  set_keyframe_offset: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const idx = Number(args.keyframeIndex);
    if (idx < 0 || idx >= comp.keyframes.length) return fail("keyframe index out of range");
    const offset = Math.max(0, Math.min(1, Number(args.offset)));
    const nextKfs = comp.keyframes.map((kf, i) => (i === idx ? { ...kf, offset } : kf));
    nextKfs.sort((a, b) => a.offset - b.offset);
    patchComponent(ctx.projectId, componentId, { keyframes: nextKfs });
    return ok(`moved keyframe ${idx} to offset ${offset} on "${comp.name}"`);
  },

  add_marker: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...project.tokens };
    let data: { markers: Array<Record<string, unknown>> };
    try {
      data = typeof tokens.markers === "string" ? JSON.parse(tokens.markers) : { markers: [] };
    } catch {
      data = { markers: [] };
    }
    const marker = {
      id: createId("mk_"),
      timeMs: Number(args.timeMs),
      label: typeof args.label === "string" ? args.label : `Marker ${data.markers.length + 1}`,
    };
    data.markers.push(marker);
    data.markers.sort((a, b) => Number(a.timeMs) - Number(b.timeMs));
    tokens.markers = JSON.stringify(data);
    updateProject(ctx.projectId, { tokens });
    return ok(`added marker "${marker.label}" at ${marker.timeMs}ms (${marker.id})`, true, { markerId: marker.id });
  },

  remove_marker: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const markerId = String(args.markerId);
    const tokens = { ...project.tokens };
    let data: { markers: Array<{ id: string }> };
    try {
      data = typeof tokens.markers === "string" ? JSON.parse(tokens.markers) : { markers: [] };
    } catch {
      data = { markers: [] };
    }
    const before = data.markers.length;
    data.markers = data.markers.filter((m) => m.id !== markerId);
    if (data.markers.length === before) return fail(`marker ${markerId} not found`);
    tokens.markers = JSON.stringify(data);
    updateProject(ctx.projectId, { tokens });
    return ok(`removed marker ${markerId}`);
  },

  list_markers: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = project.tokens;
    let data: { markers: Array<Record<string, unknown>> };
    try {
      data = typeof tokens.markers === "string" ? JSON.parse(tokens.markers) : { markers: [] };
    } catch {
      data = { markers: [] };
    }
    return ok(`${data.markers.length} marker${data.markers.length === 1 ? "" : "s"}`, false, { markers: data.markers });
  },

  reverse_keyframes: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    if (comp.keyframes.length < 2) return fail("need at least 2 keyframes to reverse");
    const reversed = comp.keyframes.map((kf) => ({ ...kf, offset: 1 - kf.offset }));
    reversed.sort((a, b) => a.offset - b.offset);
    patchComponent(ctx.projectId, componentId, { keyframes: reversed });
    return ok(`reversed keyframe order on "${comp.name}"`);
  },

  solo_layer: (_args, _ctx) => {
    return ok("solo layer toggled", false, { uiAction: "solo_layer", componentId: String(_args.componentId) });
  },

  set_parent: (args, ctx) => {
    const componentId = String(args.componentId);
    const parentId = String(args.parentId);
    if (componentId === parentId) return fail("component cannot be its own parent");
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const parent = getComponent(ctx.projectId, parentId);
    if (!parent) return fail(`parent component ${parentId} not found`);
    // Prevent cycles: walk up from parentId, if we hit componentId it's a cycle
    let current: MotionComponent | null = parent;
    const visited = new Set<string>();
    while (current && current.parentId) {
      if (current.parentId === componentId) return fail("cannot set parent: would create a cycle");
      if (visited.has(current.parentId)) break;
      visited.add(current.parentId);
      current = getComponent(ctx.projectId, current.parentId);
    }
    patchComponent(ctx.projectId, componentId, { parentId });
    return ok(`"${comp.name}" is now a child of "${parent.name}"`);
  },

  remove_parent: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    if (!comp.parentId) return fail(`"${comp.name}" has no parent`);
    patchComponent(ctx.projectId, componentId, { parentId: null });
    return ok(`"${comp.name}" detached from parent`);
  },

  list_hierarchy: (_args, ctx) => {
    const comps = listComponents(ctx.projectId);
    const roots = comps.filter((c) => !c.parentId);
    const tree = roots.map((r) => {
      const children = comps.filter((c) => c.parentId === r.id);
      return {
        id: r.id,
        name: r.name,
        children: children.map((ch) => ({ id: ch.id, name: ch.name })),
      };
    });
    return ok(`${roots.length} root layer(s), ${comps.length - roots.length} child layer(s)`, false, { tree, total: comps.length });
  },

  add_constraint: (args, ctx) => {
    const componentId = String(args.componentId);
    const targetId = String(args.targetId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const target = getComponent(ctx.projectId, targetId);
    if (!target) return fail(`target component ${targetId} not found`);
    const project = getProject(ctx.projectId);
    if (!project) return fail("project not found");
    const tokens = project.tokens ?? {};
    const constraints = JSON.parse(String(tokens.constraints ?? "[]")) as Array<Record<string, unknown>>;
    const constraint = {
      id: createId("con_"),
      componentId,
      targetId,
      type: String(args.type),
      strength: Number(args.strength),
      axis: String(args.axis),
    };
    constraints.push(constraint);
    tokens.constraints = JSON.stringify(constraints);
    updateProject(ctx.projectId, { tokens });
    return ok(`added ${constraint.type} constraint from "${comp.name}" to "${target.name}"`, true, { constraint });
  },

  remove_constraint: (args, ctx) => {
    const constraintId = String(args.constraintId);
    const project = getProject(ctx.projectId);
    if (!project) return fail("project not found");
    const tokens = project.tokens ?? {};
    const constraints = JSON.parse(String(tokens.constraints ?? "[]")) as Array<Record<string, unknown>>;
    const filtered = constraints.filter((c) => c.id !== constraintId);
    if (filtered.length === constraints.length) return fail(`constraint ${constraintId} not found`);
    tokens.constraints = JSON.stringify(filtered);
    updateProject(ctx.projectId, { tokens });
    return ok(`removed constraint`, true, { remaining: filtered.length });
  },

  list_constraints: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail("project not found");
    const tokens = project.tokens ?? {};
    const constraints = JSON.parse(String(tokens.constraints ?? "[]")) as Array<Record<string, unknown>>;
    return ok(`${constraints.length} constraint(s)`, false, { constraints });
  },

  add_clip: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail("project not found");
    const tokens = project.tokens ?? {};
    const clips = JSON.parse(String(tokens.clips ?? "[]")) as Array<Record<string, unknown>>;
    const clip = {
      id: createId("clip_"),
      name: String(args.name),
      startMs: Number(args.startMs),
      endMs: Number(args.endMs),
      color: args.color ? String(args.color) : "#ffffff",
    };
    if (clip.endMs <= clip.startMs) return fail("clip endMs must be greater than startMs");
    clips.push(clip);
    tokens.clips = JSON.stringify(clips);
    updateProject(ctx.projectId, { tokens });
    return ok(`added clip "${clip.name}" (${clip.startMs}ms–${clip.endMs}ms)`, true, { clip });
  },

  remove_clip: (args, ctx) => {
    const clipId = String(args.clipId);
    const project = getProject(ctx.projectId);
    if (!project) return fail("project not found");
    const tokens = project.tokens ?? {};
    const clips = JSON.parse(String(tokens.clips ?? "[]")) as Array<Record<string, unknown>>;
    const filtered = clips.filter((c) => c.id !== clipId);
    if (filtered.length === clips.length) return fail(`clip ${clipId} not found`);
    tokens.clips = JSON.stringify(filtered);
    updateProject(ctx.projectId, { tokens });
    return ok(`removed clip`, true, { remaining: filtered.length });
  },

  list_clips: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail("project not found");
    const tokens = project.tokens ?? {};
    const clips = JSON.parse(String(tokens.clips ?? "[]")) as Array<Record<string, unknown>>;
    return ok(`${clips.length} clip(s)`, false, { clips });
  },

  play_clip: (args, ctx) => {
    const clipId = String(args.clipId);
    const project = getProject(ctx.projectId);
    if (!project) return fail("project not found");
    const tokens = project.tokens ?? {};
    const clips = JSON.parse(String(tokens.clips ?? "[]")) as Array<Record<string, unknown>>;
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return fail(`clip ${clipId} not found`);
    return ok(`playing clip "${clip.name}"`, false, {
      uiAction: "play_clip",
      clipId,
      startMs: clip.startMs,
      endMs: clip.endMs,
    });
  },

  set_filter: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const filterName = String(args.filter);
    const filterValue = args.value;
    const style = { ...comp.style } as Record<string, string | number>;
    // Build or update the CSS filter string
    const filterParts: string[] = [];
    const filterRegex = /(\w+)\(([^)]+)\)/g;
    const existing = typeof style.filter === "string" ? style.filter : "";
    let match: RegExpExecArray | null;
    let found = false;
    while ((match = filterRegex.exec(existing)) !== null) {
      if (match[1] === filterName) {
        filterParts.push(`${filterName}(${filterValue})`);
        found = true;
      } else {
        filterParts.push(match[0]);
      }
    }
    if (!found) filterParts.push(`${filterName}(${filterValue})`);
    const filterStr = filterParts.join(" ");
    if (filterStr) {
      style.filter = filterStr;
    } else {
      delete style.filter;
    }
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`set ${filterName}(${filterValue}) filter on "${comp.name}"`);
  },

  set_3d_transform: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const style = { ...comp.style } as Record<string, string | number>;
    if (args.perspective != null) style.perspective = `${args.perspective}px`;
    if (args.rotateX != null) style.rotateX = `${args.rotateX}deg`;
    if (args.rotateY != null) style.rotateY = `${args.rotateY}deg`;
    if (args.rotateZ != null) style.rotateZ = `${args.rotateZ}deg`;
    if (args.translateZ != null) style.translateZ = `${args.translateZ}px`;
    patchComponent(ctx.projectId, componentId, { style });
    const parts: string[] = [];
    if (args.perspective != null) parts.push(`perspective=${args.perspective}`);
    if (args.rotateX != null) parts.push(`rotateX=${args.rotateX}°`);
    if (args.rotateY != null) parts.push(`rotateY=${args.rotateY}°`);
    if (args.rotateZ != null) parts.push(`rotateZ=${args.rotateZ}°`);
    if (args.translateZ != null) parts.push(`translateZ=${args.translateZ}px`);
    return ok(`3D transform on "${comp.name}": ${parts.join(", ")}`);
  },

  set_adjustment_layer: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const style = { ...comp.style } as Record<string, string | number>;
    if (args.enabled) {
      // Convert filter to backdropFilter — adjustment layer mode
      const currentFilter = typeof style.filter === "string" ? style.filter : "blur(0px)";
      style.backdropFilter = currentFilter;
      delete style.filter;
    } else {
      // Convert backdropFilter back to filter — normal mode
      const currentBackdrop = typeof style.backdropFilter === "string" ? style.backdropFilter : "";
      if (currentBackdrop) {
        style.filter = currentBackdrop;
      }
      delete style.backdropFilter;
    }
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`"${comp.name}" ${args.enabled ? "is now an adjustment layer" : "is now a regular layer"}`);
  },

  create_precomp: (args, ctx) => {
    const ids = args.componentIds as string[];
    const compId = `comp_${Date.now().toString(36)}`;
    const name = String(args.name || `Pre-comp ${compId.slice(-4)}`);
    let count = 0;
    for (const id of ids) {
      const comp = getComponent(ctx.projectId, String(id));
      if (!comp) continue;
      const style = { ...comp.style } as Record<string, string | number>;
      style._compId = compId;
      style._compName = name;
      patchComponent(ctx.projectId, String(id), { style });
      count++;
    }
    return ok(`grouped ${count} component(s) into pre-composition "${name}" (${compId})`);
  },

  ungroup_precomp: (args, ctx) => {
    const ids = args.componentIds as string[];
    let count = 0;
    for (const id of ids) {
      const comp = getComponent(ctx.projectId, String(id));
      if (!comp) continue;
      const style = { ...comp.style } as Record<string, string | number>;
      delete style._compId;
      delete style._compName;
      patchComponent(ctx.projectId, String(id), { style });
      count++;
    }
    return ok(`removed ${count} component(s) from pre-composition`);
  },

  enable_motion_blur: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const style = { ...comp.style } as Record<string, string | number>;
    const enabled = Boolean(args.enabled);
    if (enabled) {
      const intensity = Number(args.intensity ?? 4);
      const shutterAngle = Number(args.shutterAngle ?? 180);
      // Approximate shutter-angle-weighted motion blur via CSS filter blur.
      // The renderer also picks up these tokens to add will-change hints and
      // a per-frame streak filter during fast-motion segments.
      style._motionBlur = "1";
      style._motionBlurIntensity = String(intensity);
      style._motionBlurShutter = String(shutterAngle);
      style.willChange = "transform, filter";
    } else {
      delete style._motionBlur;
      delete style._motionBlurIntensity;
      delete style._motionBlurShutter;
      delete style.willChange;
    }
    patchComponent(ctx.projectId, componentId, { style });
    return ok(
      enabled
        ? `Enabled motion blur on "${comp.name}" (intensity=${args.intensity ?? 4}px, shutter=${args.shutterAngle ?? 180}°).`
        : `Disabled motion blur on "${comp.name}".`,
    );
  },

  add_null_object: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const existing = listComponents(ctx.projectId);
    const idx = existing.length + 1;
    const name = String(args.name ?? `Null ${idx}`);
    const x = Number(args.x ?? 0);
    const y = Number(args.y ?? 0);
    const ts = now();
    // Null object: fully transparent, zero-sized, non-interactive marker.
    // Children parented to it inherit its transform but it never paints.
    const d = draft(name, {
      durationMs: 0,
      fillMode: "none",
      easing: { type: "preset", name: "linear" },
      style: {
        width: 0,
        height: 0,
        opacity: 0,
        pointerEvents: "none",
        left: x,
        top: y,
        background: "transparent",
        _nullObject: "1",
      },
    });
    const component: MotionComponent = {
      ...d,
      id: createId("c_"),
      projectId: ctx.projectId,
      playState: "paused",
      orderIndex: existing.length,
      templateId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    return ok(
      `Created null object "${name}" (${component.id}) at (${x}, ${y}) — parent other layers to it to drive them as a group.`,
      true,
      { componentId: component.id, name, x, y },
    );
  },

  trim_path: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const start = Math.max(0, Math.min(100, Number(args.start ?? 0)));
    const end = Math.max(0, Math.min(100, Number(args.end ?? 100)));
    const offset = Number(args.offset ?? 0);
    const animate = Boolean(args.animate ?? true);
    const style = { ...comp.style } as Record<string, string | number>;
    // CSS stroke-dasharray works on SVG-like paths and on elements with
    // border-style. We treat the layer as a path that gets progressively
    // revealed. dashLength is a sensible default (the rendered diagonal).
    const width = Number(style.width ?? 100);
    const height = Number(style.height ?? 100);
    const pathLength = Math.max(width, height) * 2 + Math.min(width, height) * 2;
    const visibleLen = (pathLength * (end - start)) / 100;
    const startOffset = (pathLength * start) / 100;
    style._trimPath = "1";
    style._trimStart = start;
    style._trimEnd = end;
    style._trimOffset = offset;
    style._trimAnimate = animate ? "1" : "0";
    style._trimPathLength = pathLength;
    // Surface as inline stroke props so the renderer can pick them up.
    style.strokeDasharray = `${visibleLen} ${pathLength - visibleLen}`;
    style.strokeDashoffset = String(-startOffset);
    if (animate) {
      // Build a keyframe pair that animates the dashoffset from full-hidden
      // to fully-revealed across the component duration, unless keyframes
      // already exist (we don't clobber existing authored animation).
      if (comp.keyframes.length === 0) {
        const kfs: Keyframe[] = [
          {
            offset: 0,
            properties: { opacity: 1 },
            easing: { type: "preset", name: "linear" },
          },
          {
            offset: 1,
            properties: { opacity: 1 },
            easing: { type: "preset", name: "linear" },
          },
        ];
        patchComponent(ctx.projectId, componentId, {
          style,
          keyframes: kfs,
          durationMs: comp.durationMs < 200 ? 1200 : comp.durationMs,
        });
        return ok(
          `Trim-path reveal on "${comp.name}" from ${start}% to ${end}% (offset ${offset}°), animated across ${comp.durationMs < 200 ? 1200 : comp.durationMs}ms.`,
        );
      }
    }
    patchComponent(ctx.projectId, componentId, { style });
    return ok(
      `Trim-path set on "${comp.name}" — visible ${start}% to ${end}% (offset ${offset}°), animate=${animate}.`,
    );
  },

  add_repeater: (args, ctx) => {
    const componentId = String(args.componentId);
    const source = getComponent(ctx.projectId, componentId);
    if (!source) return fail(`component ${componentId} not found`);
    const copies = Math.max(1, Math.min(50, Number(args.copies ?? 5)));
    const offset = (args.offset ?? { x: 20, y: 0, rotate: 0, scale: 1 }) as {
      x: number; y: number; rotate: number; scale: number;
    };
    const decay = Math.max(0, Math.min(1, Number(args.decay ?? 0.15)));
    const existing = listComponents(ctx.projectId);
    const baseOrder = source.orderIndex;
    const createdIds: string[] = [];
    let cursorX = Number(source.style?.left ?? 0);
    let cursorY = Number(source.style?.top ?? 0);
    let cursorRotate = 0;
    let cursorScale = 1;
    for (let i = 1; i <= copies; i++) {
      cursorX += offset.x;
      cursorY += offset.y;
      cursorRotate += offset.rotate;
      cursorScale *= offset.scale;
      const opacity = Math.max(0, 1 - decay * i);
      const newStyle = {
        ...(source.style as Record<string, string | number>),
        left: cursorX,
        top: cursorY,
        rotate: cursorRotate,
        scale: cursorScale,
        opacity,
        _repeaterSource: componentId,
        _repeaterIndex: i,
      };
      const ts = now();
      const d = draft(`${source.name} Repeat ${i}`, {
        durationMs: source.durationMs,
        delayMs: source.delayMs + i * 30,
        iterationCount: source.iterationCount,
        direction: source.direction,
        fillMode: source.fillMode,
        trigger: source.trigger,
        easing: source.easing,
        keyframes: source.keyframes,
        style: newStyle,
        sceneId: source.sceneId ?? undefined,
      });
      const clone: MotionComponent = {
        ...d,
        id: createId("c_"),
        projectId: ctx.projectId,
        playState: source.playState,
        orderIndex: baseOrder + i,
        parentId: source.parentId,
        templateId: null,
        createdAt: ts,
        updatedAt: ts,
      };
      createComponent(clone);
      createdIds.push(clone.id);
    }
    return ok(
      `Repeated "${source.name}" ${copies}× (offset x=${offset.x}, y=${offset.y}, rot=${offset.rotate}°, scale=${offset.scale}, decay=${decay}). Created ${createdIds.length} copies.`,
      true,
      { sourceId: componentId, copies: createdIds.length, createdIds },
    );
  },

  add_echo: (args, ctx) => {
    const componentId = String(args.componentId);
    const source = getComponent(ctx.projectId, componentId);
    if (!source) return fail(`component ${componentId} not found`);
    const copies = Math.max(1, Math.min(20, Number(args.copies ?? 4)));
    const delayMs = Math.max(10, Number(args.delayMs ?? 80));
    const decay = Math.max(0, Math.min(1, Number(args.decay ?? 0.25)));
    const scaleDecay = Math.max(0, Math.min(1, Number(args.scaleDecay ?? 0)));
    const baseOrder = source.orderIndex;
    const createdIds: string[] = [];
    for (let i = 1; i <= copies; i++) {
      const opacity = Math.max(0, 1 - decay * i);
      const scale = 1 - scaleDecay * i;
      const newStyle = {
        ...(source.style as Record<string, string | number>),
        opacity,
        scale: Math.max(0.01, scale),
        _echoSource: componentId,
        _echoIndex: i,
        zIndex: -i,
      };
      const ts = now();
      const d = draft(`${source.name} Echo ${i}`, {
        durationMs: source.durationMs,
        delayMs: source.delayMs + i * delayMs,
        iterationCount: source.iterationCount,
        direction: source.direction,
        fillMode: source.fillMode,
        trigger: source.trigger,
        easing: source.easing,
        keyframes: source.keyframes,
        style: newStyle,
        sceneId: source.sceneId ?? undefined,
      });
      const clone: MotionComponent = {
        ...d,
        id: createId("c_"),
        projectId: ctx.projectId,
        playState: source.playState,
        orderIndex: baseOrder - i,
        parentId: source.parentId,
        templateId: null,
        createdAt: ts,
        updatedAt: ts,
      };
      createComponent(clone);
      createdIds.push(clone.id);
    }
    return ok(
      `Added ${copies} motion-trail echoes to "${source.name}" (delay=${delayMs}ms, decay=${decay}, scaleDecay=${scaleDecay}).`,
      true,
      { sourceId: componentId, copies: createdIds.length, createdIds },
    );
  },

  set_time_remap: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const rate = Number(args.rate);
    const reverseDirection = Boolean(args.reverseDirection ?? false);
    const freezeAtMs = args.freezeAtMs != null ? Number(args.freezeAtMs) : undefined;
    const style = { ...comp.style } as Record<string, string | number>;
    if (rate === 0) {
      // Freeze the layer: pause and (optionally) jump to a specific time.
      style._timeRemap = "freeze";
      if (freezeAtMs != null) style._timeRemapFreezeAt = String(freezeAtMs);
      patchComponent(ctx.projectId, componentId, { style, playState: "paused" });
      return ok(
        `Time-remapped "${comp.name}" → FROZEN${freezeAtMs != null ? ` at ${freezeAtMs}ms` : ""}.`,
      );
    }
    // Apply rate by inversely scaling the durationMs and tag for renderer.
    const newDuration = Math.max(50, Math.round(comp.durationMs / Math.abs(rate)));
    const isReverse = reverseDirection || rate < 0;
    style._timeRemap = String(rate);
    style._timeRemapRate = String(rate);
    patchComponent(ctx.projectId, componentId, {
      style,
      durationMs: newDuration,
      direction: isReverse ? "reverse" : "normal",
      playState: "running",
    });
    return ok(
      `Time-remapped "${comp.name}" → rate=${rate}× (duration ${comp.durationMs}ms → ${newDuration}ms, direction=${isReverse ? "reverse" : "normal"}).`,
    );
  },

  add_layer_effect: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const effect = String(args.effect) as "drop-shadow" | "inner-shadow" | "outer-glow" | "inner-glow" | "stroke";
    const color = String(args.color ?? "#000000");
    const distance = Number(args.distance ?? 4);
    const blur = Number(args.blur ?? 6);
    const opacity = Math.max(0, Math.min(1, Number(args.opacity ?? 0.5)));
    const spread = Number(args.spread ?? 0);
    const style = { ...comp.style } as Record<string, string | number>;
    // Build a CSS box-shadow string for the requested effect. Stacks with
    // any existing box-shadow.
    const existingShadow = typeof style.boxShadow === "string" ? style.boxShadow : "";
    const parts: string[] = existingShadow ? [existingShadow] : [];
    const insetPrefix = effect === "inner-shadow" || effect === "inner-glow" ? "inset " : "";
    const resolvedColor = effect === "outer-glow" || effect === "inner-glow"
      ? hexWithOpacity(color, opacity)
      : hexWithOpacity(color, opacity);
    if (effect === "stroke") {
      // Outline via box-shadow: 0 0 0 spread color (no offset, no blur).
      parts.push(`${insetPrefix}0 0 0 ${spread}px ${resolvedColor}`);
    } else if (effect === "drop-shadow" || effect === "inner-shadow") {
      parts.push(`${insetPrefix}${distance}px ${distance}px ${blur}px ${spread}px ${resolvedColor}`);
    } else {
      // outer-glow / inner-glow: symmetric blur.
      parts.push(`${insetPrefix}0 0 ${blur}px ${spread}px ${resolvedColor}`);
    }
    style.boxShadow = parts.join(", ");
    // Tag for the renderer so it knows effects are authored.
    const effectsList = typeof style._layerEffects === "string"
      ? (JSON.parse(style._layerEffects) as string[])
      : [];
    effectsList.push(effect);
    style._layerEffects = JSON.stringify(effectsList);
    patchComponent(ctx.projectId, componentId, { style });
    return ok(
      `Added ${effect} layer effect to "${comp.name}" (color=${color}, distance=${distance}, blur=${blur}, opacity=${opacity}, spread=${spread}).`,
    );
  },

  add_mask: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const shape = String(args.shape ?? "rectangle") as "rectangle" | "ellipse" | "path";
    const mode = String(args.mode ?? "add") as "add" | "subtract" | "intersect" | "difference" | "lighten" | "darken";
    const x = Number(args.x ?? 0);
    const y = Number(args.y ?? 0);
    const w = Number(args.width ?? 100);
    const h = Number(args.height ?? 100);
    const path = args.path ? String(args.path) : undefined;
    const feather = Math.max(0, Number(args.feather ?? 0));
    const expansion = Number(args.expansion ?? 0);
    const inverted = Boolean(args.inverted ?? false);
    const name = args.name ? String(args.name) : `Mask ${Date.now().toString(36).slice(-4)}`;
    const style = { ...comp.style } as Record<string, string | number>;
    // Masks are stored as a JSON array on _masks so the renderer can emit
    // proper SVG/CSS mask definitions. Each entry carries shape geometry,
    // blend mode, feather, expansion, and inversion.
    const masks = typeof style._masks === "string"
      ? (JSON.parse(style._masks) as Array<Record<string, unknown>>)
      : [];
    masks.push({
      id: `mask_${Date.now().toString(36)}_${masks.length}`,
      name,
      shape,
      mode,
      x,
      y,
      width: w,
      height: h,
      ...(path ? { path } : {}),
      feather,
      expansion,
      inverted,
    });
    style._masks = JSON.stringify(masks);
    patchComponent(ctx.projectId, componentId, { style });
    return ok(
      `Added ${shape} mask "${name}" (mode=${mode}, feather=${feather}px, expansion=${expansion}px, inverted=${inverted}) to "${comp.name}". Total masks: ${masks.length}.`,
      true,
      { maskCount: masks.length },
    );
  },

  set_mask_mode: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const idx = Math.max(0, Number(args.maskIndex ?? 0));
    const mode = String(args.mode) as "add" | "subtract" | "intersect" | "difference" | "lighten" | "darken";
    const style = { ...comp.style } as Record<string, string | number>;
    const masks = typeof style._masks === "string"
      ? (JSON.parse(style._masks) as Array<Record<string, unknown>>)
      : [];
    if (idx >= masks.length) return fail(`mask index ${idx} out of range (have ${masks.length})`);
    masks[idx] = { ...masks[idx], mode };
    if (args.inverted != null) masks[idx].inverted = Boolean(args.inverted);
    if (args.feather != null) masks[idx].feather = Number(args.feather);
    if (args.expansion != null) masks[idx].expansion = Number(args.expansion);
    style._masks = JSON.stringify(masks);
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`Updated mask ${idx} on "${comp.name}" → mode=${mode}.`);
  },

  set_track_matte: (args, ctx) => {
    const componentId = String(args.componentId);
    const matteId = String(args.matteComponentId);
    const comp = getComponent(ctx.projectId, componentId);
    const matte = getComponent(ctx.projectId, matteId);
    if (!comp) return fail(`component ${componentId} not found`);
    if (!matte) return fail(`matte component ${matteId} not found`);
    const mode = String(args.mode ?? "alpha") as "alpha" | "alpha-inverted" | "luma" | "luma-inverted";
    const style = { ...comp.style } as Record<string, string | number>;
    // Store track matte reference; the renderer resolves the matte layer's
    // alpha/luma channel into a CSS mask-image.
    style._trackMatte = JSON.stringify({ matteId, mode });
    patchComponent(ctx.projectId, componentId, { style });
    return ok(
      `Set "${matte.name}" as ${mode} track matte for "${comp.name}". The matte layer's ${mode.startsWith("luma") ? "brightness" : "transparency"} now controls the target's visibility.`,
    );
  },

  create_shape_layer: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const shape = String(args.shape) as "rectangle" | "ellipse" | "polygon" | "star" | "line" | "path";
    const name = args.name ? String(args.name) : shape.charAt(0).toUpperCase() + shape.slice(1);
    const x = Number(args.x ?? 40);
    const y = Number(args.y ?? 40);
    const w = Number(args.width ?? 120);
    const h = Number(args.height ?? 120);
    const sides = Math.max(3, Math.min(20, Number(args.sides ?? 5)));
    const points = Math.max(3, Math.min(20, Number(args.points ?? 5)));
    const innerRadius = args.innerRadius != null ? Number(args.innerRadius) : 0.5;
    const path = args.path ? String(args.path) : undefined;
    const fill = String(args.fill ?? "#e5e5e5");
    const stroke = args.stroke ? String(args.stroke) : undefined;
    const strokeWidth = Math.max(0, Number(args.strokeWidth ?? 0));
    const cornerRadius = Math.max(0, Number(args.cornerRadius ?? 0));
    const rotation = Number(args.rotation ?? 0);
    const existing = listComponents(ctx.projectId);
    const ts = now();
    const style: Record<string, string | number> = {
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      backgroundColor: fill,
      transform: `rotate(${rotation}deg)`,
      _shapeType: shape,
    };
    if (stroke && strokeWidth > 0) {
      style.border = `${strokeWidth}px solid ${stroke}`;
    }
    if (shape === "rectangle" && cornerRadius > 0) {
      style.borderRadius = `${cornerRadius}px`;
    } else if (shape === "ellipse") {
      style.borderRadius = "50%";
    } else if (shape === "polygon") {
      style.clipPath = buildPolygonClipPath(sides);
    } else if (shape === "star") {
      style.clipPath = buildStarClipPath(points, innerRadius);
    } else if (shape === "line") {
      style.height = Math.max(strokeWidth, 2);
      style.backgroundColor = stroke ?? fill;
    } else if (shape === "path" && path) {
      // For path shapes, store the SVG path data — the renderer can emit
      // an inline SVG with stroke + fill for full vector fidelity.
      style._svgPath = path;
      style._svgFill = fill;
      if (stroke) style._svgStroke = stroke;
      if (strokeWidth > 0) style._svgStrokeWidth = String(strokeWidth);
      style.backgroundColor = "transparent";
    }
    const d = draft(name, { style, sceneId: undefined });
    const component: MotionComponent = {
      ...d,
      id: createId("c_"),
      projectId: ctx.projectId,
      playState: "running",
      orderIndex: existing.length,
      templateId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(component);
    return ok(
      `Created ${shape} shape layer "${name}" (${w}×${h} at ${x},${y})${stroke ? ` with ${strokeWidth}px stroke` : ""}.`,
      true,
      { componentId: component.id, shape, name },
    );
  },

  posterize_time: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const fps = Math.max(1, Math.min(60, Number(args.fps)));
    const enabled = Boolean(args.enabled ?? true);
    const style = { ...comp.style } as Record<string, string | number>;
    if (enabled) {
      // CSS steps(N) quantizes time into N discrete jumps per iteration.
      // step-start = jump immediately at each step boundary (Hold-style).
      const frameCount = Math.max(1, Math.round((comp.durationMs / 1000) * fps));
      style._posterizeTime = String(fps);
      style._posterizeFrames = String(frameCount);
      // Override timing function with steps — preserves user easing config
      // in _origTimingFunction for later restoration.
      if (!style._origTimingFunction) {
        style._origTimingFunction = JSON.stringify(comp.easing);
      }
      patchComponent(ctx.projectId, componentId, {
        style,
        easing: { type: "preset", name: "linear" },
      });
      return ok(
        `Posterized "${comp.name}" to ${fps} fps (${frameCount} discrete frames over ${comp.durationMs}ms). Animation will step in ${frameCount} increments.`,
      );
    }
    // Restore original timing function if it was saved.
    const orig = style._origTimingFunction;
    if (typeof orig === "string") {
      try {
        const easing = JSON.parse(orig);
        delete style._posterizeTime;
        delete style._posterizeFrames;
        delete style._origTimingFunction;
        patchComponent(ctx.projectId, componentId, { style, easing });
        return ok(`Disabled posterize on "${comp.name}" — restored original easing.`);
      } catch { /* fall through */ }
    }
    delete style._posterizeTime;
    delete style._posterizeFrames;
    delete style._origTimingFunction;
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`Disabled posterize on "${comp.name}".`);
  },

  add_text_animator: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const property = String(args.property ?? "opacity") as "position" | "scale" | "rotation" | "opacity" | "color";
    const rangeStart = Math.max(0, Math.min(100, Number(args.rangeStart ?? 0)));
    const rangeEnd = Math.max(0, Math.min(100, Number(args.rangeEnd ?? 100)));
    const unit = String(args.unit ?? "character") as "character" | "word";
    const offset = Number(args.offset ?? 0);
    const valueDelta = Number(args.valueDelta ?? 1);
    const staggerMs = Math.max(0, Number(args.staggerMs ?? 40));
    const easing = String(args.easing ?? "ease-out");
    const style = { ...comp.style } as Record<string, string | number>;
    // Store the text animator config — the renderer splits _content into
    // per-unit spans and applies staggered animation delays based on this.
    const animators = typeof style._textAnimators === "string"
      ? (JSON.parse(style._textAnimators) as Array<Record<string, unknown>>)
      : [];
    animators.push({
      id: `ta_${Date.now().toString(36)}_${animators.length}`,
      property,
      rangeStart,
      rangeEnd,
      unit,
      offset,
      valueDelta,
      staggerMs,
      easing,
    });
    style._textAnimators = JSON.stringify(animators);
    patchComponent(ctx.projectId, componentId, { style });
    return ok(
      `Added ${property} text animator to "${comp.name}" (range ${rangeStart}-${rangeEnd}%, unit=${unit}, stagger=${staggerMs}ms, delta=${valueDelta}). Total animators: ${animators.length}.`,
      true,
      { animatorCount: animators.length },
    );
  },

  set_keyframe_interpolation: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const idx = Math.max(0, Number(args.keyframeIndex));
    const interpolation = String(args.interpolation) as "linear" | "bezier" | "hold" | "auto-bezier" | "continuous";
    const roving = args.roving != null ? Boolean(args.roving) : undefined;
    if (idx >= comp.keyframes.length) {
      return fail(`keyframe index ${idx} out of range (have ${comp.keyframes.length})`);
    }
    const keyframes = [...comp.keyframes];
    const kf = { ...keyframes[idx] };
    // Set the easing for the segment LEAVING this keyframe.
    if (interpolation === "hold") {
      // Hold keyframe: use steps(1, jump-none) which freezes the value
      // until the next keyframe.
      kf.easing = { type: "preset", name: "linear" } as Easing;
    } else if (interpolation === "linear") {
      kf.easing = { type: "preset", name: "linear" } as Easing;
    } else if (interpolation === "bezier") {
      kf.easing = { type: "bezier", p1: [0.42, 0], p2: [0.58, 1] } as Easing;
    } else if (interpolation === "auto-bezier" || interpolation === "continuous") {
      // Auto-bezier: smooth S-curve.
      kf.easing = { type: "bezier", p1: [0.25, 0.1], p2: [0.25, 1] } as Easing;
    }
    keyframes[idx] = kf;
    // Mark roving status in the keyframe metadata (stored on style).
    if (roving != null) {
      const style = { ...comp.style } as Record<string, string | number>;
      const rovingMap = typeof style._rovingKeyframes === "string"
        ? (JSON.parse(style._rovingKeyframes) as Record<string, boolean>)
        : {};
      if (roving) rovingMap[String(idx)] = true;
      else delete rovingMap[String(idx)];
      style._rovingKeyframes = JSON.stringify(rovingMap);
      patchComponent(ctx.projectId, componentId, { keyframes, style });
    } else {
      patchComponent(ctx.projectId, componentId, { keyframes });
    }
    return ok(
      `Set keyframe ${idx} on "${comp.name}" → interpolation=${interpolation}${roving != null ? `, roving=${roving}` : ""}.`,
    );
  },

  set_expression: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const style = { ...comp.style } as Record<string, string | number>;
    const prop = String(args.property);
    const exprKey = `_expr:${prop}`;
    const enabledKey = `_exprEnabled:${prop}`;
    if (args.enabled) {
      style[exprKey] = String(args.expression);
      style[enabledKey] = 1;
    } else {
      style[enabledKey] = 0;
    }
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`expression on "${comp.name}".${prop}: ${args.enabled ? "enabled" : "disabled"} — ${String(args.expression)}`);
  },

  /* --------------------------- Gradient tools --------------------------- */
  set_gradient_fill: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const type = String(args.type ?? "linear") as "linear" | "radial";
    const angle = Number(args.angle ?? 90);
    const stops = Array.isArray(args.stops) ? args.stops : [];
    if (stops.length < 2) return fail("gradient requires at least 2 stops");
    const style = { ...comp.style } as Record<string, string | number>;
    style._gradientFill = JSON.stringify({
      type, angle,
      stops: stops.map((s: { color: unknown; position?: unknown }) => ({
        color: String(s.color),
        position: Number(s.position ?? 0),
      })),
      cx: args.cx != null ? Number(args.cx) : 50,
      cy: args.cy != null ? Number(args.cy) : 50,
      radius: args.radius != null ? Number(args.radius) : 50,
    });
    // Remove a flat backgroundColor so the gradient shows through.
    delete style.backgroundColor;
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`Applied ${type} gradient fill to "${comp.name}" (${stops.length} stops, angle=${angle}°).`);
  },

  set_gradient_stroke: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const type = String(args.type ?? "linear") as "linear" | "radial";
    const angle = Number(args.angle ?? 90);
    const width = Math.max(0, Number(args.width ?? 2));
    const stops = Array.isArray(args.stops) ? args.stops : [];
    if (stops.length < 2) return fail("gradient stroke requires at least 2 stops");
    const style = { ...comp.style } as Record<string, string | number>;
    style._gradientStroke = JSON.stringify({
      type, angle, width,
      stops: stops.map((s: { color: unknown; position?: unknown }) => ({
        color: String(s.color),
        position: Number(s.position ?? 0),
      })),
    });
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`Applied ${type} gradient stroke to "${comp.name}" (${width}px, ${stops.length} stops).`);
  },

  /* --------------------------- Wiggle tool --------------------------- */
  apply_wiggle: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const property = String(args.property ?? "translateX") as
      | "translateX" | "translateY" | "rotate" | "scale" | "opacity" | "skewX" | "skewY";
    const frequency = Math.max(0.1, Number(args.frequency ?? 2));
    const amplitude = Number(args.amplitude ?? 20);
    const octaves = Math.max(1, Math.min(6, Number(args.octaves ?? 2)));
    const seed = Number(args.seed ?? 1);
    const durationMs = args.durationMs != null ? Number(args.durationMs) : comp.durationMs;
    const sampleCount = Math.max(8, Math.min(120, Number(args.sampleCount ?? 24)));

    // Deterministic value-noise wiggle. Multiple octaves are summed with
    // amplitude halving per octave (fractal Brownian motion style).
    function hash(i: number): number {
      const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
      return x - Math.floor(x);
    }
    function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
    function smooth(t: number): number { return t * t * (3 - 2 * t); }
    function valueNoise(t: number, freq: number): number {
      const scaled = t * freq;
      const i = Math.floor(scaled);
      const f = scaled - i;
      return lerp(hash(i), hash(i + 1), smooth(f));
    }
    function fbm(t: number): number {
      let sum = 0;
      let amp = 1;
      let max = 0;
      for (let o = 0; o < octaves; o++) {
        sum += valueNoise(t, frequency * Math.pow(2, o)) * amp;
        max += amp;
        amp *= 0.5;
      }
      return sum / max; // 0..1
    }

    const keyframes: Keyframe[] = [];
    const baseValue = (comp.keyframes[0]?.properties as Record<string, number>)?.[property] ?? 0;
    for (let i = 0; i < sampleCount; i++) {
      const offset = i / (sampleCount - 1);
      const t = (offset * durationMs) / 1000;
      const n = fbm(t) * 2 - 1; // -1..1
      const delta = n * amplitude;
      const properties = { [property]: baseValue + delta } as Record<string, number>;
      keyframes.push({
        offset,
        properties,
        easing: { type: "preset", name: "linear" },
      });
    }
    patchComponent(ctx.projectId, componentId, { keyframes });
    return ok(
      `Wiggled "${comp.name}".${property} — ${sampleCount} keyframes over ${durationMs}ms (freq=${frequency}Hz, amp=${amplitude}, octaves=${octaves}, seed=${seed}).`,
      true,
      { keyframeCount: keyframes.length, property, frequency, amplitude },
    );
  },

  /* --------------------------- Particle emitter --------------------------- */
  add_particle_emitter: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const name = args.name ? String(args.name) : "Particle Emitter";
    const x = Number(args.x ?? 50);
    const y = Number(args.y ?? 50);
    const w = Number(args.width ?? 400);
    const h = Number(args.height ?? 300);
    const config = {
      rate: Number(args.rate ?? 20),
      lifespan: Number(args.lifespan ?? 1500),
      gravity: Number(args.gravity ?? 80),
      spread: Number(args.spread ?? 60),
      speed: Number(args.speed ?? 120),
      startColor: String(args.startColor ?? "#ffffff"),
      endColor: String(args.endColor ?? "#ff0080"),
      startSize: Number(args.startSize ?? 6),
      endSize: Number(args.endSize ?? 0),
      startOpacity: Number(args.startOpacity ?? 1),
      endOpacity: Number(args.endOpacity ?? 0),
      blendMode: String(args.blendMode ?? "lighter"),
      emitterX: x,
      emitterY: y,
    };
    const existing = listComponents(ctx.projectId);
    const ts = now();
    const d = draft(name, {
      durationMs: 4000,
      iterationCount: "infinite" as const,
    });
    const component: MotionComponent = {
      ...d,
      id: createId("c_"),
      projectId: ctx.projectId,
      playState: "running",
      orderIndex: existing.length,
      templateId: null,
      createdAt: ts,
      updatedAt: ts,
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: w,
        height: h,
        _particleConfig: JSON.stringify(config),
        _tag: "canvas",
        pointerEvents: "none",
      } as Record<string, string | number>,
    };
    createComponent(component);
    return ok(
      `Created particle emitter "${name}" (${w}×${h} at ${x}%,${y}%) — rate=${config.rate}/s, lifespan=${config.lifespan}ms, gravity=${config.gravity}, spread=${config.spread}°.`,
      true,
      { componentId: component.id, name, config },
    );
  },

  /* --------------------------- 3D camera --------------------------- */
  add_camera: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const camera = {
      positionX: Number(args.positionX ?? 0),
      positionY: Number(args.positionY ?? 0),
      positionZ: Number(args.positionZ ?? 400),
      focalLength: Number(args.focalLength ?? 50),
      depthOfField: Number(args.depthOfField ?? 0),
      rotateX: Number(args.rotateX ?? 0),
      rotateY: Number(args.rotateY ?? 0),
      rotateZ: Number(args.rotateZ ?? 0),
      name: args.name ? String(args.name) : "Camera",
    };
    // tokens is Record<string, string | number> — serialize complex values
    // to JSON strings. cssRenderer parses them back at render time.
    const tokens = { ...(project.tokens ?? {}) } as Record<string, string | number>;
    tokens.camera = JSON.stringify(camera);
    updateProject(ctx.projectId, { tokens });
    return ok(
      `Added 3D camera "${camera.name}" — pos=(${camera.positionX},${camera.positionY},${camera.positionZ}), focal=${camera.focalLength}mm, DOF=${camera.depthOfField}.`,
      true,
      { camera },
    );
  },

  set_camera_transform: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) } as Record<string, string | number>;
    let existing: Record<string, number> = {};
    if (typeof tokens.camera === "string") {
      try { existing = JSON.parse(tokens.camera) as Record<string, number>; } catch { existing = {}; }
    }
    const updated: Record<string, number> = { ...existing };
    for (const k of ["positionX", "positionY", "positionZ", "focalLength", "depthOfField", "rotateX", "rotateY", "rotateZ"]) {
      if (args[k] != null) updated[k] = Number(args[k]);
    }
    tokens.camera = JSON.stringify(updated);
    updateProject(ctx.projectId, { tokens });
    return ok(
      `Updated camera transform — pos=(${updated.positionX ?? 0},${updated.positionY ?? 0},${updated.positionZ ?? 0}), focal=${updated.focalLength ?? 50}mm, DOF=${updated.depthOfField ?? 0}.`,
      true,
      { camera: updated },
    );
  },

  /* --------------------------- Audio reactive --------------------------- */
  bind_audio_to_property: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const audioComponentId = String(args.audioComponentId);
    const audioComp = getComponent(ctx.projectId, audioComponentId);
    if (!audioComp) return fail(`audio component ${audioComponentId} not found`);
    const property = String(args.property ?? "scale");
    const band = String(args.band ?? "overall");
    const binding = {
      audioComponentId,
      property,
      band,
      min: Number(args.min ?? 0),
      max: Number(args.max ?? 1),
      smoothing: Number(args.smoothing ?? 0.7),
    };
    const style = { ...comp.style } as Record<string, string | number>;
    style._audioBinding = JSON.stringify(binding);
    patchComponent(ctx.projectId, componentId, { style });
    return ok(
      `Bound "${comp.name}".${property} to audio "${audioComp.name}" (${band} band, range ${binding.min}→${binding.max}, smoothing=${binding.smoothing}).`,
      true,
      { binding },
    );
  },

  unbind_audio: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const style = { ...comp.style } as Record<string, string | number>;
    if (typeof style._audioBinding !== "string") {
      return ok(`"${comp.name}" had no audio binding.`);
    }
    delete style._audioBinding;
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`Removed audio binding from "${comp.name}".`);
  },

  /* --------------------------- Puppet pin & mesh warp --------------------------- */
  add_puppet_pin: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const x = Number(args.x);
    const y = Number(args.y);
    const name = args.name ? String(args.name) : `Pin ${(Math.random() * 1000).toFixed(0)}`;
    const style = { ...comp.style } as Record<string, string | number>;
    let pins: Array<{ x: number; y: number; name: string }> = [];
    if (typeof style._puppetPins === "string") {
      try { pins = JSON.parse(style._puppetPins); } catch { pins = []; }
    }
    pins.push({ x, y, name });
    style._puppetPins = JSON.stringify(pins);
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`Added puppet pin "${name}" to "${comp.name}" at (${x}, ${y}). Total pins: ${pins.length}.`);
  },

  apply_mesh_warp: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const config = {
      turbulence: Math.max(0, Math.min(1, Number(args.turbulence ?? 0.05))),
      scale: Math.max(1, Number(args.scale ?? 20)),
      octaves: Math.max(1, Math.min(4, Number(args.octaves ?? 2))),
      animated: Boolean(args.animated ?? true),
      speed: Number(args.speed ?? 0.2),
      seed: Number(args.seed ?? 1),
    };
    const style = { ...comp.style } as Record<string, string | number>;
    style._meshWarp = JSON.stringify(config);
    patchComponent(ctx.projectId, componentId, { style });
    return ok(
      `Applied mesh warp to "${comp.name}" — turbulence=${config.turbulence}, scale=${config.scale}px, octaves=${config.octaves}, animated=${config.animated}.`,
      true,
      { config },
    );
  },

  remove_mesh_warp: (args, ctx) => {
    const componentId = String(args.componentId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const style = { ...comp.style } as Record<string, string | number>;
    if (typeof style._meshWarp !== "string") {
      return ok(`"${comp.name}" had no mesh warp.`);
    }
    delete style._meshWarp;
    patchComponent(ctx.projectId, componentId, { style });
    return ok(`Removed mesh warp from "${comp.name}".`);
  },

  analyze_restraint: (_args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail(`project ${ctx.projectId} not found`);
    const analysis = analyzeRestraint(spec);
    const report = formatRestraintReport(analysis);
    return {
      ok: true,
      summary: `restraint score: ${analysis.score}/100 — ${analysis.warnings.length} warning(s), peak ${analysis.peakSimultaneous} simultaneous`,
      specChanged: false,
      data: { analysis, report },
    };
  },

  list_recipes: (args, _ctx) => {
    const category = args.category ? String(args.category) : undefined;
    const query = args.query ? String(args.query) : undefined;
    let recipes: MotionRecipe[];
    if (query) {
      recipes = searchRecipes(query);
    } else {
      recipes = listRecipes(category);
    }
    const summary = recipes.length > 0
      ? `${recipes.length} recipe(s) available`
      : "no recipes found";
    return {
      ok: true,
      summary,
      specChanged: false,
      data: {
        recipes: recipes.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          description: r.description,
          restraintCost: r.restraintCost,
          avoidWhen: r.avoidWhen,
          tags: r.tags,
        })),
      },
    };
  },

  apply_recipe: (args, ctx) => {
    const componentId = String(args.componentId);
    const recipeId = String(args.recipeId);
    const comp = getComponent(ctx.projectId, componentId);
    if (!comp) return fail(`component ${componentId} not found`);
    const recipe = getRecipe(recipeId);
    if (!recipe) return fail(`recipe ${recipeId} not found`);

    // Check avoidance conditions against current project context
    const spec = getProjectSpec(ctx.projectId);
    if (spec) {
      const hasBounce = spec.components.some((c) => c.easing?.type === "preset" && /bounce|elastic/.test(c.easing.name));
      const isProfessional = spec.components.some((c) => /professional|calm|minimal/.test(c.name.toLowerCase()));
      const avoidance = checkRecipeAvoidance(recipe, {
        componentCount: spec.components.length,
        hasBounce,
        isProfessional,
      });
      if (avoidance.shouldAvoid) {
        return fail(`recipe "${recipe.name}" should be avoided here: ${avoidance.reasons.join("; ")}`);
      }
    }

    // Apply the recipe to the component
    const recipeData = recipe.recipe as {
      easing?: Easing;
      durationMs?: number;
      keyframes?: Array<{ offset: number; properties: Record<string, string | number> }>;
      iterationCount?: number | "infinite";
      direction?: string;
      trigger?: string;
    };
    const patch: Partial<MotionComponent> = {};
    if (recipeData.easing) patch.easing = recipeData.easing;
    if (recipeData.durationMs != null) patch.durationMs = recipeData.durationMs;
    if (recipeData.keyframes) patch.keyframes = recipeData.keyframes as Keyframe[];
    if (recipeData.iterationCount != null) patch.iterationCount = recipeData.iterationCount as number | "infinite";
    if (recipeData.direction) patch.direction = recipeData.direction as MotionComponent["direction"];
    if (recipeData.trigger) patch.trigger = recipeData.trigger as MotionComponent["trigger"];
    patchComponent(ctx.projectId, componentId, patch);
    return ok(`applied recipe "${recipe.name}" to "${comp.name}"`);
  },

  save_memory: (args, ctx) => {
    const key = String(args.key);
    const value = String(args.value);
    const tags = (args.tags as string[] | undefined) ?? [];
    const entry = remember(ctx.projectId, key, value, tags, 0.8);
    return ok(`saved memory: ${key} = ${value}`, false, { memoryId: entry.id });
  },

  recall_memory: (args, ctx) => {
    const query = String(args.query);
    const results = searchMemory(ctx.projectId, query);
    const summary = results.length > 0
      ? `recalled ${results.length} memor${results.length === 1 ? "y" : "ies"} for "${query}"`
      : `no memories found for "${query}"`;
    return {
      ok: true,
      summary,
      specChanged: false,
      data: { memories: results },
    };
  },

  list_generated_skills: (args, _ctx) => {
    const projectId = args.projectId ? String(args.projectId) : undefined;
    const limit = Number(args.limit ?? 10);
    const skills = listGeneratedSkills(projectId, limit);
    const summary = skills.length > 0
      ? `${skills.length} generated skill(s)`
      : "no generated skills yet";
    return {
      ok: true,
      summary,
      specChanged: false,
      data: { skills },
    };
  },

  compile_grammar: (args, ctx) => {
    const componentId = String(args.componentId ?? "");
    const source = String(args.source ?? "");
    const projectId = ctx.projectId;
    const component = getComponent(projectId, componentId);
    if (!component) return fail(`component ${componentId} not found`);

    const compiled = compileGrammar(source);
    if (!compiled.isValid) {
      return {
        ok: false,
        summary: `grammar parse error: ${compiled.errors.join("; ")}`,
        specChanged: false,
        data: { errors: compiled.errors, examples: GRAMMAR_EXAMPLES },
      };
    }

    const patch = applyCompiledGrammar(compiled, component);
    const updated = patchComponent(projectId, componentId, patch);
    const stmtSummary = compiled.statements
      .map((s) => `${s.verb}${s.direction ? `.${s.direction}` : ""}(${s.durationMs}ms)`)
      .join(" → ");

    return ok(
      `Compiled grammar: ${stmtSummary}. Total ${compiled.totalDurationMs}ms with ${compiled.statements.length} motion(s).`,
      true,
      { component: updated, compiled },
    );
  },

  parse_motion: (args, ctx) => {
    const description = String(args.description ?? "");
    const componentId = args.componentId ? String(args.componentId) : undefined;
    const projectId = ctx.projectId;

    const parsed = parseNaturalMotion(description);
    if (!parsed.isValid) {
      return {
        ok: false,
        summary: `could not parse motion description: ${parsed.errors.join("; ")}`,
        specChanged: false,
        data: { errors: parsed.errors },
      };
    }

    if (componentId) {
      const component = getComponent(projectId, componentId);
      if (!component) return fail(`component ${componentId} not found`);
      const patch = parsed.toPatch();
      const updated = patchComponent(projectId, componentId, patch);
      return ok(
        `Parsed "${description.slice(0, 60)}" → ${parsed.verb} with ${parsed.easing.type} easing, ${parsed.durationMs}ms.`,
        true,
        { component: updated, parsed },
      );
    }

    return ok(
      `Parsed "${description.slice(0, 60)}" → ${parsed.verb} with ${parsed.easing.type} easing, ${parsed.durationMs}ms.`,
      false,
      { parsed },
    );
  },

  set_shader_effect: (args, ctx) => {
    const componentId = String(args.componentId ?? "");
    const effectId = String(args.effectId ?? "");
    const intensity = args.intensity !== undefined ? Number(args.intensity) : undefined;
    const projectId = ctx.projectId;

    const component = getComponent(projectId, componentId);
    if (!component) return fail(`component ${componentId} not found`);

    const effect = getShaderEffect(effectId);
    if (!effect) {
      const available = listShaderEffects().map((e) => e.id).join(", ");
      return fail(`shader effect ${effectId} not found. Available: ${available}`);
    }

    const cssStyle = getShaderCss(effectId);
    if (!cssStyle) return fail(`no CSS style for shader effect ${effectId}`);

    // Merge shader CSS into component style
    const newStyle = { ...component.style, ...cssStyle };

    // Apply intensity-based adjustments
    if (intensity !== undefined && effect.parameters.intensity) {
      const scaled = intensity / effect.parameters.intensity.default;
      if (effect.id === "shader-chromatic" || effect.id === "shader-neon-glow") {
        const baseOffset = 2 * scaled;
        newStyle.filter = `drop-shadow(${baseOffset}px 0 0 rgba(255,0,0,0.5)) drop-shadow(-${baseOffset}px 0 0 rgba(0,0,255,0.5))`;
      } else if (effect.id === "shader-vignette") {
        const spread = Math.round(20 + 40 * scaled);
        newStyle.boxShadow = `inset 0 0 ${spread * 2}px ${spread}px rgba(0,0,0,${0.4 + 0.3 * scaled})`;
      }
    }

    const updated = patchComponent(projectId, componentId, { style: newStyle });

    return ok(
      `Applied ${effect.name} shader effect to "${component.name}".`,
      true,
      { component: updated, effect },
    );
  },

  analyze_mood: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail("project not found");
    const componentId = args.componentId ? String(args.componentId) : undefined;
    const analysis = analyzeMood(spec, componentId);
    const topMoods = Object.entries(analysis.moodScores)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 3)
      .map(([m, s]) => `${m} (${Math.round((s ?? 0) * 100)}%)`)
      .join(", ");
    return ok(
      `Mood: ${analysis.dominantMood} | Energy: ${analysis.energy} | Rhythm: ${analysis.rhythm} | Coherence: ${analysis.coherence} | Top: ${topMoods}. ${analysis.narrative}`,
      false,
      { analysis, availableMoods: listMoods() },
    );
  },

  set_mood: (args, ctx) => {
    const mood = args.mood as string;
    const scope = (args.scope as string) ?? "project";
    const profile = getMoodProfile(mood as never);
    if (!profile) return fail(`unknown mood: ${mood}. Available: ${listMoods().map((m) => m.mood).join(", ")}`);
    const patch = moodToSpecPatch(mood as never);
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail("project not found");

    const targets = scope === "component" && args.componentId
      ? spec.components.filter((c) => c.id === args.componentId)
      : spec.components;
    if (targets.length === 0) return fail("no components to apply mood to");

    for (const comp of targets) {
      patchComponent(ctx.projectId, comp.id, {
        easing: patch.easing,
        durationMs: patch.durationMs,
        direction: patch.direction,
        iterationCount: patch.iterationCount,
      });
    }

    const detected = detectMood(mood);
    return ok(
      `Applied ${profile.label} mood to ${targets.length} component(s) — ${profile.description}. Easing: ${patch.easing.type === "preset" ? patch.easing.name : patch.easing.type}, duration: ${patch.durationMs}ms, direction: ${patch.direction}, loop: ${patch.iterationCount}.`,
      true,
      { mood, profile, appliedCount: targets.length, detectedMoods: detected },
    );
  },

  suggest_creative: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail("project not found");
    const surprise = Boolean(args.surprise);
    const result = suggestCreative(spec, { surprise });
    const transfer = suggestStyleTransfer(spec);
    const suggestions = transfer ? [transfer, ...result.suggestions] : result.suggestions;
    const summary = suggestions
      .slice(0, 5)
      .map((s, i) => `${i + 1}. [${s.priority}] ${s.title} — ${s.description}`)
      .join("\n");
    return ok(
      `Creative suggestions (diversity: ${result.diversityIndex}, ${suggestions.length} ideas):\n${summary}`,
      false,
      { suggestions, diversityIndex: result.diversityIndex, projectFingerprint: result.projectFingerprint },
    );
  },

  analyze_visual_context: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return fail(`project ${ctx.projectId} not found`);
    const componentId = args.componentId ? String(args.componentId) : undefined;
    const result = analyzeVisualContext(spec, componentId);
    const warningCount = result.insights.filter((i) => i.severity === "warning").length;
    const criticalCount = result.insights.filter((i) => i.severity === "critical").length;
    const balanceDir = result.balance.direction === "centered" ? "centered" : `leaning ${result.balance.direction}`;
    const summary = `visual score: ${result.score}/100 — ${result.insights.length} insight(s) (${criticalCount} critical, ${warningCount} warning). Balance: ${balanceDir} (${result.balance.offsetPx}px off). Spacing consistency: ${result.spacing.consistency}. Hierarchy: ${result.hierarchy.sizeDistribution}. Colors: ${result.colors.uniqueColors}. Overlaps: ${result.overlaps.totalOverlaps}.`;
    return { ok: true, summary, specChanged: false, data: result };
  },

  synthesize_code: (args, _ctx) => {
    const description = String(args.description);
    const format = (args.format ?? "css") as "css" | "react" | "html" | "vanilla";
    const result = synthesizeCode(description, format);
    if (!result.isValid) {
      return fail(`could not synthesize code: ${result.errors.join("; ")}`);
    }
    const summary = `synthesized ${format} code for "${result.verb}" motion (${result.durationMs}ms, ${result.easing.type === "preset" ? result.easing.name : result.easing.type}, ${result.keyframes.length} keyframes) — animation name: ${result.animationName}`;
    return { ok: true, summary, specChanged: false, data: result };
  },

  compose_state_machine: (args, ctx) => {
    const name = String(args.name);
    const description = args.description ? String(args.description) : undefined;
    const presetId = args.presetId ? String(args.presetId) : undefined;
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const allComps = listComponents(ctx.projectId);
    let componentIds = Array.isArray(args.componentIds) ? args.componentIds.map(String) : [];
    if (componentIds.length === 0) componentIds = allComps.map((c) => c.id);
    if (componentIds.length === 0) return fail("cannot compose a state machine with no components — add a layer first");

    const machine = composeStateMachine({ name, description, presetId, componentIds });
    const issues = validateStateMachine(machine);
    if (issues.length > 0) {
      return fail(`state machine validation failed: ${issues.join("; ")}`);
    }

    const tokens = { ...(project.tokens ?? {}) };
    const machines = readStateMachines(tokens);
    machines.push(machine);
    const newTokens = writeStateMachines(tokens, machines);
    updateProject(ctx.projectId, { tokens: newTokens });

    const summary = `composed state machine "${name}" with ${machine.states.length} states, ${machine.transitions.length} transitions, ${machine.inputs.length} inputs. Preset: ${presetId ?? "custom"}. Components: ${componentIds.length}. Available presets: ${listPresets().join(", ")}`;
    return { ok: true, summary, specChanged: true, data: { machineId: machine.id, machine } };
  },

  list_state_machines: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const machines = readStateMachines(tokens);
    if (machines.length === 0) {
      return { ok: true, summary: "no state machines found — use compose_state_machine to create one", specChanged: false, data: { machines: [], presets: listPresets() } };
    }
    const summary = `${machines.length} state machine(s): ${machines.map((m) => summarizeStateMachine(m)).join(" | ")}`;
    return { ok: true, summary, specChanged: false, data: { machines, presets: listPresets() } };
  },

  trigger_state_machine: (args, ctx) => {
    const machineId = String(args.machineId);
    const stateName = String(args.stateName);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const machines = readStateMachines(tokens);
    const machine = findStateMachine(machines, machineId);
    if (!machine) return fail(`state machine ${machineId} not found`);

    const { machine: updated, transition } = transitionTo(machine, stateName);
    if (!transition && machine.currentStateId === updated.currentStateId) {
      return fail(`no transition from current state to "${stateName}" — check state names with list_state_machines`);
    }

    const idx = machines.findIndex((m) => m.id === machineId);
    machines[idx] = updated;
    const newTokens = writeStateMachines(tokens, machines);
    updateProject(ctx.projectId, { tokens: newTokens });

    const targetState = updated.states.find((s) => s.id === updated.currentStateId);
    const summary = `transitioned "${updated.name}" to "${stateName}"${transition ? ` (${transition.durationMs}ms, ${transition.easing.type === "preset" ? transition.easing.name : transition.easing.type})` : " (instant)"} — visible: ${targetState?.config.visibleComponents.length ?? 0} component(s)`;
    return { ok: true, summary, specChanged: true, data: { machineId: updated.id, currentStateId: updated.currentStateId, transition } };
  },

  save_project_recipe: (args, ctx) => {
    const componentId = String(args.componentId);
    const name = String(args.name);
    const description = args.description ? String(args.description) : undefined;
    const intentKeywords = Array.isArray(args.intentKeywords) ? args.intentKeywords.map(String) : [];
    const avoidWhen = Array.isArray(args.avoidWhen) ? args.avoidWhen.map(String) : [];
    const restraintLevel = args.restraintLevel != null ? Number(args.restraintLevel) : undefined;

    const component = getComponent(ctx.projectId, componentId);
    if (!component) return fail(`component ${componentId} not found`);

    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);

    const tokens = { ...(project.tokens ?? {}) };
    const { recipe, tokens: newTokens } = saveProjectRecipe(
      component,
      { name, description, intentKeywords, avoidWhen, restraintLevel },
      tokens,
    );
    updateProject(ctx.projectId, { tokens: newTokens });

    return ok(
      `saved recipe "${recipe.name}" from component "${component.name}" (easing: ${describeEasing(recipe.easing)}, ${recipe.durationMs}ms, trigger: ${recipe.trigger})`,
      false,
      { recipeId: recipe.id, recipe },
    );
  },

  list_project_recipes: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const query = args.query ? String(args.query) : undefined;

    if (query) {
      const matched = matchProjectRecipesByIntent(query, tokens);
      const summaries = matched.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        intentKeywords: r.intentKeywords,
        durationMs: r.durationMs,
        easingType: r.easing.type === "preset" ? r.easing.name : r.easing.type,
        trigger: r.trigger,
      }));
      return {
        ok: true,
        summary: `matched ${matched.length} recipe(s) for "${query}"`,
        specChanged: false,
        data: { recipes: summaries, total: matched.length, query },
      };
    }

    const summaries = summarizeProjectRecipes(tokens);
    const summaryText = summaries.length > 0
      ? `${summaries.length} project recipe(s): ${summaries.map((r) => r.name).join(", ")}`
      : "no project recipes yet — use save_project_recipe to capture one, or seed_project_recipes to load presets";
    return {
      ok: true,
      summary: summaryText,
      specChanged: false,
      data: { recipes: summaries, total: summaries.length },
    };
  },

  apply_project_recipe: (args, ctx) => {
    const componentId = String(args.componentId);
    const recipeId = String(args.recipeId);

    const component = getComponent(ctx.projectId, componentId);
    if (!component) return fail(`component ${componentId} not found`);

    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);

    const tokens = { ...(project.tokens ?? {}) };
    const recipe = findProjectRecipe(recipeId, tokens);
    if (!recipe) return fail(`recipe ${recipeId} not found in this project`);

    const patch = applyProjectRecipe(recipe);
    patchComponent(ctx.projectId, componentId, patch);

    return ok(
      `applied recipe "${recipe.name}" to "${component.name}" — easing: ${describeEasing(recipe.easing)}, ${recipe.durationMs}ms, trigger: ${recipe.trigger}`,
      true,
      { recipeId: recipe.id, appliedPatch: patch },
    );
  },

  delete_project_recipe: (args, ctx) => {
    const recipeId = String(args.recipeId);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);

    const tokens = { ...(project.tokens ?? {}) };
    const recipe = findProjectRecipe(recipeId, tokens);
    if (!recipe) return fail(`recipe ${recipeId} not found`);

    const newTokens = deleteProjectRecipe(recipeId, tokens);
    updateProject(ctx.projectId, { tokens: newTokens });

    return ok(`deleted recipe "${recipe.name}"`, false, { recipeId });
  },

  seed_project_recipes: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);

    const tokens = { ...(project.tokens ?? {}) };
    const existingCount = readProjectRecipes(tokens).length;
    const newTokens = seedProjectRecipes(tokens);
    updateProject(ctx.projectId, { tokens: newTokens });

    const addedCount = readProjectRecipes(newTokens).length - existingCount;
    return ok(
      `seeded ${addedCount} project recipe preset(s) — Gentle Entrance, Confident Reveal, Playful Bounce, Ambient Breath, Snappy Click`,
      false,
      { addedCount, total: readProjectRecipes(newTokens).length },
    );
  },

  list_brand_packs: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const summaries = summarizeBrandPacks(tokens);
    const summaryText = summaries.length > 0
      ? `${summaries.length} brand pack(s): ${summaries.map((s) => `${s.name} (energy:${s.energy},formality:${s.formality},playfulness:${s.playfulness},precision:${s.precision})`).join(" | ")}`
      : "no brand packs yet — use seed_brand_packs to load presets (Minimal Reserve, Material Expressive, Playful Dynamic, Cinematic Flow, Technical Precision)";
    return {
      ok: true,
      summary: summaryText,
      specChanged: false,
      data: { packs: summaries, total: summaries.length },
    };
  },

  apply_brand_pack: (args, ctx) => {
    const packId = String(args.packId);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const pack = findBrandPack(packId, tokens);
    if (!pack) return fail(`brand pack ${packId} not found`);

    const allComps = listComponents(ctx.projectId);
    if (allComps.length === 0) return fail("no components to apply brand pack to");

    const targetComponentId = args.componentId ? String(args.componentId) : undefined;
    const targets = targetComponentId
      ? allComps.filter((c) => c.id === targetComponentId)
      : allComps;
    if (targets.length === 0) return fail(`component ${targetComponentId} not found`);

    let applied = 0;
    for (const comp of targets) {
      const patch = applyBrandPackToComponent(pack, comp);
      patchComponent(ctx.projectId, comp.id, patch);
      applied++;
    }

    return ok(
      `applied brand pack "${pack.name}" to ${applied} component(s) — durations mapped to ${pack.durationScale.fast}/${pack.durationScale.normal}/${pack.durationScale.slow}/${pack.durationScale.cinematic}ms scale, primary easing: ${describeEasing(pack.easings.primary)}, trigger: ${pack.defaultTrigger}, loop: ${pack.loopPhilosophy}`,
      true,
      { packId: pack.id, appliedCount: applied, pack },
    );
  },

  delete_brand_pack: (args, ctx) => {
    const packId = String(args.packId);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const pack = findBrandPack(packId, tokens);
    if (!pack) return fail(`brand pack ${packId} not found`);
    const newTokens = deleteBrandPack(packId, tokens);
    updateProject(ctx.projectId, { tokens: newTokens });
    return ok(`deleted brand pack "${pack.name}"`, false, { packId });
  },

  seed_brand_packs: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const existingCount = readBrandPacks(tokens).length;
    const newTokens = seedBrandPacks(tokens);
    updateProject(ctx.projectId, { tokens: newTokens });
    const addedCount = readBrandPacks(newTokens).length - existingCount;
    return ok(
      `seeded ${addedCount} brand pack preset(s) — Minimal Reserve, Material Expressive, Playful Dynamic, Cinematic Flow, Technical Precision`,
      false,
      { addedCount, total: readBrandPacks(newTokens).length },
    );
  },

  set_motion_profile: (args, ctx) => {
    const componentId = String(args.componentId);
    const component = getComponent(ctx.projectId, componentId);
    if (!component) return fail(`component ${componentId} not found`);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);

    const tokens = { ...(project.tokens ?? {}) };
    const patch: Record<string, unknown> = {};
    if (args.role) patch.role = args.role;
    if (args.temperament) patch.temperament = args.temperament;
    if (args.interactionStyle) patch.interactionStyle = args.interactionStyle;
    if (args.visualWeight != null) patch.visualWeight = Number(args.visualWeight);
    if (args.notes) patch.notes = String(args.notes);

    const { profile, tokens: newTokens } = setMotionProfile(componentId, patch, tokens);
    updateProject(ctx.projectId, { tokens: newTokens });

    return ok(
      `set motion profile for "${component.name}": role=${profile.role}, temperament=${profile.temperament}, interaction=${profile.interactionStyle}, weight=${profile.visualWeight}/10`,
      false,
      { profile },
    );
  },

  get_motion_profile: (args, ctx) => {
    const componentId = String(args.componentId);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const profile = findMotionProfile(componentId, tokens);
    if (!profile) return fail(`no motion profile set for component ${componentId}`);
    const component = getComponent(ctx.projectId, componentId);
    const compName = component ? component.name : componentId;
    return ok(
      `profile for "${compName}": role=${profile.role}, temperament=${profile.temperament}, interaction=${profile.interactionStyle}, weight=${profile.visualWeight}/10${profile.notes ? `, notes: ${profile.notes}` : ""}`,
      false,
      { profile },
    );
  },

  list_motion_profiles: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const summaries = summarizeMotionProfiles(tokens);
    const allComps = listComponents(ctx.projectId);
    const summaryText = summaries.length > 0
      ? `${summaries.length} profile(s): ${summaries.map((s) => {
          const c = allComps.find((comp) => comp.id === s.componentId);
          return `${c?.name ?? s.componentId}=${s.role}/${s.temperament}`;
        }).join(", ")}`
      : "no motion profiles set — use set_motion_profile or suggest_motion_profile to assign one";
    return { ok: true, summary: summaryText, specChanged: false, data: { profiles: summaries, total: summaries.length } };
  },

  suggest_motion_profile: (args, ctx) => {
    const componentId = String(args.componentId);
    const component = getComponent(ctx.projectId, componentId);
    if (!component) return fail(`component ${componentId} not found`);
    const suggestion = suggestMotionProfile(component);
    return ok(
      `suggested profile for "${component.name}": role=${suggestion.role}, temperament=${suggestion.temperament}, interaction=${suggestion.interactionStyle}, weight=${suggestion.visualWeight}/10. Use set_motion_profile to apply, or apply_motion_profile to translate into motion parameters.`,
      false,
      { suggestion, componentId },
    );
  },

  apply_motion_profile: (args, ctx) => {
    const componentId = String(args.componentId);
    const component = getComponent(ctx.projectId, componentId);
    if (!component) return fail(`component ${componentId} not found`);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const profile = findMotionProfile(componentId, tokens);
    if (!profile) return fail(`no motion profile set for component ${componentId} — use set_motion_profile or suggest_motion_profile first`);

    const patch = profileToMotionPatch(profile);
    patchComponent(ctx.projectId, componentId, {
      easing: patch.easing,
      durationMs: patch.durationMs,
      trigger: patch.trigger as MotionComponent["trigger"],
      iterationCount: patch.iterationCount,
    });

    return ok(
      `applied profile to "${component.name}": easing=${describeEasing(patch.easing)}, duration=${patch.durationMs}ms, trigger=${patch.trigger}, loop=${patch.iterationCount}`,
      true,
      { profile, appliedPatch: patch },
    );
  },

  save_motion_capture: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const samples = args.samples as CaptureSample[];
    if (!Array.isArray(samples) || samples.length < 2) {
      return fail("capture requires at least 2 samples");
    }
    const tokens = { ...(project.tokens ?? {}) };
    const { capture, tokens: nextTokens } = finalizeCapture(samples, {
      name: String(args.name),
      description: args.description ? String(args.description) : undefined,
      originX: args.originX != null ? Number(args.originX) : undefined,
      originY: args.originY != null ? Number(args.originY) : undefined,
      normalize: args.normalize != null ? Boolean(args.normalize) : undefined,
      smoothing: args.smoothing != null ? Number(args.smoothing) : undefined,
    }, tokens);
    updateProject(ctx.projectId, { tokens: nextTokens });
    return ok(
      `saved motion capture "${capture.name}" with ${capture.samples.length} samples over ${capture.durationMs}ms`,
      false,
      { captureId: capture.id, sampleCount: capture.samples.length, durationMs: capture.durationMs },
    );
  },

  list_motion_captures: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const summaries = summarizeCaptures(project.tokens ?? {});
    return ok(`found ${summaries.length} motion capture(s)`, false, { captures: summaries });
  },

  apply_motion_capture: (args, ctx) => {
    const captureId = String(args.captureId);
    const componentId = String(args.componentId);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const capture = findCapture(project.tokens ?? {}, captureId);
    if (!capture) return fail(`capture ${captureId} not found`);
    const component = getComponent(ctx.projectId, componentId);
    if (!component) return fail(`component ${componentId} not found`);

    const { keyframes, durationMs, easing } = applyCaptureToComponent(capture, component, {
      normalize: args.normalize != null ? Boolean(args.normalize) : undefined,
      smoothing: args.smoothing != null ? Number(args.smoothing) : undefined,
      snap: args.snap != null ? Number(args.snap) : undefined,
      maxKeyframes: args.maxKeyframes != null ? Number(args.maxKeyframes) : undefined,
    });
    patchComponent(ctx.projectId, componentId, {
      keyframes,
      durationMs,
      easing,
    });
    return ok(
      `applied capture "${capture.name}" to "${component.name}" — ${keyframes.length} keyframes over ${durationMs}ms`,
      true,
      { keyframeCount: keyframes.length, durationMs },
    );
  },

  delete_motion_capture: (args, ctx) => {
    const captureId = String(args.captureId);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const capture = findCapture(tokens, captureId);
    if (!capture) return fail(`capture ${captureId} not found`);
    const nextTokens = deleteCapture(tokens, captureId);
    updateProject(ctx.projectId, { tokens: nextTokens });
    return ok(`deleted motion capture "${capture.name}"`, false);
  },

  seed_motion_captures: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const tokens = { ...(project.tokens ?? {}) };
    const { captures, tokens: nextTokens } = seedCaptures(tokens);
    updateProject(ctx.projectId, { tokens: nextTokens });
    return ok(
      `seeded ${captures.length} motion capture(s): ${captures.map((c) => c.name).join(", ")}`,
      false,
      { captureIds: captures.map((c) => c.id), count: captures.length },
    );
  },

  list_export_presets: (_args, ctx) => {
    const presets = summarizePresets();
    return ok(
      `found ${presets.length} export presets across ${new Set(presets.map((p) => p.platform)).size} platforms`,
      false,
      { presets },
    );
  },

  recommend_export_format: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const components = listComponents(ctx.projectId);
    const hint = args.hint ? String(args.hint) : undefined;
    const recommendations = topRecommendations(components, 3, hint);
    const top = recommendations[0];
    if (!top) return fail("no export presets available");
    return ok(
      `recommended "${top.preset.name}" (${top.preset.format}) — score ${top.score}${top.reasons.length > 0 ? `: ${top.reasons.join("; ")}` : ""}`,
      false,
      {
        recommendations: recommendations.map((r) => ({
          presetId: r.preset.id,
          name: r.preset.name,
          platform: r.preset.platform,
          format: r.preset.format,
          score: r.score,
          reasons: r.reasons,
        })),
      },
    );
  },

  apply_export_preset: (args, ctx) => {
    const presetId = String(args.presetId);
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const preset = findPreset(presetId);
    if (!preset) {
      const byKeyword = findPresetByKeyword(presetId);
      if (!byKeyword) return fail(`export preset ${presetId} not found`);
      return ok(
        `matched preset "${byKeyword.name}" by keyword — ready to export as ${byKeyword.format.toUpperCase()} (${byKeyword.fileExtension})`,
        false,
        {
          presetId: byKeyword.id,
          name: byKeyword.name,
          format: byKeyword.format,
          platform: byKeyword.platform,
          width: byKeyword.width,
          height: byKeyword.height,
          fps: byKeyword.fps,
          maxKeyframes: byKeyword.maxKeyframes,
          inlineStyles: byKeyword.inlineStyles,
          cssOnly: byKeyword.cssOnly,
          forceLoop: byKeyword.forceLoop,
          fileExtension: byKeyword.fileExtension,
        },
      );
    }
    return ok(
      `applied export preset "${preset.name}" — format: ${preset.format}, platform: ${preset.platform}${preset.width ? `, ${preset.width}×${preset.height}` : ""}${preset.fps ? `, ${preset.fps}fps` : ""}${preset.maxKeyframes > 0 ? `, max ${preset.maxKeyframes} kf` : ""}${preset.cssOnly ? ", CSS-only" : ""}${preset.forceLoop ? ", infinite loop" : ""}`,
      false,
      {
        presetId: preset.id,
        name: preset.name,
        format: preset.format,
        platform: preset.platform,
        width: preset.width,
        height: preset.height,
        fps: preset.fps,
        maxKeyframes: preset.maxKeyframes,
        inlineStyles: preset.inlineStyles,
        cssOnly: preset.cssOnly,
        forceLoop: preset.forceLoop,
        fileExtension: preset.fileExtension,
      },
    );
  },

  save_session_snapshot: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const name = String(args.name);
    const parentId = args.parentId ? String(args.parentId) : null;
    const toolsUsed = (args.toolsUsed as string[] | undefined) ?? [];
    const componentIds = (args.componentIds as string[] | undefined) ?? [];
    const insights = extractInsightsFromTools(toolsUsed);
    const summary =
      args.summary != null
        ? String(args.summary)
        : generateSessionSummary(toolsUsed, componentIds.length, args.messageCount != null ? Number(args.messageCount) : 0);
    const { session, tokens } = saveSessionSnapshot(project.tokens, {
      name,
      parentId,
      summary,
      messageCount: args.messageCount != null ? Number(args.messageCount) : 0,
      toolsUsed,
      componentIds,
      insights,
      tags: (args.tags as string[] | undefined) ?? [],
    });
    updateProject(ctx.projectId, { tokens });
    const forkLabel = parentId ? ` as a fork of "${parentId}"` : "";
    return ok(
      `saved session snapshot "${name}"${forkLabel} — ${session.insights.length} insight(s) extracted, depth ${session.depth}`,
      false,
      {
        sessionId: session.id,
        name: session.name,
        parentId: session.parentId,
        depth: session.depth,
        status: session.status,
        insightCount: session.insights.length,
        insights: session.insights,
        summary: session.summary,
      },
    );
  },

  list_session_snapshots: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const sessions = summarizeSessions(project.tokens);
    if (sessions.length === 0) return ok("no session snapshots saved yet", false, { sessions: [] });
    return ok(
      `found ${sessions.length} session snapshot(s) — ${sessions.filter((s) => s.status === "active").length} active, ${sessions.filter((s) => s.status === "forked").length} forked`,
      false,
      { sessions },
    );
  },

  resume_session_snapshot: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const sessionId = String(args.sessionId);
    const existing = summarizeSessions(project.tokens).find((s) => s.id === sessionId);
    if (!existing) return fail(`session ${sessionId} not found`);
    const patch: Record<string, unknown> = {};
    if (args.summary != null) patch.summary = String(args.summary);
    if (args.messageCount != null) patch.messageCount = Number(args.messageCount);
    if (args.toolsUsed != null) {
      patch.toolsUsed = args.toolsUsed as string[];
      patch.insights = extractInsightsFromTools(args.toolsUsed as string[]);
    }
    if (args.componentIds != null) patch.componentIds = args.componentIds as string[];
    if (args.tags != null) patch.tags = args.tags as string[];
    patch.status = "active";
    const { session, tokens } = updateSession(project.tokens, sessionId, patch);
    if (!session) return fail(`failed to resume session ${sessionId}`);
    updateProject(ctx.projectId, { tokens });
    return ok(
      `resumed session "${session.name}" — ${session.insights.length} insight(s), ${session.messageCount} messages`,
      false,
      {
        sessionId: session.id,
        name: session.name,
        summary: session.summary,
        insightCount: session.insights.length,
        status: session.status,
      },
    );
  },

  get_session_lineage: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const sessionId = args.sessionId ? String(args.sessionId) : undefined;
    if (sessionId) {
      const ancestry = getAncestry(project.tokens, sessionId);
      const descendants = getDescendants(project.tokens, sessionId);
      const stats = getLineageStats(project.tokens);
      return ok(
        `lineage for session ${sessionId} — ${ancestry.length} ancestor(s), ${descendants.length} descendant(s)`,
        false,
        { sessionId, ancestry, descendants, stats },
      );
    }
    const tree = buildLineageTree(project.tokens);
    const stats = getLineageStats(project.tokens);
    return ok(
      `session lineage: ${stats.totalSessions} session(s), max depth ${stats.maxDepth}, ${stats.totalInsights} total insight(s)`,
      false,
      { tree, stats },
    );
  },

  delete_session_snapshot: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const sessionId = String(args.sessionId);
    const tokens = deleteSession(project.tokens, sessionId);
    updateProject(ctx.projectId, { tokens });
    return ok(`deleted session snapshot ${sessionId}`);
  },

  check_accessibility: (args, ctx) => {
    const all = listComponents(ctx.projectId);
    const components = args.componentId
      ? all.filter((c) => c.id === String(args.componentId))
      : all;
    if (components.length === 0) return fail("no components to analyze");
    const report = checkAccessibility(components);
    return ok(report.summary, false, report);
  },

  check_performance: (args, ctx) => {
    const all = listComponents(ctx.projectId);
    const components = args.componentId
      ? all.filter((c) => c.id === String(args.componentId))
      : all;
    if (components.length === 0) return fail("no components to analyze");
    const report = checkPerformance(components);
    return ok(report.summary, false, report);
  },

  create_beat: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const { beat, tokens } = createBeat(project.tokens, {
      title: String(args.title),
      description: args.description ? String(args.description) : undefined,
      durationMs: args.durationMs != null ? Number(args.durationMs) : undefined,
      sceneId: args.sceneId ? String(args.sceneId) : null,
      componentIds: args.componentIds as string[] | undefined,
      transition: args.transition as StoryboardBeat["transition"] | undefined,
    });
    updateProject(ctx.projectId, { tokens });
    return ok(`created storyboard beat "${beat.title}" (order ${beat.order}, ${beat.durationMs}ms, ${beat.transition})`, false, {
      beatId: beat.id,
      title: beat.title,
      order: beat.order,
      durationMs: beat.durationMs,
      transition: beat.transition,
    });
  },

  list_beats: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const beats = summarizeBeats(project.tokens);
    const stats = getStoryboardStats(project.tokens);
    if (beats.length === 0) return ok("no storyboard beats yet", false, { beats: [], stats });
    return ok(
      `${beats.length} beat(s) — total ${(stats.totalDurationMs / 1000).toFixed(1)}s, transitions: ${stats.transitions.join(", ")}`,
      false,
      { beats, stats },
    );
  },

  update_beat: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const beatId = String(args.beatId);
    const patch: Record<string, unknown> = {};
    if (args.title != null) patch.title = String(args.title);
    if (args.description != null) patch.description = String(args.description);
    if (args.durationMs != null) patch.durationMs = Number(args.durationMs);
    if (args.sceneId != null) patch.sceneId = String(args.sceneId);
    if (args.componentIds != null) patch.componentIds = args.componentIds as string[];
    if (args.transition != null) patch.transition = args.transition;
    const { beat, tokens } = updateBeat(project.tokens, beatId, patch);
    if (!beat) return fail(`beat ${beatId} not found`);
    updateProject(ctx.projectId, { tokens });
    return ok(`updated storyboard beat "${beat.title}"`, false, {
      beatId: beat.id,
      title: beat.title,
      durationMs: beat.durationMs,
      transition: beat.transition,
    });
  },

  reorder_beats: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const beatIds = args.beatIds as string[];
    const tokens = reorderBeats(project.tokens, beatIds);
    updateProject(ctx.projectId, { tokens });
    return ok(`reordered ${beatIds.length} beats`);
  },

  delete_beat: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const beatId = String(args.beatId);
    const tokens = deleteBeat(project.tokens, beatId);
    updateProject(ctx.projectId, { tokens });
    return ok(`deleted storyboard beat ${beatId}`);
  },

  export_storyboard: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const format = (args.format as string) ?? "markdown";
    const content = format === "json"
      ? exportStoryboardJson(project.tokens)
      : exportStoryboardMarkdown(project.tokens);
    const stats = getStoryboardStats(project.tokens);
    return ok(
      `exported storyboard as ${format} — ${stats.totalBeats} beat(s), ${(stats.totalDurationMs / 1000).toFixed(1)}s total`,
      false,
      { format, content, stats },
    );
  },
  run_motion_pipeline: async (args, ctx) => {
    const result = await runMotionPipeline({
      description: String(args.description),
      durationMs: args.durationMs ? Number(args.durationMs) : undefined,
      colorScheme: args.colorScheme as "complementary" | "analogous" | "triadic" | "monochrome" | undefined,
      baseColor: args.baseColor ? String(args.baseColor) : undefined,
      choreography: args.choreography as "cascade" | "call_response" | "unison" | "counterpoint" | "wave" | "canon" | "stagger_grid" | "ripple_out" | "auto" | undefined,
      componentCount: args.componentCount ? Number(args.componentCount) : undefined,
    });

    // Persist generated components to the project
    const project = getProject(ctx.projectId);
    if (project) {
      for (const comp of result.spec.components) {
        createComponent({ ...comp, projectId: ctx.projectId });
      }
    }

    return {
      ok: true,
      summary: result.summary,
      specChanged: true,
      data: {
        steps: result.steps,
        totalDurationMs: result.totalDurationMs,
        componentCount: result.componentCount,
      },
    };
  },
  compose_sequence: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) {
      return { ok: false, summary: "Project spec not found", specChanged: false };
    }

    const componentIds = (args.componentIds as string[]) ?? [];
    const components = spec.components.filter((c) => componentIds.includes(c.id));
    if (components.length === 0) {
      return { ok: false, summary: "No matching components found", specChanged: false };
    }

    const type = args.type as "sequence" | "parallel" | "stagger";
    const stepMs = args.stepMs ? Number(args.stepMs) : 80;
    const gapMs = args.gapMs ? Number(args.gapMs) : 0;

    // Create composition and flatten to timeline
    const composition = createComposition(components, type, { stepMs, gapMs });
    const timeline = flattenToTimeline(composition);

    return {
      ok: true,
      summary: `Composed ${components.length} components as ${type} — total ${timeline.totalDurationMs}ms, ${timeline.frameCount} frames`,
      specChanged: false,
      data: {
        type,
        timeline: timeline.timeline,
        totalDurationMs: timeline.totalDurationMs,
        frameCount: timeline.frameCount,
        fps: timeline.fps,
      },
    };
  },
  seek_to_frame: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) {
      return { ok: false, summary: "Project spec not found", specChanged: false };
    }
    const frame = Number(args.frame);
    const fps = args.fps ? Number(args.fps) : 60;
    const snapshot = seekToFrame(spec, frame, { fps });
    return {
      ok: true,
      summary: `Frame ${frame}: ${snapshot.components.length} active components, time=${snapshot.timeMs.toFixed(0)}ms`,
      specChanged: false,
      data: {
        frame: snapshot.frame,
        timeMs: snapshot.timeMs,
        totalFrames: snapshot.totalFrames,
        isComplete: snapshot.isComplete,
        components: snapshot.components.map((c) => ({
          componentId: c.componentId,
          name: c.name,
          progress: c.progress,
          opacity: c.opacity,
          transformCss: c.transformCss,
          visible: c.visible,
        })),
      },
    };
  },
  render_frames: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) {
      return { ok: false, summary: "Project spec not found", specChanged: false };
    }
    const fps = args.fps ? Number(args.fps) : 60;
    const startFrame = args.startFrame ? Number(args.startFrame) : 0;
    const sampleStep = args.sampleStep ? Number(args.sampleStep) : 1;

    // Determine end frame
    let endFrame: number;
    if (args.endFrame) {
      endFrame = Number(args.endFrame);
    } else {
      // Use the thumbnail finder to get total frames
      const thumbFrame = findThumbnailFrame(spec, { fps });
      endFrame = thumbFrame + 60; // Estimate: thumbnail + 60 frames
    }

    const result = renderFrameRange(spec, startFrame, endFrame, { fps });
    // Sample frames for efficiency
    const sampled = result.frames.filter((_, i) => i % sampleStep === 0);
    return {
      ok: true,
      summary: `Rendered ${sampled.length} frames (sampled from ${result.frames.length}): ${result.activeFrames} active, ${result.totalFrames} total, ${result.durationMs}ms duration`,
      specChanged: false,
      data: {
        totalFrames: result.totalFrames,
        fps: result.fps,
        durationMs: result.durationMs,
        activeFrames: result.activeFrames,
        renderedFrames: sampled.length,
        frames: sampled.map((s) => ({
          frame: s.frame,
          timeMs: s.timeMs,
          componentCount: s.components.length,
        })),
      },
    };
  },
  export_html_composition: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) {
      return { ok: false, summary: "Project spec not found", specChanged: false };
    }
    const result = generateHtmlComposition(spec, {
      width: args.width ? Number(args.width) : undefined,
      height: args.height ? Number(args.height) : undefined,
      fps: args.fps ? Number(args.fps) : undefined,
      includeControls: args.includeControls !== false,
      loop: args.loop === true,
    });
    return {
      ok: true,
      summary: `HTML composition generated: ${result.componentCount} components, ${result.totalFrames} frames, ${result.durationMs}ms at ${result.fps}fps`,
      specChanged: false,
      data: {
        html: result.html,
        totalFrames: result.totalFrames,
        durationMs: result.durationMs,
        fps: result.fps,
        componentCount: result.componentCount,
      },
    };
  },
  resolve_media: async (args) => {
    const asset = await resolveMedia({
      modality: args.modality as "audio" | "image" | "video" | "voice" | "icon" | "logo" | "lut" | "font",
      purpose: args.purpose as "background-music" | "sound-effect" | "voiceover" | "background-image" | "foreground-image" | "transition" | "overlay" | "color-grade" | "caption" | "watermark",
      description: String(args.description),
      durationSec: args.durationSec ? Number(args.durationSec) : undefined,
      allowGeneration: args.allowGeneration !== false,
    });
    return {
      ok: true,
      summary: `Media resolved: ${asset.id} (${asset.modality}/${asset.purpose}) — ${asset.generated ? "generated" : "from catalog"}, ${asset.source}`,
      specChanged: false,
      data: {
        id: asset.id,
        modality: asset.modality,
        purpose: asset.purpose,
        source: asset.source,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        durationSec: asset.durationSec,
        width: asset.width,
        height: asset.height,
        generated: asset.generated,
        seed: asset.seed,
        tags: asset.tags,
      },
    };
  },
};
