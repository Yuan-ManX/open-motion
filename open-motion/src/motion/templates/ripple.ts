import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const rippleTemplate: TemplateDef = {
  id: "tpl-ripple",
  name: "Ripple",
  category: "emphasis",
  description: "A circular ripple that expands outward and fades — the Material Design touch feedback pattern.",
  tags: ["ripple", "touch", "scale", "opacity", "feedback"],
  build: () => [
    draft("Ripple", {
      durationMs: 600,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { scale: 0, opacity: 0.6 }),
        kf(1, { scale: 4, opacity: 0 }),
      ],
      style: {
        _content: "",
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        backgroundColor: "#6366f1",
      },
    }),
  ],
};
