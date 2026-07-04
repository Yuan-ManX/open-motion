import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const pulseTemplate: TemplateDef = {
  id: "tpl-pulse",
  name: "Pulse",
  category: "emphasis",
  description: "A breathing scale loop that draws the eye without shouting.",
  tags: ["scale", "loop", "emphasis"],
  build: () => [
    draft("Dot", {
      durationMs: 1200,
      iterationCount: "infinite",
      direction: "alternate",
      easing: easingPreset("ease-in-out"),
      keyframes: [kf(0, { scale: 1, opacity: 0.8 }), kf(1, { scale: 1.25, opacity: 1 })],
      style: {
        width: 80,
        height: 80,
        borderRadius: "50%",
        backgroundColor: "#22c55e",
        boxShadow: "0 0 40px rgba(34,197,94,0.6)",
      },
    }),
  ],
};
