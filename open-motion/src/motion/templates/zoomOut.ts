import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const zoomOutTemplate: TemplateDef = {
  id: "tpl-zoom-out",
  name: "Zoom Out",
  category: "exit",
  description: "Retreats into the distance with a scale-down and fade — creates depth as the element departs.",
  tags: ["scale", "zoom", "exit", "depth", "opacity"],
  build: () => [
    draft("Zooming Panel", {
      durationMs: 700,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { scale: 1, opacity: 1 }),
        kf(0.6, { scale: 0.9, opacity: 0.7 }),
        kf(1, { scale: 0.3, opacity: 0 }),
      ],
      style: {
        width: "180px",
        height: "120px",
        borderRadius: "12px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #333333",
      },
    }),
  ],
};
