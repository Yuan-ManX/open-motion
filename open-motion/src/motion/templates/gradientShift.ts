import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const gradientShiftTemplate: TemplateDef = {
  id: "tpl-gradient-shift",
  name: "Gradient Shift",
  category: "emphasis",
  description: "An animated gradient surface that cycles through color stops — a living, breathing background.",
  tags: ["gradient", "animated", "background", "hue", "emphasis"],
  build: () => [
    draft("Gradient Surface", {
      durationMs: 3000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.7 }),
        kf(0.5, { opacity: 1 }),
        kf(1, { opacity: 0.7 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "80px",
        borderRadius: "12px",
        background: "linear-gradient(90deg, #1a1a1a, #2a2a2a, #1a1a1a)",
        backgroundSize: "200% 100%",
        boxShadow: "inset 0 0 20px rgba(255,255,255,0.05)",
      },
    }),
    draft("Shimmer Overlay", {
      durationMs: 2000,
      delayMs: 200,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { translateX: "-100%" }),
        kf(1, { translateX: "100%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "160px",
        height: "80px",
        borderRadius: "12px",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
      },
    }),
  ],
};
