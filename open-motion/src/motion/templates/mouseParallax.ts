import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Mouse Parallax — layered elements that shift at different rates based on
 * pointer position, creating a depth illusion. Three layers move at 0.5x,
 * 1x, and 1.5x speed for a convincing parallax effect on hover.
 */
export const mouseParallaxTemplate: TemplateDef = {
  id: "tpl-mouse-parallax",
  name: "Mouse Parallax",
  category: "emphasis",
  description: "Depth layers shift at different rates following the cursor.",
  tags: ["parallax", "depth", "mouse", "interactive", "emphasis"],
  build: () => [
    draft("Parallax Back", {
      durationMs: 600,
      delayMs: 0,
      iterationCount: "infinite",
      direction: "alternate",
      easing: easingPreset("ease-in-out"),
      trigger: "onHover",
      keyframes: [
        kf(0, { translateX: -8, translateY: -4 }),
        kf(1, { translateX: 8, translateY: 4 }),
      ],
      style: {
        width: 240,
        height: 240,
        background: "linear-gradient(135deg, #1a1a1a, #2a2a2a)",
        borderRadius: 16,
      },
    }),
    draft("Parallax Mid", {
      durationMs: 500,
      delayMs: 0,
      iterationCount: "infinite",
      direction: "alternate",
      easing: easingPreset("ease-in-out"),
      trigger: "onHover",
      keyframes: [
        kf(0, { translateX: -16, translateY: -8 }),
        kf(1, { translateX: 16, translateY: 8 }),
      ],
      style: {
        width: 180,
        height: 180,
        background: "linear-gradient(135deg, #333, #555)",
        borderRadius: 12,
      },
    }),
    draft("Parallax Front", {
      durationMs: 400,
      delayMs: 0,
      iterationCount: "infinite",
      direction: "alternate",
      easing: easingPreset("ease-in-out"),
      trigger: "onHover",
      keyframes: [
        kf(0, { translateX: -24, translateY: -12 }),
        kf(1, { translateX: 24, translateY: 12 }),
      ],
      style: {
        width: 120,
        height: 120,
        background: "linear-gradient(135deg, #f4f6fb, #a0a8b8)",
        borderRadius: 8,
      },
    }),
  ],
};
