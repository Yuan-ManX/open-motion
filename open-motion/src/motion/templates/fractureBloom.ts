import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Fracture Bloom: geometric crystal shards fracture outward then transform into organic petal-like shapes that bloom into a flower
export const fractureBloomTemplate: TemplateDef = {
  id: "tpl-fracture-bloom",
  name: "Fracture Bloom",
  category: "entrance",
  description:
    "Geometric crystal shards fracture outward, then transform into organic petal-like shapes that bloom into a unified flower — an entrance that turns sharp geometry into a living, organic form.",
  tags: ["entrance", "fracture", "bloom", "crystal", "flower", "organic", "transform", "geometric"],
  build: () => [
    draft("Petal North", {
      durationMs: 1400,
      delayMs: 150,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.15, rotate: 120, borderRadius: "0% 0% 0% 0%" }),
        kf(0.5, { opacity: 0.6, scale: 0.7, rotate: 55, borderRadius: "20% 20% 0% 0%" }),
        kf(1, { opacity: 1, scale: 1, rotate: 0, borderRadius: "50% 50% 0% 0%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "50px",
        height: "90px",
        background:
          "linear-gradient(180deg, rgba(255,180,220,0.9) 0%, rgba(200,150,230,0.75) 60%, rgba(150,120,210,0.6) 100%)",
        boxShadow: "0 0 14px rgba(220,170,235,0.5)",
        position: "absolute",
        top: "50px",
        left: "175px",
        transformOrigin: "50% 100%",
      },
    }),
    draft("Petal Southeast", {
      durationMs: 1400,
      delayMs: 300,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.15, rotate: 240, borderRadius: "0% 0% 0% 0%" }),
        kf(0.5, { opacity: 0.6, scale: 0.7, rotate: 175, borderRadius: "20% 20% 0% 0%" }),
        kf(1, { opacity: 1, scale: 1, rotate: 120, borderRadius: "50% 50% 0% 0%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "50px",
        height: "90px",
        background:
          "linear-gradient(180deg, rgba(255,190,210,0.9) 0%, rgba(210,150,225,0.75) 60%, rgba(155,120,215,0.6) 100%)",
        boxShadow: "0 0 14px rgba(220,170,235,0.5)",
        position: "absolute",
        top: "50px",
        left: "175px",
        transformOrigin: "50% 100%",
      },
    }),
    draft("Petal Southwest", {
      durationMs: 1400,
      delayMs: 450,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.15, rotate: -240, borderRadius: "0% 0% 0% 0%" }),
        kf(0.5, { opacity: 0.6, scale: 0.7, rotate: -175, borderRadius: "20% 20% 0% 0%" }),
        kf(1, { opacity: 1, scale: 1, rotate: -120, borderRadius: "50% 50% 0% 0%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "50px",
        height: "90px",
        background:
          "linear-gradient(180deg, rgba(255,170,225,0.9) 0%, rgba(205,145,230,0.75) 60%, rgba(150,120,215,0.6) 100%)",
        boxShadow: "0 0 14px rgba(220,170,235,0.5)",
        position: "absolute",
        top: "50px",
        left: "175px",
        transformOrigin: "50% 100%",
      },
    }),
    draft("Bloom Core", {
      durationMs: 800,
      delayMs: 700,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0 }),
        kf(0.6, { opacity: 0.9, scale: 1.2 }),
        kf(1, { opacity: 1, scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "28px",
        height: "28px",
        background:
          "radial-gradient(circle, #fff6d8 0%, rgba(255,210,140,0.85) 50%, rgba(220,160,210,0.3) 80%, transparent 100%)",
        borderRadius: "50%",
        boxShadow: "0 0 18px 4px rgba(255,220,160,0.7)",
        position: "absolute",
        top: "126px",
        left: "186px",
        transformOrigin: "center center",
      },
    }),
  ],
};
