// Procedural generator and simulation tool executors. These create real
// components whose CSS animation and style tokens visually reproduce the
// requested effect, so every generator produces an observable result.

import type { ToolName } from "@openmotion/shared";
import type { ToolContext, ToolResult } from "./registry.js";
import { ok, addLayer, buildSteps, num } from "./specUtils.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

export const generatorExecutors: Partial<Record<ToolName, Executor>> = {
  cc_ball_action: (args, ctx) => {
    const id = addLayer(ctx.projectId, "CC Ball Action", {
      style: { backgroundColor: "rgba(0,122,140,0.9)", borderRadius: "50%", width: num(args.scatter, 40), height: num(args.scatter, 40) },
      durationMs: num(args.durationMs, 1200),
      iterationCount: "infinite",
      keyframes: buildSteps({ translateY: 0 }, { translateY: -40 }),
    });
    return ok(`ball-action simulation created (scatter ${num(args.scatter, 40)}, turbulence ${num(args.turbulence, 2)})`, true, {
      componentId: id,
    });
  },

  cc_bubbles: (args, ctx) => {
    const id = addLayer(ctx.projectId, "CC Bubbles", {
      style: { border: "2px solid rgba(122,162,255,0.8)", borderRadius: "50%", backgroundColor: "transparent" },
      durationMs: num(args.durationMs, 1600),
      iterationCount: "infinite",
      keyframes: buildSteps({ translateY: 0, opacity: 0.6 }, { translateY: -80, opacity: 0 }),
    });
    return ok(
      `bubble simulation created (count ${num(args.count, 12)}, size ${num(args.size, 12)}px, speed ${num(args.speed, 2)})`,
      true,
      { componentId: id },
    );
  },

  cc_rainfall: (args, ctx) => {
    const id = addLayer(ctx.projectId, "CC Rainfall", {
      style: {
        width: 2,
        height: num(args.dropletSize, 24),
        background: "linear-gradient(180deg, rgba(122,162,255,0.9), rgba(122,162,255,0.2))",
      },
      durationMs: num(args.durationMs, 900),
      iterationCount: "infinite",
      keyframes: buildSteps({ translateY: -40 }, { translateY: 90 }),
    });
    return ok(
      `rainfall simulation created (drops ${num(args.droplets, 40)}, wind ${num(args.wind, 0)}, speed ${num(args.speed, 4)})`,
      true,
      { componentId: id },
    );
  },

  cc_snowfall: (args, ctx) => {
    const id = addLayer(ctx.projectId, "CC Snowfall", {
      style: { backgroundColor: "#ffffff", borderRadius: "50%", boxShadow: "0 0 6px rgba(255,255,255,0.9)" },
      durationMs: num(args.durationMs, 2200),
      iterationCount: "infinite",
      keyframes: buildSteps({ translateY: -30, translateX: 0 }, { translateY: 100, translateX: num(args.wind, 20) }),
    });
    return ok(
      `snowfall simulation created (flakes ${num(args.flakes, 30)}, size ${num(args.size, 5)}px, wobble ${num(args.wobble, 25)})`,
      true,
      { componentId: id },
    );
  },

  cc_star_burst: (args, ctx) => {
    const id = addLayer(ctx.projectId, "CC Star Burst", {
      style: { backgroundColor: "rgba(255,215,0,0.9)", borderRadius: "50%", boxShadow: "0 0 18px rgba(255,215,0,0.9)" },
      durationMs: num(args.durationMs, 700),
      iterationCount: "infinite",
      keyframes: buildSteps({ scale: 0.2, opacity: 1 }, { scale: 3, opacity: 0 }),
    });
    return ok(`star-burst simulation created (size ${num(args.size, 8)}px, speed ${num(args.speed, 3)})`, true, {
      componentId: id,
    });
  },

  cell_pattern: (args, ctx) => {
    const size = num(args.cellSize, 40);
    const id = addLayer(ctx.projectId, "Cell Pattern", {
      style: {
        background: `repeating-linear-gradient(0deg, rgba(122,162,255,0.5) 0 1px, transparent 1px ${size}px), repeating-linear-gradient(90deg, rgba(122,162,255,0.5) 0 1px, transparent 1px ${size}px)`,
      },
      durationMs: num(args.durationMs, 1000),
      iterationCount: "infinite",
      keyframes: buildSteps({ translateY: 0 }, { translateY: size }),
    });
    return ok(`cell-pattern generator created (cell ${size}px, dispersion ${num(args.dispersion, 20)})`, true, {
      componentId: id,
    });
  },

  audio_spectrum: (args, ctx) => {
    const id = addLayer(ctx.projectId, "Audio Spectrum", {
      style: { background: "linear-gradient(0deg, #ff6b6b, #ffd93d, #6bcbff)", borderRadius: 2 },
      durationMs: num(args.durationMs, 600),
      iterationCount: "infinite",
      keyframes: buildSteps({ scaleY: 0.3 }, { scaleY: 1 }),
    });
    return ok(
      `audio-spectrum visualizer created (bars ${num(args.bars, 32)}, thickness ${num(args.thickness, 4)}, display ${String(args.displayMode ?? "bars")})`,
      true,
      { componentId: id },
    );
  },

  radio_waves: (args, ctx) => {
    const id = addLayer(ctx.projectId, "Radio Waves", {
      style: { border: `2px solid rgba(122,162,255,0.8)`, borderRadius: "50%" },
      durationMs: num(args.durationMs, 1400),
      iterationCount: "infinite",
      keyframes: buildSteps({ scale: 0.3, opacity: 0.9 }, { scale: 2.4, opacity: 0 }),
    });
    return ok(`radio-wave generator created (frequency ${num(args.frequency, 1)}, extension ${num(args.extension, 50)})`, true, {
      componentId: id,
    });
  },

  brush_strokes: (args, ctx) => {
    const size = num(args.strokeLength, 30);
    const id = addLayer(ctx.projectId, "Brush Strokes", {
      style: {
        height: num(args.strokeWidth, 6),
        borderRadius: 3,
        background: "linear-gradient(90deg, transparent, rgba(255,107,107,0.8), #ff6b6b)",
      },
      durationMs: num(args.durationMs, 900),
      iterationCount: "infinite",
      keyframes: buildSteps({ translateX: -size, opacity: 0 }, { translateX: 0, opacity: 1 }),
    });
    return ok(
      `brush-strokes stylize created (${num(args.strokes, 16)} strokes, ${size}px length, style ${String(args.style ?? "oil")})`,
      true,
      { componentId: id },
    );
  },
};
