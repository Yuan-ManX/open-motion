import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const slideTemplate: TemplateDef = {
  id: "tpl-slide-up",
  name: "Slide Up",
  category: "entrance",
  description: "Rises into place from below with a confident ease-out.",
  tags: ["translate", "entrance"],
  build: () => [
    draft("Heading", {
      durationMs: 700,
      easing: easingPreset("ease-out-cubic"),
      keyframes: [
        kf(0, { translateY: 40, opacity: 0 }),
        kf(1, { translateY: 0, opacity: 1 }),
      ],
      style: { _content: "Slide Up", fontSize: 48, fontWeight: 700, color: "#f4f6fb" },
    }),
    draft("Subhead", {
      durationMs: 700,
      delayMs: 150,
      easing: easingPreset("ease-out-cubic"),
      keyframes: [
        kf(0, { translateY: 24, opacity: 0 }),
        kf(1, { translateY: 0, opacity: 1 }),
      ],
      style: { _content: "Rises into place", fontSize: 20, color: "#9aa4b2" },
    }),
  ],
};
