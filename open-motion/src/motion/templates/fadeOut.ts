import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const fadeOutTemplate: TemplateDef = {
  id: "tpl-fade-out",
  name: "Fade Out",
  category: "exit",
  description: "A gentle opacity descent from 1 to 0 — the calm departure that mirrors Fade In.",
  tags: ["opacity", "exit", "minimal", "soft"],
  build: () => [
    draft("Fading Element", {
      durationMs: 600,
      easing: easingPreset("ease-in"),
      keyframes: [kf(0, { opacity: 1 }), kf(1, { opacity: 0 })],
      style: {
        _content: "Fade Out",
        fontSize: 40,
        fontWeight: 700,
        color: "#f4f6fb",
      },
    }),
  ],
};
