import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Counter animation — simulates a number counting up using stepped opacity
 * and transform keyframes. Ideal for dashboards, statistics, and data
 * visualization entry effects.
 */
export const counterTemplate: TemplateDef = {
  id: "tpl-counter",
  name: "Counter",
  category: "entrance",
  description: "Number counting entry with stepped scale and opacity for data dashboards.",
  tags: ["counter", "number", "data", "entrance"],
  build: () => [
    draft("Counter Value", {
      durationMs: 1200,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", scale: 0.5, translateY: 20 }),
        kf(0.3, { opacity: "0.5", scale: 0.8, translateY: 10 }),
        kf(0.6, { opacity: "0.8", scale: 1.05, translateY: 0 }),
        kf(1, { opacity: "1", scale: 1, translateY: 0 }),
      ],
      style: {
        _content: "1,234",
        fontSize: 48,
        fontWeight: 700,
        color: "#f4f6fb",
        fontFamily: "monospace",
        textAlign: "center",
      },
    }),
    draft("Counter Label", {
      durationMs: 800,
      delayMs: 400,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", translateY: 10 }),
        kf(1, { opacity: "0.7", translateY: 0 }),
      ],
      style: {
        _content: "Total Users",
        fontSize: 14,
        fontWeight: 400,
        color: "#8b92a8",
        textAlign: "center",
        marginTop: 4,
      },
    }),
  ],
};
