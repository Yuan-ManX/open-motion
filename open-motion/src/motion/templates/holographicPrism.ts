import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Holographic prism: a faceted prism assembles from light shards, refracting
// a chromatic spectrum as it solidifies into a crystalline whole.
export const holographicPrismTemplate: TemplateDef = {
  id: "tpl-holographic-prism",
  name: "Holographic Prism",
  category: "entrance",
  description: "Light shards converge into a faceted prism that refracts a chromatic spectrum — a crystalline, holographic entrance with spectral dispersion.",
  tags: ["entrance", "holographic", "prism", "spectrum", "refraction", "crystalline", "chromatic"],
  build: () => [
    draft("Prism Body", {
      durationMs: 1300,
      easing: easingPreset("ease-in-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.2, rotateY: 90, skewX: 30, blur: 10 }),
        kf(0.4, { opacity: 0.6, scale: 0.7, rotateY: 45, skewX: 15, blur: 4 }),
        kf(0.75, { opacity: 0.95, scale: 1.05, rotateY: -8, skewX: -2, blur: 0 }),
        kf(1, { opacity: 1, scale: 1, rotateY: 0, skewX: 0, blur: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "150px",
        height: "150px",
        clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
        background: "linear-gradient(135deg, rgba(34,211,238,0.3) 0%, rgba(167,139,250,0.4) 50%, rgba(244,114,182,0.3) 100%)",
        backdropFilter: "blur(2px)",
        border: "1px solid rgba(255,255,255,0.4)",
        boxShadow: "0 0 40px rgba(167,139,250,0.5)",
      },
    }),
    draft("Spectrum Fan", {
      durationMs: 1300,
      easing: easingPreset("ease-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.3, rotate: -45 }),
        kf(0.5, { opacity: 0.7, scale: 0.85, rotate: -15 }),
        kf(1, { opacity: 1, scale: 1, rotate: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "8px",
        background: "linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7)",
        position: "absolute",
        top: "71px",
        left: "-25px",
        borderRadius: "4px",
        filter: "blur(2px)",
        opacity: 0.85,
      },
    }),
    draft("Inner Glow", {
      durationMs: 1300,
      easing: easingPreset("ease-in-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0 }),
        kf(0.6, { opacity: 0.4, scale: 0.7 }),
        kf(1, { opacity: 0.9, scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "60px",
        height: "60px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(167,139,250,0.4) 50%, transparent 80%)",
        position: "absolute",
        top: "45px",
        left: "45px",
      },
    }),
  ],
};
