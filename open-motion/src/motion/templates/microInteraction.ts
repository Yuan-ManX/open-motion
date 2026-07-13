import { easingSpring } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const microInteractionTemplate: TemplateDef = {
  id: "tpl-micro-interaction",
  name: "Micro Interaction",
  category: "emphasis",
  description: "A subtle spring-based feedback wiggle for interactive elements — toggle, icon, or badge.",
  tags: ["micro", "interaction", "feedback", "spring", "scale"],
  build: () => [
    draft("Micro Icon", {
      durationMs: 500,
      easing: easingSpring(200, 12, 1),
      trigger: "onHover",
      keyframes: [
        kf(0, { scale: 1 }),
        kf(0.3, { scale: 1.15 }),
        kf(0.6, { scale: 0.95 }),
        kf(1, { scale: 1 }),
      ],
      style: {
        _content: "✦",
        width: 48,
        height: 48,
        background: "#222",
        borderRadius: "50%",
        color: "#f4f6fb",
        fontSize: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      },
    }),
  ],
};
