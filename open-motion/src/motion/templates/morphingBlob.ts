import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Morphing blob: an organic shape that continuously morphs between forms,
// creating a hypnotic, living presence. Conveys adaptability and life.
export const morphingBlobTemplate: TemplateDef = {
  id: "tpl-morphing-blob",
  name: "Morphing Blob",
  category: "emphasis",
  description: "An organic shape continuously morphs between forms — a hypnotic, living presence that conveys adaptability and organic life.",
  tags: ["emphasis", "morph", "blob", "organic", "liquid", "hypnotic", "living", "shape"],
  build: () => [
    draft("Morph Core", {
      durationMs: 3000,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 1, rotate: 0, borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" }),
        kf(0.25, { scale: 1.1, rotate: 90, borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%" }),
        kf(0.5, { scale: 0.95, rotate: 180, borderRadius: "50% 50% 20% 80% / 25% 80% 20% 75%" }),
        kf(0.75, { scale: 1.05, rotate: 270, borderRadius: "70% 30% 50% 50% / 30% 50% 70% 70%" }),
        kf(1, { scale: 1, rotate: 360, borderRadius: "40% 60% 70% 30% / 40% 70% 30% 60%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "200px",
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
        borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
        boxShadow: "0 0 60px rgba(139,92,246,0.4)",
      },
    }),
    draft("Morph Glow", {
      durationMs: 3000,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.3, scale: 1.3, rotate: 0 }),
        kf(0.5, { opacity: 0.6, scale: 1.5, rotate: 180 }),
        kf(1, { opacity: 0.2, scale: 1.2, rotate: 360 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "240px",
        height: "240px",
        background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)",
        borderRadius: "50%",
        position: "absolute",
        top: "-20px",
        left: "-20px",
      },
    }),
  ],
};
