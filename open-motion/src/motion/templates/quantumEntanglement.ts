/** Quantum Entanglement Template — twin particles with phase-shifted correlation. */

import type { EasingPreset } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const quantumEntanglementTemplate: TemplateDef = {
  id: "tpl-quantum-entanglement",
  name: "Quantum Entanglement",
  category: "emphasis",
  description:
    "Twin particles with phase-shifted correlation — visualizes quantum entanglement through mirrored motion, orbital dance, and energy exchange across an invisible bond.",
  tags: ["quantum", "entanglement", "twin", "correlation", "phase", "orbit", "emphasis", "abstract"],
  build: () => [
    // Quantum field background
    draft("Quantum Field", {
      durationMs: 6000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.6 }),
        kf(0.5, { opacity: 0.9 }),
        kf(1, { opacity: 0.6 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "420px",
        height: "240px",
        backgroundColor: "#0a0a14",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      },
    }),

    // Bond line connecting the particles
    draft("Entanglement Bond", {
      durationMs: 6000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.2, scaleX: 1 }),
        kf(0.5, { opacity: 0.8, scaleX: 1.2 }),
        kf(1, { opacity: 0.2, scaleX: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "300px",
        height: "2px",
        backgroundColor: "linear-gradient(90deg, transparent, #00d4ff, transparent)",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        boxShadow: "0 0 20px rgba(0, 212, 255, 0.6)",
      },
    }),

    // Particle Alpha — left twin
    draft("Particle Alpha", {
      durationMs: 3000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.7, scale: 1, translateX: -80, translateY: 0 }),
        kf(0.25, { opacity: 1, scale: 1.3, translateX: -40, translateY: -20 }),
        kf(0.5, { opacity: 0.8, scale: 0.9, translateX: 0, translateY: 0 }),
        kf(0.75, { opacity: 1, scale: 1.3, translateX: -40, translateY: 20 }),
        kf(1, { opacity: 0.7, scale: 1, translateX: -80, translateY: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "24px",
        height: "24px",
        backgroundColor: "#00d4ff",
        borderRadius: "50%",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-12px",
        marginTop: "-12px",
        boxShadow: "0 0 30px rgba(0, 212, 255, 0.8), 0 0 60px rgba(0, 212, 255, 0.4)",
      },
    }),

    // Particle Beta — right twin (phase-shifted mirror)
    draft("Particle Beta", {
      durationMs: 3000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.7, scale: 1, translateX: 80, translateY: 0 }),
        kf(0.25, { opacity: 1, scale: 1.3, translateX: 40, translateY: 20 }),
        kf(0.5, { opacity: 0.8, scale: 0.9, translateX: 0, translateY: 0 }),
        kf(0.75, { opacity: 1, scale: 1.3, translateX: 40, translateY: -20 }),
        kf(1, { opacity: 0.7, scale: 1, translateX: 80, translateY: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "24px",
        height: "24px",
        backgroundColor: "#ff00aa",
        borderRadius: "50%",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-12px",
        marginTop: "-12px",
        boxShadow: "0 0 30px rgba(255, 0, 170, 0.8), 0 0 60px rgba(255, 0, 170, 0.4)",
      },
    }),

    // Energy ripple — pulse emanating from the center
    draft("Energy Ripple", {
      durationMs: 2000,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.8, scale: 0 }),
        kf(0.5, { opacity: 0.4, scale: 1.5 }),
        kf(1, { opacity: 0, scale: 3 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "40px",
        height: "40px",
        border: "2px solid rgba(0, 212, 255, 0.6)",
        borderRadius: "50%",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-20px",
        marginTop: "-20px",
      },
    }),
  ],
};
