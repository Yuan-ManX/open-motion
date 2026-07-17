import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Text reveal animation — cinematic mask wipe that uncovers text from left
 * to right using clip-path. Pairs a sliding mask layer with a subtle blur
 * transition for a polished editorial feel.
 */
export const textRevealTemplate: TemplateDef = {
  id: "tpl-text-reveal",
  name: "Text Reveal",
  category: "entrance",
  description: "Cinematic clip-path mask wipe for editorial text reveals.",
  tags: ["text", "reveal", "mask", "clip-path", "entrance"],
  build: () => [
    draft("Reveal Text", {
      durationMs: 1400,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { clipPath: "inset(0 100% 0 0)" }),
        kf(0.5, { clipPath: "inset(0 50% 0 0)" }),
        kf(1, { clipPath: "inset(0 0% 0 0)" }),
      ],
      style: {
        _content: "Reveal the Story",
        fontSize: 36,
        fontWeight: 800,
        color: "#f4f6fb",
        whiteSpace: "nowrap",
        overflow: "hidden",
      },
    }),
    draft("Reveal Glow", {
      durationMs: 1400,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", blur: "8px", translateX: -20 }),
        kf(0.5, { opacity: "0.3", blur: "4px", translateX: 0 }),
        kf(1, { opacity: "0", blur: "0px", translateX: 20 }),
      ],
      style: {
        _content: "Reveal the Story",
        fontSize: 36,
        fontWeight: 800,
        color: "#4a9eff",
        whiteSpace: "nowrap",
        overflow: "hidden",
        position: "absolute" as const,
        top: 0,
        left: 0,
      },
    }),
  ],
};
