import { getComponent, patchComponent, listComponents } from "../../db/repositories/components.js";
import type { MotionComponent } from "@openmotion/shared";
import type { ToolContext, ToolResult } from "./registry.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

function ok(summary: string, specChanged = true, data?: unknown): ToolResult {
  return { ok: true, summary, specChanged, data };
}
function fail(summary: string): ToolResult {
  return { ok: false, summary, specChanged: false };
}

/** Resolve a component id, honoring the same __first__ / __last__ placeholders
 *  the agent uses so REST-delivered ids stay consistent with chat flows. */
function resolveComponent(projectId: string, componentId: string): MotionComponent | null | undefined {
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

/** Merge a computed CSS `filter` (and optional extra style) into a component,
 *  preserving its existing style tokens. */
function applyVisualEffect(
  projectId: string,
  componentId: string,
  filter: string,
  extra: Record<string, string | number> = {},
): ToolResult {
  const comp = resolveComponent(projectId, componentId);
  if (!comp) return fail(`component ${componentId} not found`);
  const style = { ...comp.style, filter, ...extra };
  patchComponent(projectId, comp.id, { style });
  return ok(`applied visual filter to "${comp.name}" (${filter})`);
}

// A library of CSS-filter approximations for the visual effect tools the rest of
// the platform exposes. Each maps a declarative effect to a composable CSS filter
// so the result is visible in the canvas without raster processing.
export const filterExecutors: Partial<Record<string, Executor>> = {
  apply_gaussian_blur: (args, ctx) =>
    applyVisualEffect(ctx.projectId, String(args.componentId), `blur(${Number(args.radius)}px)`),

  apply_directional_blur: (args, ctx) => {
    // CSS has no true directional blur; scale the blur by the streak length and
    // rotate the element so the smearing runs along the requested angle.
    const length = Number(args.length);
    const angle = Number(args.angle);
    const blur = Math.max(2, Math.round(length / 2));
    return applyVisualEffect(ctx.projectId, String(args.componentId), `blur(${blur}px)`, {
      transform: `rotate(${angle}deg)`,
    });
  },

  apply_radial_blur: (args, ctx) =>
    applyVisualEffect(ctx.projectId, String(args.componentId), `blur(${Number(args.amount)}px)`, {
      transform: args.spin ? "scale(1.08)" : "scale(0.96)",
    }),

  apply_sharpen: (args, ctx) => {
    const amount = Number(args.amount);
    return applyVisualEffect(
      ctx.projectId,
      String(args.componentId),
      `contrast(${1 + amount / 100}) saturate(1.15)`,
    );
  },

  apply_wave_warp: (args, ctx) =>
    applyVisualEffect(ctx.projectId, String(args.componentId), "none", {
      transform: `skewY(${Number(args.waveHeight) / 10}deg)`,
    }),

  apply_ripple: (args, ctx) =>
    applyVisualEffect(ctx.projectId, String(args.componentId), "none", {
      transform: "scale(1.04)",
    }),

  apply_bulge: (args, ctx) => {
    const height = Number(args.height);
    return applyVisualEffect(ctx.projectId, String(args.componentId), "none", {
      transform: height >= 0 ? "scale(1.12)" : "scale(0.9)",
    });
  },

  apply_glow: (args, ctx) => {
    const color = typeof args.color === "string" ? args.color : "#7aa2ff";
    const intensity = Number(args.intensity ?? 1);
    const radius = Number(args.radius ?? 12);
    return applyVisualEffect(
      ctx.projectId,
      String(args.componentId),
      `drop-shadow(0 0 ${radius}px ${color}) brightness(${intensity})`,
    );
  },

  apply_mosaic: (args, ctx) =>
    applyVisualEffect(ctx.projectId, String(args.componentId), "none", {
      imageRendering: "pixelated",
    }),

  apply_find_edges: (args, ctx) =>
    applyVisualEffect(ctx.projectId, String(args.componentId), "grayscale(1) contrast(2)"),

  apply_lens_flare: (args, ctx) =>
    applyVisualEffect(ctx.projectId, String(args.componentId), "brightness(1.15)", {
      background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.9), rgba(255,255,255,0.15) 40%, transparent 70%)",
    }),

  apply_four_color_gradient: (args, ctx) =>
    applyVisualEffect(ctx.projectId, String(args.componentId), "none", {
      background: "linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcbff, #6bff8f)",
    }),
};