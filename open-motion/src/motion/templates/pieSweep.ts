import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Pie sweep — a donut chart segment that sweeps in via rotation while a
 * mask reveals the arc. The accompanying percentage label counts up via
 * opacity and scale. Used in analytics dashboards and progress reports.
 */
export const pieSweepTemplate: TemplateDef = {
  id: "tpl-pie-sweep",
  name: "Pie Sweep",
  category: "load",
  description: "Donut chart arc sweep with a counting percentage label for analytics.",
  tags: ["pie", "donut", "chart", "data", "progress", "load"],
  build: () => [
    draft("Pie Segment", {
      durationMs: 1000,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { rotate: -90, opacity: "0" }),
        kf(0.2, { opacity: "1" }),
        kf(1, { rotate: 270, opacity: "1" }),
      ],
      style: {
        _content: "",
        width: 120,
        height: 120,
        borderRadius: "50%",
        backgroundColor: "#6366f1",
        maskImage: "conic-gradient(from 0deg, #6366f1 0deg 252deg, transparent 252deg 360deg)",
        WebkitMaskImage: "conic-gradient(from 0deg, #6366f1 0deg 252deg, transparent 252deg 360deg)",
      },
    }),
    draft("Pie Track", {
      durationMs: 400,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", scale: 0.85 }),
        kf(1, { opacity: "0.25", scale: 1 }),
      ],
      style: {
        _content: "",
        width: 120,
        height: 120,
        borderRadius: "50%",
        border: "12px solid #2a2e38",
        boxSizing: "border-box",
      },
    }),
    draft("Percentage Label", {
      durationMs: 900,
      delayMs: 200,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", scale: 0.6 }),
        kf(1, { opacity: "1", scale: 1 }),
      ],
      style: {
        _content: "70%",
        fontSize: 28,
        fontWeight: 700,
        color: "#f4f6fb",
        fontFamily: "monospace",
      },
    }),
  ],
};
