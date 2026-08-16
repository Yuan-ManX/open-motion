import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Ferrofluid reveal: mercury-like droplets coalesce into a cohesive whole,
// simulating ferrofluid behavior as surface tension overcomes dispersion.
export const ferrofluidRevealTemplate: TemplateDef = {
  id: "tpl-ferrofluid-reveal",
  name: "Ferrofluid Reveal",
  category: "entrance",
  description: "Dispersed droplets coalesce like ferrofluid responding to a magnetic field — a dense, industrial entrance with a weighty snap.",
  tags: ["entrance", "ferrofluid", "coalesce", "magnetic", "mercury", "droplets", "industrial"],
  build: () => [
    draft("Coalescing Body", {
      durationMs: 1350,
      easing: easingPreset("ease-in-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.15, borderRadius: "60%", skewX: 18, skewY: -10, blur: 12 }),
        kf(0.25, { opacity: 0.35, scale: 0.4, borderRadius: "42%", skewX: 8, skewY: -4, blur: 6 }),
        kf(0.55, { opacity: 0.8, scale: 0.88, borderRadius: "18%", skewX: 2, skewY: -1, blur: 1.5 }),
        kf(0.78, { opacity: 1, scale: 1.03, borderRadius: "6px", skewX: 0, skewY: 0, blur: 0 }),
        kf(1, { opacity: 1, scale: 1, borderRadius: "8px", skewX: 0, skewY: 0, blur: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "140px",
        height: "140px",
        borderRadius: "8px",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0EA5E9 100%)",
        boxShadow: "inset 0 0 28px rgba(14,165,233,0.35), 0 8px 30px rgba(15,23,42,0.6)",
      },
    }),
    draft("Surface Highlight", {
      durationMs: 1350,
      easing: easingPreset("ease-in-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.2, translateY: 10 }),
        kf(0.55, { opacity: 0, scale: 0.6, translateY: 4 }),
        kf(0.8, { opacity: 0.8, scale: 1.02, translateY: 0 }),
        kf(1, { opacity: 1, scale: 1, translateY: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "46px",
        height: "46px",
        borderRadius: "50%",
        background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.2) 55%, transparent 80%)",
        position: "absolute",
        top: "18px",
        left: "26px",
      },
    }),
  ],
};
