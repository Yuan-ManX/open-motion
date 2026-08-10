import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const slideUpExitTemplate: TemplateDef = {
  id: "tpl-slide-up-exit",
  name: "Slide Up Exit",
  category: "exit",
  description: "Translates vertically upward off-screen while fading — the natural pair to Slide Out for upward-dismissing toasts and banners.",
  tags: ["slide", "exit", "translate", "vertical", "opacity", "upward"],
  build: () => [
    draft("Sliding Up Card", {
      durationMs: 480,
      easing: easingPreset("ease-in-quad"),
      keyframes: [
        kf(0, { translateY: "0px", opacity: 1 }),
        kf(0.6, { translateY: "-40px", opacity: 0.6 }),
        kf(1, { translateY: "-120px", opacity: 0 }),
      ],
      style: {
        width: "200px",
        height: "64px",
        borderRadius: "10px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #262626",
      },
    }),
  ],
};
