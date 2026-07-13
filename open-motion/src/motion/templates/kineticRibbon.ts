import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const kineticRibbonTemplate: TemplateDef = {
  id: "tpl-kinetic-ribbon",
  name: "Kinetic Ribbon",
  category: "emphasis",
  description: "A flowing ribbon that draws itself across the canvas with a wave-like undulation — kinetic typography meets liquid geometry.",
  tags: ["kinetic", "ribbon", "flow", "wave", "draw", "self-drawing", "liquid"],
  build: () => [
    draft("Ribbon Body", {
      durationMs: 3000,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scaleX: 0, translateY: 0, rotate: 0 }),
        kf(0.3, { scaleX: 0.6, translateY: -8, rotate: -2 }),
        kf(0.6, { scaleX: 1, translateY: 4, rotate: 1 }),
        kf(1, { scaleX: 1, translateY: 0, rotate: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "280px",
        height: "12px",
        borderRadius: "6px",
        background: "linear-gradient(90deg, #1a1a1a, #4a4a4a, #ffffff, #4a4a4a, #1a1a1a)",
        transformOrigin: "left center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      },
    }),
    draft("Ribbon Trail", {
      durationMs: 3000,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateX: "-80%", opacity: 0 }),
        kf(0.4, { opacity: 0.4 }),
        kf(0.7, { opacity: 0.2 }),
        kf(1, { translateX: "80%", opacity: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "6px",
        borderRadius: "3px",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
        filter: "blur(3px)",
      },
    }),
  ],
};
