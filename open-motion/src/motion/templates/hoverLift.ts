import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const hoverLiftTemplate: TemplateDef = {
  id: "tpl-hover-lift",
  name: "Hover Lift",
  category: "emphasis",
  description: "A card that lifts upward with a growing shadow on hover — depth and tactility.",
  tags: ["hover", "lift", "card", "translateY", "shadow"],
  build: () => [
    draft("Lift Card", {
      durationMs: 250,
      easing: easingPreset("ease-out"),
      trigger: "onHover",
      keyframes: [
        kf(0, { translateY: 0 }),
        kf(1, { translateY: -8 }),
      ],
      style: {
        _content: "Hover Me",
        width: 200,
        height: 100,
        background: "#1e1e1e",
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        color: "#f4f6fb",
        fontSize: 16,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      },
    }),
  ],
};
