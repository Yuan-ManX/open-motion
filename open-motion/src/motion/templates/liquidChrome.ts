import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Liquid chrome: mercury-like fluid metal with chromatic shimmer
export const liquidChromeTemplate: TemplateDef = {
  id: "tpl-liquid-chrome",
  name: "Liquid Chrome",
  category: "emphasis",
  description: "Mercury-like fluid metal with chromatic aberration shifts — a premium, reflective emphasis that conveys polish and sophistication.",
  tags: ["emphasis", "liquid", "chrome", "metallic", "chromatic", "shimmer", "reflective", "premium"],
  build: () => [
    // Main chrome blob
    draft("Chrome Blob", {
      durationMs: 2500,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 0.9, skewX: -3, rotate: -2 }),
        kf(0.25, { scale: 1.05, skewX: 2, rotate: 1 }),
        kf(0.5, { scale: 0.95, skewX: -2, rotate: -1 }),
        kf(0.75, { scale: 1.02, skewX: 3, rotate: 2 }),
        kf(1, { scale: 0.9, skewX: -3, rotate: -2 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "180px",
        height: "180px",
        background: "conic-gradient(from 0deg, #e5e7eb, #9ca3af, #4b5563, #d1d5db, #f3f4f6, #6b7280, #e5e7eb)",
        borderRadius: "45% 55% 52% 48% / 50% 48% 52% 50%",
        boxShadow: "0 0 40px rgba(255,255,255,0.4), inset 0 0 30px rgba(255,255,255,0.3), inset 0 -20px 40px rgba(0,0,0,0.2)",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
    // Chromatic edge glow
    draft("Chrome Edge Glow", {
      durationMs: 2000,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.5, scale: 1.1 }),
        kf(0.5, { opacity: 0.8, scale: 1.2 }),
        kf(1, { opacity: 0.5, scale: 1.1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "200px",
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(255,255,255,0.3) 40%, transparent 60%)",
        borderRadius: "50%",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
    // Color shift overlay
    draft("Chrome Color Shift", {
      durationMs: 3000,
      delayMs: 0,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { opacity: 0.15, rotate: 0 }),
        kf(0.5, { opacity: 0.25, rotate: 180 }),
        kf(1, { opacity: 0.15, rotate: 360 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "190px",
        height: "190px",
        background: "conic-gradient(from 0deg, transparent, rgba(239,68,68,0.3), transparent, rgba(59,130,246,0.3), transparent, rgba(16,185,129,0.3), transparent)",
        borderRadius: "50%",
        mixBlendMode: "overlay",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
  ],
};