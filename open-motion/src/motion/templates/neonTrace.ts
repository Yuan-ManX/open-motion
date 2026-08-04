import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Neon Trace — a neon line that draws itself on, then a soft glow pulse
 * settles around it. The draw-on is achieved by translating a thin mask
 * across the line's length so the stroke appears to be traced from
 * left to right; the glow pulse layer underneath fades in as the trace
 * completes so the line "ignites" once drawn. The third layer is the
 * finished neon line itself, which carries a steady text-shadow-style
 * bloom. Used for emphasis: underlines, accent rules, signature strokes.
 */
export const neonTraceTemplate: TemplateDef = {
  id: "tpl-neon-trace",
  name: "Neon Trace",
  category: "emphasis",
  description: "Neon line draws itself on left-to-right, then a soft glow ignites around the finished stroke — a signature emphasis reveal.",
  tags: ["neon", "trace", "draw", "line", "glow", "emphasis", "underline", "stroke"],
  build: () => [
    // Underlying glow layer — fades in as the trace completes.
    draft("Neon Glow", {
      durationMs: 900,
      delayMs: 350,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: 0, scale: 0.9 }),
        kf(0.6, { opacity: 0.7, scale: 1.05 }),
        kf(1, { opacity: 0.5, scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "6px",
        borderRadius: "3px",
        backgroundColor: "#7df9ff",
        filter: "blur(10px)",
        position: "absolute",
        top: "20px",
        left: "0",
      },
    }),
    // The neon line itself — clipped by a translateX mask that draws it on.
    draft("Neon Line", {
      durationMs: 600,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: 1, translateX: -320 }),
        kf(1, { opacity: 1, translateX: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "3px",
        borderRadius: "2px",
        backgroundColor: "#eafdff",
        boxShadow: "0 0 8px #7df9ff, 0 0 16px #7df9ff",
        position: "absolute",
        top: "21px",
        left: "0",
        overflow: "hidden",
      },
    }),
    // Settle pulse — a brief brightness flash once the trace completes.
    draft("Neon Ignite", {
      durationMs: 400,
      delayMs: 600,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: 0, scale: 1 }),
        kf(0.4, { opacity: 0.9, scale: 1.1 }),
        kf(1, { opacity: 0, scale: 1.2 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "10px",
        borderRadius: "5px",
        backgroundColor: "#ffffff",
        filter: "blur(6px)",
        position: "absolute",
        top: "18px",
        left: "0",
        pointerEvents: "none",
      },
    }),
  ],
};
