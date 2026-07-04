import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const resizeTemplate: TemplateDef = {
  id: "tpl-resize",
  name: "Resize",
  category: "entrance",
  description: "Expands width and height from a compact size — flexible and adaptive.",
  tags: ["resize", "scale", "entrance"],
  build: () => [
    draft("Panel", {
      durationMs: 700,
      easing: easingPreset("smooth"),
      keyframes: [
        kf(0, { width: 80, height: 80, opacity: 0 }),
        kf(1, { width: 240, height: 160, opacity: 1 }),
      ],
      style: {
        _content: "Resize",
        width: 240,
        height: 160,
        borderRadius: 14,
        backgroundColor: "#0ea5e9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        fontWeight: 700,
        color: "#ffffff",
        overflow: "hidden",
      },
    }),
  ],
};
