import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Liquid Wave — a flowing wave motion with multiple sinusoidal layers
 * that create a liquid-like undulating surface. Uses translateY shifts
 * with staggered timing and blur for an organic fluid feel.
 */
export const liquidWaveTemplate: TemplateDef = {
  id: "tpl-liquid-wave",
  name: "Liquid Wave",
  category: "emphasis",
  description:
    "Flowing liquid wave with multiple sinusoidal layers creating an undulating fluid surface — organic, ambient motion with staggered timing and soft blur.",
  tags: ["liquid", "wave", "fluid", "ambient", "organic", "flow", "loop", "sinusoidal"],
  build: () => [
    draft("Wave Container", {
      durationMs: 4000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { opacity: 0.9 }),
        kf(0.5, { opacity: 1 }),
        kf(1, { opacity: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "400px",
        height: "200px",
        borderRadius: "16px",
        backgroundColor: "#0a0a0a",
        overflow: "hidden",
        position: "relative",
      },
    }),
    draft("Wave Layer 1", {
      durationMs: 4000,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateY: "60%", rotate: -3 }),
        kf(0.5, { translateY: "40%", rotate: 3 }),
        kf(1, { translateY: "55%", rotate: -2 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120%",
        height: "140px",
        borderRadius: "50%",
        background: "linear-gradient(90deg, rgba(100,200,255,0.3), rgba(100,255,200,0.2), rgba(100,200,255,0.3))",
        filter: "blur(8px)",
        position: "absolute",
        left: "-10%",
        bottom: "0",
      },
    }),
    draft("Wave Layer 2", {
      durationMs: 3500,
      delayMs: 400,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateY: "50%", rotate: 2 }),
        kf(0.5, { translateY: "30%", rotate: -4 }),
        kf(1, { translateY: "45%", rotate: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "130%",
        height: "120px",
        borderRadius: "50%",
        background: "linear-gradient(90deg, rgba(200,100,255,0.25), rgba(255,100,200,0.15), rgba(200,100,255,0.25))",
        filter: "blur(12px)",
        position: "absolute",
        left: "-15%",
        bottom: "0",
      },
    }),
    draft("Wave Layer 3", {
      durationMs: 3000,
      delayMs: 800,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateY: "40%", scale: 1 }),
        kf(0.5, { translateY: "20%", scale: 1.05 }),
        kf(1, { translateY: "35%", scale: 0.98 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "140%",
        height: "100px",
        borderRadius: "50%",
        background: "linear-gradient(90deg, rgba(255,255,100,0.15), rgba(255,200,100,0.1), rgba(255,255,100,0.15))",
        filter: "blur(16px)",
        position: "absolute",
        left: "-20%",
        bottom: "0",
      },
    }),
  ],
};
