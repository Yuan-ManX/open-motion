import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const kineticTextTemplate: TemplateDef = {
  id: "tpl-kinetic-text",
  name: "Kinetic Text",
  category: "entrance",
  description: "Text slides up word by word with a stagger — a kinetic typography entrance that feels deliberate and rhythmic.",
  tags: ["kinetic", "text", "typography", "reveal", "stagger", "translateY", "opacity"],
  build: () => [
    draft("Kinetic Word 1", {
      durationMs: 600,
      delayMs: 0,
      easing: easingPreset("snappy"),
      iterationCount: 1,
      keyframes: [
        kf(0, { translateY: "40px", opacity: 0 }),
        kf(1, { translateY: "0px", opacity: 1 }),
      ],
      style: {
        fontSize: "32px",
        fontWeight: 700,
        color: "#ffffff",
      },
    }),
    draft("Kinetic Word 2", {
      durationMs: 600,
      delayMs: 120,
      easing: easingPreset("snappy"),
      iterationCount: 1,
      keyframes: [
        kf(0, { translateY: "40px", opacity: 0 }),
        kf(1, { translateY: "0px", opacity: 1 }),
      ],
      style: {
        fontSize: "32px",
        fontWeight: 700,
        color: "#a3a3a3",
      },
    }),
    draft("Kinetic Word 3", {
      durationMs: 600,
      delayMs: 240,
      easing: easingPreset("snappy"),
      iterationCount: 1,
      keyframes: [
        kf(0, { translateY: "40px", opacity: 0 }),
        kf(1, { translateY: "0px", opacity: 1 }),
      ],
      style: {
        fontSize: "32px",
        fontWeight: 700,
        color: "#ffffff",
      },
    }),
  ],
};
