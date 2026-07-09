import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const shimmerTemplate: TemplateDef = {
  id: "tpl-shimmer",
  name: "Shimmer",
  category: "load",
  description: "A skeleton loading bar with a sweeping highlight.",
  tags: ["loading", "skeleton", "translateX"],
  build: () => [
    draft("Shimmer Bar", {
      durationMs: 1500,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { translateX: "-100%" }),
        kf(1, { translateX: "100%" }),
      ],
      style: {
        _content: "",
        width: "300px",
        height: "16px",
        borderRadius: 8,
        backgroundColor: "#1e293b",
        backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
        backgroundSize: "200% 100%",
      },
    }),
  ],
};
