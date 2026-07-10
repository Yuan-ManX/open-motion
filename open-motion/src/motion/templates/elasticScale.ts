import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const elasticScaleTemplate: TemplateDef = {
  id: "tpl-elastic-scale",
  name: "Elastic Scale",
  category: "entrance",
  description: "A springy scale pop-in that overshoots and settles — playful and physical, like a rubber band snapping into place.",
  tags: ["elastic", "scale", "spring", "pop", "entrance", "overshoot"],
  build: () => [
    draft("Elastic Pop", {
      durationMs: 800,
      easing: easingPreset("elastic"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { scale: 0, opacity: 0 }),
        kf(0.2, { scale: 1.2, opacity: 0.8 }),
        kf(0.35, { scale: 0.9, opacity: 1 }),
        kf(0.5, { scale: 1.08 }),
        kf(0.65, { scale: 0.97 }),
        kf(0.8, { scale: 1.02 }),
        kf(1, { scale: 1, opacity: 1 }),
      ],
      style: {
        _content: "POP",
        _tag: "div",
        width: "120px",
        height: "120px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        backgroundColor: "#0a0a0a",
        border: "2px solid #ffffff",
        color: "#ffffff",
        fontSize: "20px",
        fontWeight: "bold",
      },
    }),
  ],
};
