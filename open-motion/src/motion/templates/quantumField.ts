import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Quantum Field — a probabilistic particle field where points appear and
 * vanish across a dark surface, evoking quantum uncertainty. Three layered
 * particle groups pulse with different sizes and timing offsets.
 */
export const quantumFieldTemplate: TemplateDef = {
  id: "tpl-quantum-field",
  name: "Quantum Field",
  category: "emphasis",
  description:
    "Probabilistic particle field with multiple layers of points appearing and vanishing across a dark surface — evokes quantum uncertainty with staggered timing and scale.",
  tags: ["quantum", "particle", "field", "probability", "physics", "abstract", "loop"],
  build: () => [
    draft("Quantum Field Stage", {
      durationMs: 4000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.9 }),
        kf(0.5, { opacity: 1 }),
        kf(1, { opacity: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "360px",
        height: "240px",
        backgroundColor: "#0a0a0a",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      },
    }),
    draft("Particle Layer Large", {
      durationMs: 3200,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0, scale: 0.2, translateX: "-30%", translateY: "-20%" }),
        kf(0.3, { opacity: 1, scale: 1, translateX: "10%", translateY: "5%" }),
        kf(0.7, { opacity: 0.8, scale: 1.1, translateX: "30%", translateY: "20%" }),
        kf(1, { opacity: 0, scale: 0.3, translateX: "50%", translateY: "40%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 0 12px 2px rgba(150,180,255,0.8), 0 0 24px 4px rgba(150,180,255,0.4)",
        position: "absolute",
        top: "40%",
        left: "20%",
        filter: "blur(0.5px)",
      },
    }),
    draft("Particle Layer Medium", {
      durationMs: 2600,
      delayMs: 400,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0, scale: 0.2, translateX: "20%", translateY: "30%" }),
        kf(0.35, { opacity: 0.9, scale: 1, translateX: "-15%", translateY: "-10%" }),
        kf(0.75, { opacity: 0.7, scale: 1.05, translateX: "-40%", translateY: "-30%" }),
        kf(1, { opacity: 0, scale: 0.4, translateX: "-60%", translateY: "-50%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        backgroundColor: "#f0f4ff",
        boxShadow: "0 0 8px 2px rgba(120,160,255,0.7), 0 0 16px 3px rgba(120,160,255,0.3)",
        position: "absolute",
        top: "30%",
        left: "60%",
      },
    }),
    draft("Particle Layer Small", {
      durationMs: 2000,
      delayMs: 800,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0, scale: 0.2, translateX: "10%", translateY: "-40%" }),
        kf(0.3, { opacity: 0.8, scale: 1, translateX: "20%", translateY: "-10%" }),
        kf(0.6, { opacity: 1, scale: 1.1, translateX: "40%", translateY: "20%" }),
        kf(1, { opacity: 0, scale: 0.3, translateX: "60%", translateY: "50%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 0 6px 1px rgba(180,200,255,0.9), 0 0 12px 2px rgba(180,200,255,0.4)",
        position: "absolute",
        top: "60%",
        left: "40%",
      },
    }),
  ],
};
