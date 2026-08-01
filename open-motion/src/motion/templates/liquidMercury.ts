import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Liquid Mercury — a fluid metallic surface that ripples and morphs through
 * surface tension phases. Multiple blob layers with staggered border-radius
 * and scale animations create the impression of a liquid metal surface
 * responding to invisible forces. Original composition exploring organic
 * shape deformation through discrete CSS keyframes.
 */
export const liquidMercuryTemplate: TemplateDef = {
  id: "tpl-liquid-mercury",
  name: "Liquid Mercury",
  category: "emphasis",
  description:
    "Metallic fluid surface with organic morphing, surface tension ripples, and specular highlight drift — explores liquid metal aesthetics through layered blob animations.",
  tags: ["liquid", "mercury", "metallic", "morph", "organic", "fluid", "emphasis", "abstract"],
  build: () => [
    draft("Mercury Pool", {
      durationMs: 4000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.95, borderRadius: "40% 60% 55% 45% / 50% 45% 55% 50%" }),
        kf(0.25, { opacity: 1, borderRadius: "55% 45% 40% 60% / 45% 55% 50% 45%" }),
        kf(0.5, { opacity: 0.9, borderRadius: "60% 40% 60% 40% / 40% 60% 40% 60%" }),
        kf(0.75, { opacity: 1, borderRadius: "45% 55% 50% 50% / 55% 50% 45% 55%" }),
        kf(1, { opacity: 0.95, borderRadius: "50% 50% 45% 55% / 50% 55% 50% 45%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "280px",
        height: "280px",
        backgroundColor: "#C0C0C0",
        borderRadius: "50%",
        position: "relative",
        overflow: "hidden",
        boxShadow: "inset -20px -20px 40px rgba(0,0,0,0.4), inset 20px 20px 40px rgba(255,255,255,0.3), 0 0 60px rgba(192,192,192,0.3)",
      },
    }),
    draft("Surface Ripple 1", {
      durationMs: 3000,
      delayMs: 0,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.8, scale: 0.3, borderRadius: "50%" }),
        kf(0.5, { opacity: 0.4, scale: 0.7, borderRadius: "45% 55% 50% 50%" }),
        kf(1, { opacity: 0, scale: 1, borderRadius: "50%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "200px",
        border: "2px solid rgba(255,255,255,0.5)",
        borderRadius: "50%",
        position: "absolute",
        top: "40px",
        left: "40px",
      },
    }),
    draft("Surface Ripple 2", {
      durationMs: 3000,
      delayMs: 1000,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.6, scale: 0.2, borderRadius: "50%" }),
        kf(0.5, { opacity: 0.3, scale: 0.6, borderRadius: "55% 45% 50% 50%" }),
        kf(1, { opacity: 0, scale: 0.9, borderRadius: "50%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "160px",
        height: "160px",
        border: "2px solid rgba(255,255,255,0.4)",
        borderRadius: "50%",
        position: "absolute",
        top: "60px",
        left: "60px",
      },
    }),
    draft("Specular Highlight", {
      durationMs: 5000,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.6, translateX: -30, translateY: -30, scale: 0.8 }),
        kf(0.5, { opacity: 0.9, translateX: 20, translateY: 10, scale: 1.1 }),
        kf(1, { opacity: 0.5, translateX: 30, translateY: 25, scale: 0.7 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "80px",
        height: "80px",
        backgroundColor: "rgba(255,255,255,0.7)",
        borderRadius: "50%",
        filter: "blur(20px)",
        position: "absolute",
        top: "50px",
        left: "50px",
      },
    }),
    draft("Mercury Droplet", {
      durationMs: 2500,
      delayMs: 500,
      easing: easingPreset("bounce"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scale: 0, translateY: -100 }),
        kf(0.3, { opacity: 1, scale: 0.8, translateY: -20 }),
        kf(0.6, { opacity: 1, scale: 1, translateY: 0 }),
        kf(0.8, { opacity: 1, scale: 0.9, translateY: 5 }),
        kf(1, { opacity: 0, scale: 0.3, translateY: 80 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "24px",
        height: "24px",
        backgroundColor: "#E8E8E8",
        borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
        position: "absolute",
        top: "20px",
        left: "128px",
        boxShadow: "inset -4px -4px 8px rgba(0,0,0,0.3), inset 4px 4px 8px rgba(255,255,255,0.5)",
      },
    }),
  ],
};
