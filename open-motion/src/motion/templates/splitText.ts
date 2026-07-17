import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Split Text Reveal — text divided into upper and lower halves that slide
 * apart vertically, revealing the full line. Creates a cinematic title
 * sequence effect with a mask-wipe feel.
 */
export const splitTextTemplate: TemplateDef = {
  id: "tpl-split-text",
  name: "Split Text",
  category: "entrance",
  description: "Text splits into upper and lower halves sliding apart.",
  tags: ["typography", "text", "split", "mask", "entrance"],
  build: () => [
    draft("Split Upper", {
      durationMs: 1000,
      delayMs: 200,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { translateY: 0, opacity: 0 }),
        kf(0.5, { translateY: -20, opacity: 1 }),
        kf(1, { translateY: -28, opacity: 1 }),
      ],
      style: {
        _content: "SPLIT",
        fontSize: 56,
        fontWeight: 800,
        color: "#f4f6fb",
        clipPath: "inset(0 0 50% 0)",
        fontFamily: "system-ui, sans-serif",
      },
    }),
    draft("Split Lower", {
      durationMs: 1000,
      delayMs: 200,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { translateY: 0, opacity: 0 }),
        kf(0.5, { translateY: 20, opacity: 1 }),
        kf(1, { translateY: 28, opacity: 1 }),
      ],
      style: {
        _content: "SPLIT",
        fontSize: 56,
        fontWeight: 800,
        color: "#f4f6fb",
        clipPath: "inset(50% 0 0 0)",
        fontFamily: "system-ui, sans-serif",
      },
    }),
    draft("Split Divider", {
      durationMs: 800,
      delayMs: 600,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { scaleX: 0, opacity: 0 }),
        kf(1, { scaleX: 1, opacity: 0.6 }),
      ],
      style: {
        width: 180,
        height: 2,
        background: "#a0a8b8",
        transformOrigin: "center",
      },
    }),
  ],
};
