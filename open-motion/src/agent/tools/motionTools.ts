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

    const pattern = String(args.pattern ?? "cascade") as "cascade" | "wave" | "ripple" | "canon" | "converge";
    const stepMs = Number(args.stepMs ?? 150);
    const baseDuration = args.durationMs != null ? Number(args.durationMs) : undefined;
    const sorted = [...comps].sort((a, b) => a.orderIndex - b.orderIndex);
    const n = sorted.length;

    for (let i = 0; i < n; i++) {
      let delay: number;
      let duration: number | undefined;

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
        default:
          delay = i * stepMs;
          duration = baseDuration;
      }

      const patch: Partial<MotionComponent> = { delayMs: delay };
      if (duration != null) patch.durationMs = duration;
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
};
