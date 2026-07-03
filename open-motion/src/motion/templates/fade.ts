import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const fadeTemplate: TemplateDef = {
  id: "tpl-fade-in",
  name: "Fade In",
  category: "entrance",
  description: "A soft opacity rise from 0 to 1 — the calm entrance.",
  tags: ["opacity", "entrance", "minimal"],
  build: () => [
    draft("Title", {
      durationMs: 800,
      easing: easingPreset("ease-out"),
      keyframes: [kf(0, { opacity: 0 }), kf(1, { opacity: 1 })],
      style: {
        _content: "Fade In",
        fontSize: 48,
        fontWeight: 700,
        color: "#f4f6fb",
      },
    }),
  ],
};
