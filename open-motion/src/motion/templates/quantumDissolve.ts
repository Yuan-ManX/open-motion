import type { Keyframe } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Quantum Dissolve — the element deconstructs into quantum particles
 * that scatter outward with a probability-wave distribution before
 * reassembling in a new configuration. A high-impact exit/transition.
 */
export const quantumDissolveTemplate: TemplateDef = {
  id: "tpl-quantum-dissolve",
  name: "Quantum Dissolve",
  category: "exit",
  description:
    "Deconstructs into quantum particles that scatter with probability-wave distribution before fading into nothing.",
  tags: ["exit", "particles", "quantum", "transition", "scatter", "dissolve"],
  build: () => {
    const keyframes: Keyframe[] = [
      kf(0, {
        opacity: 1,
        scale: 1,
        blur: 0,
        translateX: 0,
        translateY: 0,
      }),
      kf(0.2, {
        opacity: 0.9,
        scale: 1.02,
        blur: 1,
        translateX: -2,
        translateY: -1,
      }),
      kf(0.4, {
        opacity: 0.6,
        scale: 1.08,
        blur: 4,
        translateX: 6,
        translateY: -4,
      }),
      kf(0.6, {
        opacity: 0.3,
        scale: 1.15,
        blur: 10,
        translateX: -8,
        translateY: 6,
      }),
      kf(0.8, {
        opacity: 0.1,
        scale: 1.25,
        blur: 18,
        translateX: 12,
        translateY: -8,
      }),
      kf(1, {
        opacity: 0,
        scale: 1.4,
        blur: 30,
        translateX: 0,
        translateY: 0,
      }),
    ];

    return [
      draft("Quantum Dissolve", {
        durationMs: 900,
        easing: easingPreset("ease-in-cubic"),
        iterationCount: 1,
        keyframes,
        trigger: "onLoad",
        style: {
          _content: "",
          _tag: "div",
          width: "240px",
          height: "160px",
          backgroundColor: "#12121e",
          borderRadius: "12px",
          boxShadow: "0 0 40px rgba(34, 211, 238, 0.3)",
        },
      }),
    ];
  },
};
