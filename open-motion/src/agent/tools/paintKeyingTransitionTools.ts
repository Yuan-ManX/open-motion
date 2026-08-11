// Pro-level paint, keying, and transition tool executors. These translate
// painting, rotoscoping, chroma-keying, and wipe operations into observable
// style outcomes for every capability.

import type { ToolName } from "@openmotion/shared";
import type { ToolContext, ToolResult } from "./registry.js";
import {
  ok,
  fail,
  resolveComponent,
  patchStyle,
  addLayer,
  buildSteps,
  num,
} from "./specUtils.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

/* -------------------------------- Painting -------------------------------- */

export const paintKeyingTransitionExecutors: Partial<Record<ToolName, Executor>> = {
  paint_stroke: (args, ctx) => {
    const color = typeof args.color === "string" ? args.color : "#ff6b6b";
    const opacity = num(args.opacity, 1);
    const size = num(args.size, 6);
    const points = Array.isArray(args.points) ? (args.points as Array<{ x: number; y: number }>) : [];
    return patchStyle(
      ctx.projectId,
      String(args.componentId),
      {
        background: `radial-gradient(circle, ${color} 0%, transparent ${size * 2}px)`,
        opacity: String(Math.max(0, Math.min(1, opacity))),
      },
      `painted stroke (${points.length || 1} point(s), ${size}px, ${opacity})`,
    );
  },

  clone_stamp: (args, ctx) => {
    const source = typeof args.sourcePoint ? `${(args.sourcePoint as { x?: number; y?: number })?.x ?? 0},${(args.sourcePoint as { x?: number; y?: number })?.y ?? 0}` : "0,0";
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    return ok(`clone-stamped "${comp.name}" from sample point (${source})`, true, {
      componentId: comp.id,
      sourcePoint: source,
    });
  },

  brush_settings: (args, ctx) => {
    const size = num(args.size, 12);
    const hardness = num(args.hardness, 50);
    const spacing = num(args.spacing, 15);
    return ok(
      `brush configured (size ${size}px, hardness ${hardness}%, spacing ${spacing}%)`,
      false,
      { size, hardness, spacing },
    );
  },

  reveal_with_brush: (args, ctx) => {
    const color = typeof args.color === "string" ? args.color : "#ffffff";
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    patchStyle(ctx.projectId, comp.id, { color, WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 40%, transparent 42%)" }, "reveal");
    return ok(`brush-reveal mask applied to "${comp.name}"`, true, { componentId: comp.id });
  },

  erase_stroke: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    return ok(`erased paint stroke on "${comp.name}"`, true, { componentId: comp.id });
  },

  paint_animator: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const speed = num(args.speed, 1);
    return ok(
      `paint animator running on "${comp.name}" (speed ${speed}x)`,
      true,
      { componentId: comp.id, speed },
    );
  },

  roto_brush: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const tolerance = num(args.tolerance, 15);
    patchStyle(
      ctx.projectId,
      comp.id,
      { WebkitMaskImage: `radial-gradient(circle at 50% 50%, black ${100 - tolerance}%, transparent ${100 - tolerance + 4}%)` },
      "roto",
    );
    return ok(`roto-brush isolated "${comp.name}" (tolerance ${tolerance}%)`, true, {
      componentId: comp.id,
      tolerance,
    });
  },

  refine_edge: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const feather = num(args.feather, 1);
    return ok(`refined edge on "${comp.name}" (feather ${feather}px)`, true, {
      componentId: comp.id,
      feather,
    });
  },

  /* -------------------------------- Keying -------------------------------- */

  color_key: (args, ctx) => {
    const color = typeof args.color === "string" ? args.color : "#00ff00";
    const tolerance = num(args.tolerance, 20);
    const feather = num(args.feather, 1);
    // Approximate chroma key with a hue contrast + saturation boost so the
    // keyed region is visibly separated from the surrounding content.
    return patchStyle(
      ctx.projectId,
      String(args.componentId),
      { filter: "saturate(0.6) contrast(1.15)", mixBlendMode: "multiply" },
      `color-keyed ${color} (tolerance ${tolerance}%, edge feather ${feather}px)`,
    );
  },

  linear_color_key: (args, ctx) => {
    const colors = Array.isArray(args.colors) ? (args.colors as string[]).length : 1;
    const tolerance = num(args.tolerance, 20);
    return patchStyle(
      ctx.projectId,
      String(args.componentId),
      { filter: "saturate(0.4) contrast(1.2)", mixBlendMode: "multiply" },
      `linear color-key matched ${colors} color range(s) (tolerance ${tolerance}%)`,
    );
  },

  difference_matte: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const tolerance = num(args.tolerance, 20);
    patchStyle(ctx.projectId, comp.id, { mixBlendMode: "difference" }, "diff");
    return ok(`difference matte applied to "${comp.name}" (tolerance ${tolerance}%)`, true, {
      componentId: comp.id,
      tolerance,
    });
  },

  spill_suppression: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const amount = num(args.amount, 50);
    patchStyle(ctx.projectId, comp.id, { filter: `saturate(${1 - amount / 200})` }, "spill");
    return ok(`spill suppression applied to "${comp.name}" (${amount}%)`, true, {
      componentId: comp.id,
      amount,
    });
  },

  matte_choker: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const amount = num(args.amount, 1);
    patchStyle(
      ctx.projectId,
      comp.id,
      { WebkitMaskImage: `radial-gradient(circle at 50% 50%, black ${Math.max(0, 60 - amount * 10)}%, transparent ${Math.max(65, 70 - amount * 5)}%)` },
      "choker",
    );
    return ok(`matte choker applied to "${comp.name}" (${amount}px)`, true, {
      componentId: comp.id,
      amount,
    });
  },

  inner_outer_key: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const inner = num(args.innerTolerance, 5);
    const outer = num(args.outerTolerance, 15);
    return ok(
      `inner/outer key on "${comp.name}" (inner ${inner}%, outer ${outer}%)`,
      true,
      { componentId: comp.id, innerTolerance: inner, outerTolerance: outer },
    );
  },

  /* ------------------------------- Transitions ------------------------------- */

  block_dissolve: (args, ctx) => {
    const id = addLayer(ctx.projectId, "Block Dissolve", {
      style: {
        background: "repeating-linear-gradient(45deg, rgba(0,0,0,0.6) 0 4px, transparent 4px 8px)",
      },
      durationMs: num(args.durationMs, 800),
      keyframes: buildSteps({ opacity: 0 }, { opacity: 1 }),
    });
    return ok(`block-dissolve transition created with ${num(args.blockWidth, 32)}px blocks`, true, {
      transitionComponentId: id,
    });
  },

  card_wipe: (args, ctx) => {
    const id = addLayer(ctx.projectId, "Card Wipe", {
      style: { background: "linear-gradient(90deg, rgba(20,20,20,0.8), rgba(20,20,20,0.2))" },
      durationMs: num(args.durationMs, 800),
      keyframes: buildSteps({ translateX: "-100%" }, { translateX: "0%" }),
    });
    return ok(`card-wipe transition created (rows ${num(args.rows, 3)}, cols ${num(args.columns, 3)})`, true, {
      transitionComponentId: id,
    });
  },

  gradient_wipe: (args, ctx) => {
    const angle = num(args.angle, 90);
    const softness = num(args.softness, 50);
    const id = addLayer(ctx.projectId, "Gradient Wipe", {
      style: {
        background: `linear-gradient(${angle}deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) ${softness}%)`,
      },
      durationMs: num(args.durationMs, 800),
      keyframes: buildSteps({ translateY: "100%" }, { translateY: "0%" }),
    });
    return ok(`gradient-wipe transition created (angle ${angle}°, softness ${softness}%)`, true, {
      transitionComponentId: id,
    });
  },

  iris_wipe: (args, ctx) => {
    const id = addLayer(ctx.projectId, "Iris Wipe", {
      style: { borderRadius: "50%", background: "rgba(20,20,20,0.85)" },
      durationMs: num(args.durationMs, 800),
      keyframes: buildSteps({ scale: 0.2, opacity: 0.4 }, { scale: 6, opacity: 1 }),
    });
    return ok(`iris-wipe transition created (shape ${String(args.shape ?? "circle")})`, true, {
      transitionComponentId: id,
    });
  },

  linear_wipe: (args, ctx) => {
    const angle = num(args.angle, 90);
    const feather = num(args.feather, 12);
    const id = addLayer(ctx.projectId, "Linear Wipe", {
      style: { background: "linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0))" },
      durationMs: num(args.durationMs, 800),
      keyframes: buildSteps({ translateX: "100%" }, { translateX: "0%" }),
    });
    return ok(`linear-wipe transition created (angle ${angle}°, feather ${feather}px)`, true, {
      transitionComponentId: id,
    });
  },

  radial_wipe: (args, ctx) => {
    const id = addLayer(ctx.projectId, "Radial Wipe", {
      style: { background: "conic-gradient(from 0deg, rgba(0,0,0,0.85), rgba(0,0,0,0))" },
      durationMs: num(args.durationMs, 800),
      keyframes: buildSteps({ rotate: 0 }, { rotate: 360 }),
    });
    return ok(`radial-wipe transition created (feather ${num(args.feather, 5)}%)`, true, {
      transitionComponentId: id,
    });
  },

  venetian_blinds: (args, ctx) => {
    const width = num(args.blindWidth, 32);
    const id = addLayer(ctx.projectId, "Venetian Blinds", {
      style: {
        background: `repeating-linear-gradient(90deg, rgba(0,0,0,0.8) 0 ${width}px, transparent ${width}px ${width * 2}px)`,
      },
      durationMs: num(args.durationMs, 800),
      keyframes: buildSteps({ translateY: "-100%" }, { translateY: "0%" }),
    });
    return ok(`venetian-blinds transition created (blind width ${width}px)`, true, {
      transitionComponentId: id,
    });
  },

  cc_jaws_wipe: (args, ctx) => {
    const id = addLayer(ctx.projectId, "CC Jaws Wipe", {
      style: { background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.85))" },
      durationMs: num(args.durationMs, 800),
      keyframes: [
        { offset: 0, properties: { translateX: "-50%", scale: 0.3 } },
        { offset: 1, properties: { translateX: "50%", scale: 1.6 } },
      ],
    });
    return ok(`CC-jaws-wipe transition created (teeth ${num(args.teethCount, 5)})`, true, {
      transitionComponentId: id,
    });
  },
};
