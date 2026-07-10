import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const glitchTemplate: TemplateDef = {
  id: "tpl-glitch",
  name: "Glitch",
  category: "emphasis",
  description: "Digital distortion with rapid position jitter, opacity flicker, and scale jumps — a cyberpunk aesthetic.",
  tags: ["glitch", "distortion", "digital", "translateX", "opacity", "scale"],
  build: () => [
    draft("Glitch Box", {
      durationMs: 600,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { translateX: 0, opacity: 1, scale: 1 }),
        kf(0.1, { translateX: -4, opacity: 0.8, scale: 1.02 }),
        kf(0.15, { translateX: 3, opacity: 1, scale: 0.98 }),
        kf(0.2, { translateX: -2, opacity: 0.6 }),
        kf(0.25, { translateX: 0, opacity: 1, scale: 1 }),
        kf(0.5, { translateX: 0, opacity: 1 }),
        kf(0.55, { translateX: 5, opacity: 0.5, scale: 1.05 }),
        kf(0.6, { translateX: -3, opacity: 1, scale: 1 }),
        kf(0.65, { translateX: 2, opacity: 0.7 }),
        kf(0.7, { translateX: 0, opacity: 1, scale: 1 }),
        kf(1, { translateX: 0, opacity: 1, scale: 1 }),
      ],
      style: {
        _content: "GLITCH",
        _tag: "div",
        width: "200px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 0,
        backgroundColor: "#0a0a0a",
        color: "#ffffff",
        fontSize: "24px",
        fontFamily: "monospace",
        fontWeight: "bold",
        letterSpacing: "2px",
        boxShadow: "2px 0 0 #ff00ff, -2px 0 0 #00ffff",
      },
    }),
  ],
};
