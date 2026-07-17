import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Kinetic Typography — bold text that scales and shifts weight per word,
 * creating a rhythm-driven typographic entrance. Ideal for hero headlines
 * and title cards where the text itself is the primary visual.
 */
export const kineticTypographyTemplate: TemplateDef = {
  id: "tpl-kinetic-typography",
  name: "Kinetic Typography",
  category: "entrance",
  description: "Bold typographic entrance with per-word scale and weight shifts.",
  tags: ["typography", "text", "scale", "weight", "entrance"],
  build: () => [
    draft("Kinetic Word 1", {
      durationMs: 900,
      delayMs: 0,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { scale: 0.3, opacity: 0 }),
        kf(0.6, { scale: 1.1, opacity: 1 }),
        kf(1, { scale: 1, opacity: 1 }),
      ],
      style: {
        _content: "MOTION",
        fontSize: 72,
        fontWeight: 900,
        color: "#f4f6fb",
        letterSpacing: -2,
        fontFamily: "system-ui, sans-serif",
      },
    }),
    draft("Kinetic Word 2", {
      durationMs: 900,
      delayMs: 120,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { scale: 0.3, opacity: 0, translateY: 30 }),
        kf(0.6, { scale: 1.1, opacity: 1, translateY: 0 }),
        kf(1, { scale: 1, opacity: 1, translateY: 0 }),
      ],
      style: {
        _content: "DESIGN",
        fontSize: 72,
        fontWeight: 200,
        color: "#a0a8b8",
        letterSpacing: 4,
        fontFamily: "system-ui, sans-serif",
      },
    }),
    draft("Kinetic Underline", {
      durationMs: 600,
      delayMs: 500,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { scaleX: 0, opacity: 0 }),
        kf(1, { scaleX: 1, opacity: 1 }),
      ],
      style: {
        width: 200,
        height: 4,
        background: "#f4f6fb",
        transformOrigin: "left center",
      },
    }),
  ],
};
