import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Bar grow — a vertical chart bar that rises from the baseline to its full
 * height via scaleY, with transform-origin pinned to the bottom. Three bars
 * are staggered so the chart reads as a sequence. Used in dashboards and
 * analytics views for data entrance.
 */
export const barGrowTemplate: TemplateDef = {
  id: "tpl-bar-grow",
  name: "Bar Grow",
  category: "load",
  description: "Staggered vertical bar chart entrance with bottom-anchored scale growth.",
  tags: ["chart", "bar", "data", "dashboard", "load"],
  build: () => [
    draft("Bar A", {
      durationMs: 700,
      delayMs: 0,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { scaleY: 0, opacity: "0" }),
        kf(1, { scaleY: 1, opacity: "1" }),
      ],
      style: {
        _content: "",
        width: 36,
        height: 120,
        backgroundColor: "#6366f1",
        borderRadius: "6px 6px 0 0",
        transformOrigin: "bottom",
      },
    }),
    draft("Bar B", {
      durationMs: 700,
      delayMs: 120,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { scaleY: 0, opacity: "0" }),
        kf(1, { scaleY: 1, opacity: "1" }),
      ],
      style: {
        _content: "",
        width: 36,
        height: 180,
        backgroundColor: "#818cf8",
        borderRadius: "6px 6px 0 0",
        transformOrigin: "bottom",
      },
    }),
    draft("Bar C", {
      durationMs: 700,
      delayMs: 240,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { scaleY: 0, opacity: "0" }),
        kf(1, { scaleY: 1, opacity: "1" }),
      ],
      style: {
        _content: "",
        width: 36,
        height: 90,
        backgroundColor: "#a5b4fc",
        borderRadius: "6px 6px 0 0",
        transformOrigin: "bottom",
      },
    }),
    draft("Baseline", {
      durationMs: 400,
      delayMs: 0,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", scaleX: 0 }),
        kf(1, { opacity: "0.6", scaleX: 1 }),
      ],
      style: {
        _content: "",
        width: 140,
        height: 1,
        backgroundColor: "#3a3f4b",
        transformOrigin: "left",
      },
    }),
  ],
};
