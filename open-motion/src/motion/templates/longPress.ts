import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Long Press Gesture — an element that responds to a sustained press with
 * a scale-down dip, a ripple, and a haptic-style bounce. Communicates a
 * "peek" or "context menu" interaction pattern for touch interfaces.
 */
export const longPressTemplate: TemplateDef = {
  id: "tpl-long-press",
  name: "Long Press",
  category: "emphasis",
  description: "Sustained press feedback with dip, ripple, and bounce.",
  tags: ["gesture", "press", "touch", "interactive", "emphasis"],
  build: () => [
    draft("Press Target", {
      durationMs: 800,
      delayMs: 0,
      easing: easingPreset("ease-out"),
      trigger: "onClick",
      keyframes: [
        kf(0, { scale: 1 }),
        kf(0.15, { scale: 0.92 }),
        kf(0.5, { scale: 0.92 }),
        kf(0.6, { scale: 1.05 }),
        kf(1, { scale: 1 }),
      ],
      style: {
        width: 120,
        height: 120,
        background: "#1a1a1a",
        border: "2px solid #f4f6fb",
        borderRadius: 16,
      },
    }),
    draft("Press Ripple", {
      durationMs: 600,
      delayMs: 400,
      easing: easingPreset("ease-out"),
      trigger: "onClick",
      keyframes: [
        kf(0, { scale: 0, opacity: 0.6 }),
        kf(1, { scale: 2.5, opacity: 0 }),
      ],
      style: {
        width: 120,
        height: 120,
        border: "2px solid #f4f6fb",
        borderRadius: "50%",
      },
    }),
    draft("Press Hint", {
      durationMs: 300,
      delayMs: 0,
      easing: easingPreset("ease-out"),
      trigger: "onClick",
      keyframes: [
        kf(0, { opacity: 0, translateY: 0 }),
        kf(0.5, { opacity: 1, translateY: -10 }),
        kf(1, { opacity: 0, translateY: -20 }),
      ],
      style: {
        _content: "Hold",
        fontSize: 12,
        color: "#a0a8b8",
        fontFamily: "system-ui, sans-serif",
      },
    }),
  ],
};
