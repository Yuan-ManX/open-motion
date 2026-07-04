import { easingSpring } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const springTemplate: TemplateDef = {
  id: "tpl-spring",
  name: "Spring",
  category: "entrance",
  description: "Physics-driven entrance with spring easing — natural overshoot and settle.",
  tags: ["spring", "physics", "entrance"],
  build: () => [
    draft("Orb", {
      durationMs: 1000,
      easing: easingSpring(140, 12, 1),
      keyframes: [
        kf(0, { scale: 0.2, opacity: 0 }),
        kf(0.5, { scale: 1.1, opacity: 1 }),
        kf(1, { scale: 1 }),
      ],
      style: {
        _content: "Spring",
        width: 120,
        height: 120,
        borderRadius: "50%",
        backgroundColor: "#22c55e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        fontWeight: 700,
        color: "#ffffff",
        boxShadow: "0 12px 40px rgba(34,197,94,0.4)",
      },
    }),
  ],
};
