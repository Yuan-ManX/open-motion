import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Error shake — a horizontal jitter that signals a validation error or
 * rejected action. Uses six alternating offsets so the element feels like
 * it is rattling, then settles. Pairs with a brief red border flash.
 */
export const errorShakeTemplate: TemplateDef = {
  id: "tpl-error-shake",
  name: "Error Shake",
  category: "emphasis",
  description: "Horizontal rattle for form validation errors and rejected actions.",
  tags: ["error", "shake", "validation", "warning", "emphasis"],
  build: () => [
    draft("Shaking Field", {
      durationMs: 500,
      easing: easingPreset("linear"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { translateX: 0 }),
        kf(0.15, { translateX: -10 }),
        kf(0.3, { translateX: 9 }),
        kf(0.45, { translateX: -7 }),
        kf(0.6, { translateX: 5 }),
        kf(0.75, { translateX: -3 }),
        kf(1, { translateX: 0 }),
      ],
      style: {
        _content: "Invalid input",
        fontSize: 14,
        fontWeight: 500,
        color: "#f4f6fb",
        backgroundColor: "#1a1d24",
        border: "1px solid #3a3f4b",
        borderRadius: 8,
        padding: "10px 14px",
        width: 200,
      },
    }),
    draft("Error Hint", {
      durationMs: 300,
      delayMs: 350,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", translateY: -4 }),
        kf(1, { opacity: "0.85", translateY: 0 }),
      ],
      style: {
        _content: "Please check the field above",
        fontSize: 12,
        fontWeight: 400,
        color: "#8b92a8",
        marginTop: 6,
      },
    }),
  ],
};
