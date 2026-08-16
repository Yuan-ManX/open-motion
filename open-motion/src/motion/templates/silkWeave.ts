import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Silk weave: flowing silk fabric with woven thread patterns
export const silkWeaveTemplate: TemplateDef = {
  id: "tpl-silk-weave",
  name: "Silk Weave",
  category: "transition",
  description: "Flowing silk fabric with woven thread patterns that ripple across the canvas — a luxurious, tactile transition that conveys craft and elegance.",
  tags: ["transition", "silk", "weave", "fabric", "luxury", "tactile", "ripple", "elegant"],
  build: () => [
    // Silk fabric ripple
    draft("Silk Fabric A", {
      durationMs: 2000,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { skewX: -5, translateY: 0 }),
        kf(0.25, { skewX: 3, translateY: -8 }),
        kf(0.5, { skewX: -3, translateY: 4 }),
        kf(0.75, { skewX: 5, translateY: -4 }),
        kf(1, { skewX: -5, translateY: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "300px",
        height: "200px",
        background: "linear-gradient(135deg, rgba(236,72,153,0.3) 0%, rgba(244,114,182,0.5) 25%, rgba(251,207,232,0.6) 50%, rgba(244,114,182,0.5) 75%, rgba(236,72,153,0.3) 100%)",
        borderRadius: "20px",
        boxShadow: "0 10px 40px rgba(236,72,153,0.3), inset 0 0 30px rgba(255,255,255,0.2)",
        position: "absolute",
        left: "10%",
        top: "20%",
      },
    }),
    // Thread weave pattern overlay
    draft("Silk Weave Pattern", {
      durationMs: 3000,
      delayMs: 0,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { opacity: 0.3, translateX: -20 }),
        kf(0.5, { opacity: 0.5, translateX: 20 }),
        kf(1, { opacity: 0.3, translateX: -20 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "220px",
        backgroundImage: `repeating-linear-gradient(
          90deg,
          transparent,
          transparent 8px,
          rgba(255,255,255,0.15) 8px,
          rgba(255,255,255,0.15) 9px
        ), repeating-linear-gradient(
          0deg,
          transparent,
          transparent 8px,
          rgba(255,255,255,0.1) 8px,
          rgba(255,255,255,0.1) 9px
        )`,
        borderRadius: "20px",
        mixBlendMode: "overlay",
        position: "absolute",
        left: "10%",
        top: "20%",
      },
    }),
    // Secondary silk layer
    draft("Silk Fabric B", {
      durationMs: 2500,
      delayMs: 300,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { skewX: 4, translateY: 0 }),
        kf(0.3, { skewX: -3, translateY: 6 }),
        kf(0.6, { skewX: 4, translateY: -4 }),
        kf(1, { skewX: -4, translateY: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "280px",
        height: "180px",
        background: "linear-gradient(225deg, rgba(251,113,133,0.3) 0%, rgba(253,164,175,0.5) 25%, rgba(254,205,211,0.6) 50%, rgba(253,164,175,0.5) 75%, rgba(251,113,133,0.3) 100%)",
        borderRadius: "16px",
        boxShadow: "0 10px 40px rgba(251,113,133,0.3), inset 0 0 20px rgba(255,255,255,0.15)",
        mixBlendMode: "screen",
        position: "absolute",
        right: "10%",
        bottom: "20%",
      },
    }),
  ],
};