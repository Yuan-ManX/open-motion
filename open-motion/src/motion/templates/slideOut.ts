import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const slideOutTemplate: TemplateDef = {
  id: "tpl-slide-out",
  name: "Slide Out",
  category: "exit",
  description: "Slides horizontally off-screen while fading — a confident dismissal that clears the viewport.",
  tags: ["slide", "exit", "translate", "horizontal", "opacity"],
  build: () => [
    draft("Sliding Card", {
      durationMs: 500,
      easing: easingPreset("ease-in-quad"),
      keyframes: [
        kf(0, { translateX: "0px", opacity: 1 }),
        kf(1, { translateX: "120px", opacity: 0 }),
      ],
      style: {
        width: "180px",
        height: "120px",
        borderRadius: "12px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #262626",
      },
    }),
  ],
};
