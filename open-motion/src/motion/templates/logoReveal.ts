import { easingPreset } from "@openmotion/shared";
import { draft, kf, resetOrder, type TemplateDef } from "./helper.js";

/** A richer composite template: staggered entrance showcase. */
export const logoRevealTemplate: TemplateDef = {
  id: "tpl-logo-reveal",
  name: "Logo Reveal",
  category: "entrance",
  description: "A staggered brand entrance — mark, wordmark, tagline cascading in.",
  tags: ["composite", "stagger", "brand"],
  build: () => {
    resetOrder();
    return [
      draft("Mark", {
        durationMs: 700,
        easing: easingPreset("back"),
        keyframes: [kf(0, { scale: 0, rotate: -90, opacity: 0 }), kf(1, { scale: 1, rotate: 0, opacity: 1 })],
        style: {
          width: 72,
          height: 72,
          borderRadius: 18,
          backgroundColor: "#6366f1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          fontWeight: 800,
          color: "#ffffff",
          _content: "M",
        },
      }),
      draft("Wordmark", {
        durationMs: 600,
        delayMs: 200,
        easing: easingPreset("ease-out-cubic"),
        keyframes: [kf(0, { translateX: -24, opacity: 0 }), kf(1, { translateX: 0, opacity: 1 })],
        style: { _content: "Motion", fontSize: 44, fontWeight: 800, color: "#f4f6fb" },
      }),
      draft("Tagline", {
        durationMs: 600,
        delayMs: 380,
        easing: easingPreset("ease-out"),
        keyframes: [kf(0, { translateY: 12, opacity: 0 }), kf(1, { translateY: 0, opacity: 1 })],
        style: { _content: "alive on the page", fontSize: 18, color: "#9aa4b2" },
      }),
    ];
  },
};
