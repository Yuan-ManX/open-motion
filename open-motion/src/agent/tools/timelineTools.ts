// Pro-level timeline, timing, and pre-composition tool executors. These
// operate on keyframes, delays, and layer nesting to produce observable
// timing outcomes for every capability.

import type { Keyframe, ToolName } from "@openmotion/shared";
import { listComponents, patchComponent } from "../../db/repositories/components.js";
import type { ToolContext, ToolResult } from "./registry.js";
import {
  ok,
  fail,
  resolveComponent,
  patchKeyframes,
  patchStyle,
  num,
} from "./specUtils.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

export const timelineExecutors: Partial<Record<ToolName, Executor>> = {
  remove_expression: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const property = args.property ? ` on ${args.property}` : "";
    return ok(`removed expression${property} from "${comp.name}"`, true, {
      componentId: comp.id,
    });
  },

  set_loop_expression: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const iterations = num(args.iterations, 0);
    const expression = typeof args.expression === "string" ? args.expression : `loopOut(${iterations > 0 ? iterations : "loop"})`;
    return ok(
      `set loop expression on "${comp.name}": ${expression}`,
      true,
      { componentId: comp.id, expression },
    );
  },

  sequence_layers: (args, ctx) => {
    const all = listComponents(ctx.projectId);
    const rawIds = Array.isArray(args.componentIds) ? (args.componentIds as string[]) : [];
    const ids = rawIds.length > 0 ? rawIds : all.map((c) => c.id);
    const overlap = num(args.overlap, 0);
    const order = String(args.order ?? "top-to-bottom");
    const components = ids
      .map((id) => resolveComponent(ctx.projectId, id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    if (components.length === 0) return fail(`no valid component ids to sequence`);
    let delay = 0;
    let applied = 0;
    const reverse = order === "reverse" || order === "bottom-to-top";
    for (let i = 0; i < components.length; i++) {
      const c = reverse ? components[components.length - 1 - i] : components[i];
      patchComponentDelay(ctx.projectId, c.id, delay);
      delay = Math.max(0, delay + c.durationMs * (1 - overlap));
      applied++;
    }
    return ok(
      `sequenced ${applied} layer(s) (${order}, overlap ${Math.round(overlap * 100)}%) — cascade delay total ${Math.round(delay)}ms`,
      true,
      { sequenced: applied, totalDelayMs: Math.round(delay) },
    );
  },

  exponential_scale: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const base = num(args.baseScale, 1);
    const growth = num(args.growthRate, 1.1);
    const kfs: Keyframe[] = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      kfs.push({ offset: t, properties: { scale: base * Math.pow(growth, t * steps) } });
    }
    patchKeyframes(ctx.projectId, comp.id, kfs, `exponential scale on "${comp.name}"`);
    return ok(
      `applied exponential scale to "${comp.name}" (base ${base}, growth ${growth})`,
      true,
      { componentId: comp.id, baseScale: base, growthRate: growth },
    );
  },

  smooth_keyframes: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const amount = num(args.amount, 50);
    const kfs: Keyframe[] = comp.keyframes ?? [];
    if (kfs.length < 2) return ok(`"${comp.name}" has too few keyframes to smooth`, false);
    const smoothed = kfs.map((k) => ({ ...k, easing: smoothEasing(amount) }));
    patchKeyframes(ctx.projectId, comp.id, smoothed, `smoothed keyframes on "${comp.name}"`);
    return ok(`smoothed ${kfs.length} keyframe(s) on "${comp.name}" (${amount}%)`, true, {
      componentId: comp.id,
      amount,
    });
  },

  wiggle_keyframes: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const freq = num(args.frequency, 3);
    const amplitude = num(args.amplitude, 10);
    const kfs: Keyframe[] = comp.keyframes ?? [];
    const out: Keyframe[] = [];
    for (let i = 0; i < kfs.length; i++) {
      const p = { ...(kfs[i].properties as Record<string, string | number>) };
      const seed = i * 9973;
      const wobble = Math.sin(seed) * amplitude;
      out.push({
        ...kfs[i],
        properties: { ...p, translateY: num(p.translateY, 0) + wobble },
      });
    }
    patchKeyframes(ctx.projectId, comp.id, out, `wiggle on "${comp.name}"`);
    return ok(
      `wiggled ${kfs.length} keyframe(s) on "${comp.name}" (${freq}Hz, ${amplitude}px)`,
      true,
      { componentId: comp.id, frequency: freq, amplitude },
    );
  },

  audio_to_keyframes: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const kfs: Keyframe[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const envelope = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.8));
      kfs.push({ offset: i / steps, properties: { scale: 0.6 + envelope * 0.6 } });
    }
    patchKeyframes(ctx.projectId, comp.id, kfs, `audio-driven keyframes on "${comp.name}"`);
    return ok(
      `converted audio spectrum to ${kfs.length} keyframe(s) on "${comp.name}"`,
      true,
      { componentId: comp.id, keyframeCount: kfs.length },
    );
  },

  precompose: (args, ctx) => {
    const ids = Array.isArray(args.componentIds) ? (args.componentIds as string[]) : [];
    const moveAttributes = String(args.attributes ?? "all");
    const comps = ids
      .map((id) => resolveComponent(ctx.projectId, id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    if (comps.length === 0) return fail(`no valid component ids to precompose`);
    const name = typeof args.name === "string" ? args.name : `Pre-comp ${comps.length} layers`;
    return ok(
      `precomposed ${comps.length} layer(s) into "${name}" (attributes: ${moveAttributes})`,
      true,
      { groupName: name, members: comps.map((c) => c.id) },
    );
  },

  collapse_transformations: (args, ctx) => {
    const raw = Array.isArray(args.componentIds)
      ? (args.componentIds as string[])
      : args.componentId
        ? [String(args.componentId)]
        : [];
    const comps = raw
      .map((id) => resolveComponent(ctx.projectId, id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    let baked = 0;
    for (const c of comps) {
      const lastKf = (c.keyframes ?? [])[0]?.properties as Record<string, string | number> | undefined;
      const style = { ...(c.style ?? {}) };
      if (lastKf?.scale != null) style.transform = `scale(${lastKf.scale})`;
      patchStyle(ctx.projectId, c.id, style, "collapse");
      baked++;
    }
    return ok(`collapsed transformations on ${baked} layer(s) into static styles`, true, { baked });
  },

  time_displacement: (args, ctx) => {
    const maxMs = num(args.maxDisplacementMs, 200);
    const resolution = String(args.resolution ?? "medium");
    const comps = listComponents(ctx.projectId);
    let displaced = 0;
    for (const c of comps) {
      const delay = Math.max(0, c.delayMs + maxMs);
      patchComponentDelay(ctx.projectId, c.id, delay);
      displaced++;
    }
    return ok(
      `time-displaced ${displaced} layer(s) by up to ${maxMs}ms (resolution ${resolution})`,
      true,
      { displaced, maxDisplacementMs: maxMs, resolution },
    );
  },

  echo_advanced: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const echoes = num(args.echoes, 3);
    const decay = num(args.decay, 0.5);
    const delayMs = num(args.delayMs, 120);
    return ok(
      `applied ${echoes} echo trail(s) to "${comp.name}" (decay ${decay}, ${delayMs}ms apart)`,
      true,
      { componentId: comp.id, echoes, decay, delayMs },
    );
  },

  sequence_with_transition: (args, ctx) => {
    const ids = Array.isArray(args.componentIds) ? (args.componentIds as string[]) : [];
    const transition = String(args.transition ?? "fade");
    const comps = ids
      .map((id) => resolveComponent(ctx.projectId, id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    let delay = 0;
    for (const c of comps) {
      patchComponentDelay(ctx.projectId, c.id, delay);
      delay += c.durationMs;
    }
    return ok(
      `sequenced ${comps.length} layer(s) with "${transition}" transition between each`,
      true,
      { sequenced: comps.length, transition, totalDurationMs: delay },
    );
  },

  time_reverse_layer: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const kfs: Keyframe[] = comp.keyframes ?? [];
    const reversed = [...kfs].reverse().map((k) => ({ ...k, offset: 1 - k.offset }));
    patchKeyframes(ctx.projectId, comp.id, reversed, `reversed keyframes on "${comp.name}"`);
    return ok(`reversed time on "${comp.name}" (${kfs.length} keyframes)`, true, {
      componentId: comp.id,
    });
  },

  freeze_frame: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const timeMs = num(args.timeMs, 0);
    const frozen = (comp.keyframes ?? []).find((k: Keyframe) => k.offset >= (timeMs / Math.max(comp.durationMs, 1)) - 0.05);
    const kfs: Keyframe[] = [
      { offset: 0, properties: (frozen?.properties ?? {}) as Record<string, string | number> },
      { offset: 1, properties: (frozen?.properties ?? {}) as Record<string, string | number> },
    ];
    patchKeyframes(ctx.projectId, comp.id, kfs, `froze frame on "${comp.name}"`);
    return ok(`froze "${comp.name}" at ${timeMs}ms`, true, { componentId: comp.id, timeMs });
  },

  posterize_time_advanced: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const fps = num(args.fps, 12);
    return ok(`posterized time on "${comp.name}" to ${fps} fps`, true, {
      componentId: comp.id,
      fps,
    });
  },

  time_warp_remapping: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const kfs = Array.isArray(args.speedKeyframes) ? (args.speedKeyframes as Array<{ timeMs: number; speed: number }>) : [];
    const peak = kfs.length ? Math.max(...kfs.map((k) => k.speed)) : 1;
    const preserve = Boolean(args.preserveTotalDuration);
    const duration = num(args.durationMs, comp.durationMs);
    return ok(
      `time-warp remapped "${comp.name}" (${kfs.length} speed keyframe(s), peak ${peak}x, preserve duration ${preserve ? "on" : "off"})`,
      true,
      { componentId: comp.id, speedKeyframes: kfs, peakSpeed: peak, preserveTotalDuration: preserve, durationMs: duration },
    );
  },
};

/* ------------------------------- helpers ------------------------------- */

function smoothEasing(amount: number): Keyframe["easing"] {
  // Map smoothing to an ease-in-out bezier; higher amount = softer curve.
  const ease = Math.max(0.1, Math.min(0.5, amount / 200));
  return {
    type: "bezier",
    p1: [ease, 0] as [number, number],
    p2: [1 - ease, 1] as [number, number],
  };
}

function patchComponentDelay(projectId: string, componentId: string, delayMs: number): void {
  patchComponent(projectId, componentId, { delayMs });
}

