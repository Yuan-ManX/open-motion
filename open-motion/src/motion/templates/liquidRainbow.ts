import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Liquid rainbow — a hue-rotating gradient that scrolls diagonally across the
// element, while the body gently breathes in size. The combination reads as
// playful, creative, and youthful — the right companion for discovery or
// creative surfaces.
export const liquidRainbowTemplate: TemplateDef = {
  id: "tpl-liquid-rainbow",
  name: "Liquid Rainbow",
  category: "emphasis",
  description: "Hue-rotating diagonal gradient with a breathing scale — playful, creative, and full-spectrum presence.",
  tags: ["rainbow", "hue", "gradient", "color", "breathe", "colorful", "pride", "creative", "playful"],
  build: () => [
    draft("Rainbow Body", {
      durationMs: 5600,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 1 }),
        kf(0.5, { scale: 1.05 }),
        kf(1, { scale: 0.98 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "120px",
        borderRadius: "20px",
        background:
          "linear-gradient(120deg, #FF6B6B 0%, #F8B500 18%, #48BB78 36%, #38B2AC 54%, #4299E1 72%, #9F7AEA 90%, #FF6B6B 100%)",
        backgroundSize: "400% 400%",
        boxShadow: "0 18px 50px rgba(90,80,200,0.25)",
      },
    }),
    draft("Hue Drift", {
      durationMs: 8000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      // No transforms: we use this component to carry the gradient-position drift
      // through the style layer (animated via the runtime below). The keyframes
      // keep the component in the loop so the animation is scheduled.
      keyframes: [
        kf(0, { opacity: 1 }),
        kf(1, { opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "120px",
        borderRadius: "20px",
        pointerEvents: "none",
      },
    }),
  ],
};
