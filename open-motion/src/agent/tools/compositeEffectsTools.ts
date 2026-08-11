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

/**
 * Merge a computed CSS `filter` into a component, preserving any existing
 * filter tokens so multiple effects compose additively (e.g. a color grade
 * stacked on top of a blur) instead of silently dropping earlier ones.
 */
function applyFilter(
  projectId: string,
  componentId: string,
  filter: string,
  extra: Record<string, string | number> = {},
): ToolResult {
  const comp = resolveComponent(projectId, componentId);
  if (!comp) return fail(`component ${componentId} not found`);
  const style = { ...comp.style, ...extra };
  const existing = typeof style.filter === "string" && style.filter !== "none" ? style.filter : "";
  style.filter = existing ? `${existing} ${filter}`.trim() : filter;
  patchComponent(projectId, comp.id, { style });
  return ok(`applied visual effect to "${comp.name}" (${filter})`);
}

/** Map a stop value (in EV stops) to a CSS brightness multiplier. */
function stopsToBrightness(stops: number): number {
  const v = Math.pow(2, stops);
  return Math.round(v * 100) / 100;
}

/** Clamp a number into [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Real CSS renderers for the post-processing and color-grading tools that
 * were previously only acknowledged as "simulated". Each maps the tool's
 * declarative parameters onto a composable CSS filter chain (plus a few
 * overlay styles) so the result is actually visible in the canvas.
 */
export const compositeEffectExecutors: Partial<Record<string, Executor>> = {
  // --- Level / curve style color grading ---
  set_levels: (args, ctx) => {
    const inputBlack = Number(args.inputBlack ?? 0);
    const inputWhite = Number(args.inputWhite ?? 255);
    const gamma = Number(args.gamma ?? 1);
    const outputBlack = Number(args.outputBlack ?? 0);
    const outputWhite = Number(args.outputWhite ?? 255);
    const contrast = clamp((inputWhite - inputBlack) / 255, 0.2, 3);
    const outRange = clamp((outputWhite - outputBlack) / 255, 0.2, 3);
    const brightness = clamp((outRange / contrast) * stopsToBrightness(0), 0.3, 3);
    const g = clamp(gamma, 0.1, 9.9);
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `brightness(${Math.round(brightness * 100) / 100}) contrast(${Math.round(contrast * 100) / 100})${g !== 1 ? ` brightness(${Math.round(1 / g * 100) / 100})` : ""}`,
    );
  },

  set_curves: (args, ctx) => {
    // Approximate an S-curve by strengthening contrast; deeper curves add
    // more contrast. Individual control points are not exactly reproducible
    // with a single CSS pass, so we compress them into a contrast boost.
    const points = Array.isArray(args.points) ? (args.points as Array<{ x: number; y: number }>) : [];
    const spread = points.length >= 2
      ? points.reduce((acc, p, i, arr) => {
          if (i === 0) return acc;
          return acc + Math.abs((arr[i].y / 255) - (p.y / 255));
        }, 0)
      : 0;
    const boost = clamp(0.6 + spread * 1.4, 0.4, 2.6);
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `contrast(${Math.round(boost * 100) / 100}) saturate(1.05)`,
    );
  },

  set_color_balance: (args, ctx) => {
    const midR = Number(args.midtoneRed ?? 0);
    const midG = Number(args.midtoneGreen ?? 0);
    const midB = Number(args.midtoneBlue ?? 0);
    const hue = clamp(((midR - midB) * 0.9), -180, 180);
    const sepia = clamp((Math.abs(midG) / 100) * 0.6, 0, 0.6);
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `hue-rotate(${Math.round(hue)}deg)${sepia > 0 ? ` sepia(${Math.round(sepia * 100) / 100})` : ""}`,
    );
  },

  set_hue_saturation: (args, ctx) => {
    const hueShift = Number(args.hueShift ?? 0);
    const sat = 1 + Number(args.saturation ?? 0) / 100;
    const light = 1 + Number(args.lightness ?? 0) / 100;
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `hue-rotate(${clamp(hueShift, -180, 180)}deg) saturate(${Math.round(sat * 100) / 100}) brightness(${Math.round(light * 100) / 100})`,
    );
  },

  set_vibrance: (args, ctx) => {
    // Vibrance boosts the less-saturated mid-tones; a saturate bump with a
    // contrast lift is a good CSS approximation.
    const vibrance = Number(args.vibrance ?? 0) / 100;
    const sat = vibrance >= 0 ? 1 + vibrance * 0.8 : 1 + vibrance * 0.6;
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `saturate(${Math.round(sat * 100) / 100}) contrast(${vibrance >= 0 ? "1.05" : "0.98"})`,
    );
  },

  set_exposure: (args, ctx) => {
    const exposure = Number(args.exposure ?? 0);
    const gamma = Number(args.gammaCorrection ?? 1);
    const offset = Number(args.offset ?? 0);
    const bright = stopsToBrightness(exposure) * (1 + offset);
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `brightness(${Math.round(clamp(bright, 0.2, 3) * 100) / 100})${gamma !== 1 ? ` contrast(${Math.round(clamp(1 / gamma, 0.3, 3) * 100) / 100})` : ""}`,
    );
  },

  set_shadow_highlight: (args, ctx) => {
    const shadow = Number(args.shadowAmount ?? 0);
    const highlight = Number(args.highlightAmount ?? 0);
    // Lift the shadows and pull back the highlights via a gentle contrast change.
    const lift = clamp(1 + (shadow - highlight) / 200, 0.7, 1.4);
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `brightness(${Math.round(lift * 100) / 100}) contrast(${Math.round(clamp(1 + (highlight - shadow) / 300, 0.8, 1.3) * 100) / 100})`,
    );
  },

  set_selective_color: (args, ctx) => {
    const cyan = Number(args.cyan ?? 0);
    const magenta = Number(args.magenta ?? 0);
    const yellow = Number(args.yellow ?? 0);
    const hue = clamp((magenta - cyan) * 0.8, -180, 180);
    const sat = clamp(1 + (cyan + magenta + yellow) / 300, 0.6, 1.6);
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `hue-rotate(${Math.round(hue)}deg) saturate(${Math.round(sat * 100) / 100})`,
    );
  },

  // --- Lens / optical effects ---
  chromatic_aberration: (args, ctx) => {
    const r = Number(args.redOffset ?? 2);
    const b = Number(args.blueOffset ?? -2);
    const radial = Boolean(args.radial);
    const spread = Math.max(Math.abs(r), Math.abs(b));
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `saturate(1.1) contrast(1.05)`,
      {
        // Render a red/cyan fringe under the element. Radial mode spreads the
        // fringe outward from center; otherwise it is a flat offset.
        boxShadow: radial
          ? `${spread}px 0 0 rgba(255,56,56,0.4), -${spread}px 0 0 rgba(56,56,255,0.4)`
          : `${r}px 0 0 rgba(255,56,56,0.35), ${b}px 0 0 rgba(56,56,255,0.35)`,
      },
    );
  },

  vignette: (args, ctx) => {
    const amount = Number(args.amount ?? 0.5);
    const color = typeof args.color === "string" ? args.color : "#000000";
    const size = Number(args.size ?? 0.5);
    const soft = Number(args.softness ?? 0.5);
    const insetPx = Math.round((0.5 + size * 0.5) * 100);
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `brightness(${Math.round((1 + amount * 0.15) * 100) / 100})`,
      {
        boxShadow: `inset 0 0 ${Math.round(soft * 120)}px ${insetPx}px ${color}`,
      },
    );
  },

  lens_flare_anamorphic: (args, ctx) => {
    const pos = Array.isArray(args.position) ? (args.position as number[]) : [0.5, 0.5];
    const brightness = Number(args.brightness ?? 1.5);
    const streak = Number(args.streakLength ?? 120);
    const color = typeof args.color === "string" ? args.color : "#88ccff";
    const x = Math.round((pos[0] ?? 0.5) * 100);
    const y = Math.round((pos[1] ?? 0.5) * 100);
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `brightness(${Math.round(clamp(brightness, 0.5, 3) * 100) / 100})`,
      {
        background: `radial-gradient(circle at ${x}% ${y}%, ${color}55, transparent 55%), linear-gradient(${streak}deg, transparent 42%, ${color}33 50%, transparent 58%)`,
      },
    );
  },

  lens_distortion: (args, ctx) => {
    const amount = Number(args.amount ?? 20);
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      transform: `scale(${Math.round(clamp(1 - amount / 500, 0.8, 1.2) * 100) / 100})`,
    });
  },

  camera_shake_procedural: (args, ctx) => {
    const intensity = Number(args.intensity ?? 1);
    const dist = Math.round(clamp(intensity, 0, 5) * 4);
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      transform: `translate(${dist}px, ${dist}px)`,
    });
  },

  // --- Stylize effects (CSS filter approximations) ---
  emboss_effect: (args, ctx) => {
    const amount = Number(args.amount ?? 1);
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `grayscale(1) contrast(${Math.round((1 + amount * 0.8) * 100) / 100})`,
    );
  },

  cartoon_effect: (args, ctx) => {
    // Crude posterization: clamp down the tonal range and boost edges.
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      "contrast(1.6) saturate(1.3) brightness(0.95)",
    );
  },

  oil_paint: (args, ctx) =>
    applyFilter(ctx.projectId, String(args.componentId), "saturate(1.25) contrast(1.15) blur(0.5px)"),

  watercolor: (args, ctx) =>
    applyFilter(ctx.projectId, String(args.componentId), "saturate(0.8) contrast(0.9) brightness(1.05) blur(0.8px)"),

  threshold_effect: (args, ctx) => {
    const amount = Number(args.amount ?? 128);
    return applyFilter(
      ctx.projectId,
      String(args.componentId),
      `contrast(${Math.round(clamp(amount / 64, 1, 6) * 100) / 100}) grayscale(1)`,
    );
  },

  motion_tile: (args, ctx) => {
    const width = Number(args.width ?? 100);
    const height = Number(args.height ?? 100);
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      backgroundRepeat: "repeat",
      backgroundSize: `${clamp(width, 10, 500)}px ${clamp(height, 10, 500)}px`,
    });
  },

  scatter_effect: (args, ctx) => {
    const amount = Number(args.amount ?? 20);
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      filter: `blur(${Math.round(clamp(amount, 0, 100) / 10)}px) opacity(0.85)`,
    });
  },

  // --- Blend / compositing modes ---
  set_alpha_mode: (args, ctx) => {
    const mode = String(args.mode ?? "alpha");
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      mixBlendMode: mode === "alpha" ? "normal" : mode,
    });
  },

  set_transfer_mode: (args, ctx) => {
    const mode = String(args.mode ?? "normal");
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      mixBlendMode: mode,
    });
  },

  set_advanced_blending: (args, ctx) => {
    const mode = String(args.mode ?? "normal");
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      mixBlendMode: mode,
    });
  },

  set_blending_group: (args, ctx) => {
    const mode = String(args.mode ?? "normal");
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      mixBlendMode: mode,
      isolation: "isolate",
    });
  },

  // --- Text styling operators ---
  set_kerning: (args, ctx) => {
    const amount = Number(args.amount ?? 0);
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      letterSpacing: `${clamp(amount, -20, 20)}px`,
    });
  },

  set_leading: (args, ctx) => {
    const amount = Number(args.amount ?? 1);
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      lineHeight: String(clamp(amount, 0.5, 3)),
    });
  },

  set_vertical_text: (args, ctx) => {
    const enabled = Boolean(args.enabled);
    return applyFilter(ctx.projectId, String(args.componentId), "none", {
      writingMode: enabled ? "vertical-rl" : "horizontal-tb",
    });
  },
};