import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const scaleTemplate: TemplateDef = {
  id: "tpl-scale-in",
  name: "Scale In",
  category: "entrance",
  description: "Grows from nothing with a smooth ease — focused and clean.",
  tags: ["scale", "entrance"],
  build: () => [
    draft("Card", {
      durationMs: 600,
      easing: easingPreset("back"),
      keyframes: [kf(0, { scale: 0, opacity: 0 }), kf(1, { scale: 1, opacity: 1 })],
      style: {
        _content: "Card",
        width: 200,
        height: 120,
        borderRadius: 16,
        backgroundColor: "#1f2937",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        fontWeight: 600,
        color: "#f4f6fb",
        boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
      },
    }),
  ],
};
