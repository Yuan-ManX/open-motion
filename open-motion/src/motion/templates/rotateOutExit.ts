import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const rotateOutExitTemplate: TemplateDef = {
  id: "tpl-rotate-out-exit",
  name: "Rotate Out Exit",
  category: "exit",
  description: "Spins 90 degrees while shrinking and fading — a playful departure that pairs well with Rotate In entrances.",
  tags: ["rotate", "exit", "spin", "scale", "opacity", "playful"],
  build: () => [
    draft("Rotating Out Tile", {
      durationMs: 600,
      easing: easingPreset("ease-in-cubic"),
      keyframes: [
        kf(0, { rotate: "0deg", scale: 1, opacity: 1 }),
        kf(0.5, { rotate: "45deg", scale: 0.7, opacity: 0.6 }),
        kf(1, { rotate: "90deg", scale: 0, opacity: 0 }),
      ],
      style: {
        width: "140px",
        height: "140px",
        borderRadius: "12px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #262626",
      },
    }),
  ],
};
