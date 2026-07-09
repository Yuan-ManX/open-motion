import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const liquidMorphTemplate: TemplateDef = {
  id: "tpl-liquid-morph",
  name: "Liquid Morph",
  category: "emphasis",
  description: "A shape that flows between organic border-radius values — an ambient, living blob that feels alive and fluid.",
  tags: ["liquid", "morph", "blob", "organic", "border-radius", "loop", "ambient"],
  build: () => [
    draft("Liquid Blob", {
      durationMs: 4000,
      delayMs: 0,
      easing: easingPreset("smooth"),
      iterationCount: "infinite" as const,
      direction: "alternate" as const,
      keyframes: [
        kf(0, { borderRadius: "50% 50% 50% 50%" }),
        kf(0.25, { borderRadius: "40% 60% 50% 50%" }),
        kf(0.5, { borderRadius: "60% 40% 30% 70%" }),
        kf(0.75, { borderRadius: "50% 50% 60% 40%" }),
        kf(1, { borderRadius: "50% 50% 50% 50%" }),
      ],
      style: {
        width: "160px",
        height: "160px",
        backgroundColor: "#262626",
      },
    }),
  ],
};
