import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const liquidMetalTemplate: TemplateDef = {
  id: "tpl-liquid-metal",
  name: "Liquid Metal",
  category: "emphasis",
  description: "A mercury-like surface with flowing border-radius morph, sheen sweep, and specular highlights — a dense, reflective material in motion.",
  tags: ["liquid", "metal", "mercury", "chrome", "reflective", "morph", "sheen"],
  build: () => [
    draft("Metal Surface", {
      durationMs: 4000,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { borderRadius: "30% 70% 50% 50%", rotate: 0 }),
        kf(0.33, { borderRadius: "50% 50% 70% 30%", rotate: 5 }),
        kf(0.66, { borderRadius: "70% 30% 40% 60%", rotate: -3 }),
        kf(1, { borderRadius: "40% 60% 50% 50%", rotate: 2 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "180px",
        height: "180px",
        background: "linear-gradient(135deg, #2a2a2a 0%, #5a5a5a 30%, #1a1a1a 60%, #4a4a4a 100%)",
        boxShadow: "inset -10px -10px 20px rgba(0,0,0,0.6), inset 10px 10px 20px rgba(255,255,255,0.08)",
      },
    }),
    draft("Specular Sheen", {
      durationMs: 3000,
      delayMs: 500,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { translateX: "-100%", opacity: 0 }),
        kf(0.4, { opacity: 0.6 }),
        kf(0.6, { opacity: 0.4 }),
        kf(1, { translateX: "100%", opacity: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "60px",
        height: "180px",
        borderRadius: "50%",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
        filter: "blur(4px)",
        position: "absolute",
        top: "0",
        left: "0",
      },
    }),
  ],
};
