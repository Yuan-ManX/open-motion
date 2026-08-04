/**
 * Crystalline Growth Template — branching crystal formation pattern.
 *
 * An original template that visualizes crystal growth through branching
 * geometry. Seed crystals expand outward in geometric patterns, split into
 * branches, and form a crystalline lattice that shimmers with refracted
 * light. The motion explores the mathematics of crystal formation as
 * choreographed animation.
 *
 * The template treats crystal growth as a temporal composition: each facet
 * emerges in sequence, refracts light, and contributes to the overall
 * lattice structure — a frozen moment of geological time.
 */

import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const crystallineGrowthTemplate: TemplateDef = {
  id: "tpl-crystalline-growth",
  name: "Crystalline Growth",
  category: "emphasis",
  description:
    "Branching crystal formation with geometric growth, light refraction, and lattice shimmer — visualizes the mathematics of crystal growth as choreographed animation across a temporal composition.",
  tags: ["crystal", "growth", "geometric", "branching", "lattice", "refraction", "emphasis", "abstract"],
  build: () => [
    // Dark geological background
    draft("Geological Bed", {
      durationMs: 6000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.85 }),
        kf(0.5, { opacity: 1 }),
        kf(1, { opacity: 0.85 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "420px",
        height: "280px",
        backgroundColor: "#0d0d12",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      },
    }),

    // Central seed crystal — the origin point
    draft("Seed Crystal", {
      durationMs: 2000,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scale: 0, rotate: 0 }),
        kf(0.3, { opacity: 1, scale: 1, rotate: 30 }),
        kf(0.7, { opacity: 0.9, scale: 1.1, rotate: 45 }),
        kf(1, { opacity: 0.7, scale: 1, rotate: 60 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "40px",
        height: "40px",
        backgroundColor: "rgba(180, 220, 255, 0.9)",
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-20px",
        marginTop: "-20px",
        boxShadow: "0 0 40px rgba(180, 220, 255, 0.6)",
      },
    }),

    // Branch crystal 1 — upper right
    draft("Branch Alpha", {
      durationMs: 3000,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      delayMs: 200,
      keyframes: [
        kf(0, { opacity: 0, scale: 0, translateX: 0, translateY: 0, rotate: 45 }),
        kf(0.4, { opacity: 1, scale: 1, translateX: 60, translateY: -60, rotate: 45 }),
        kf(0.8, { opacity: 0.8, scale: 1.2, translateX: 80, translateY: -80, rotate: 45 }),
        kf(1, { opacity: 0, scale: 1.3, translateX: 100, translateY: -100, rotate: 45 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "30px",
        height: "30px",
        backgroundColor: "rgba(200, 230, 255, 0.8)",
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-15px",
        marginTop: "-15px",
        boxShadow: "0 0 20px rgba(200, 230, 255, 0.5)",
      },
    }),

    // Branch crystal 2 — lower left
    draft("Branch Beta", {
      durationMs: 3000,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      delayMs: 400,
      keyframes: [
        kf(0, { opacity: 0, scale: 0, translateX: 0, translateY: 0, rotate: -45 }),
        kf(0.4, { opacity: 1, scale: 1, translateX: -60, translateY: 60, rotate: -45 }),
        kf(0.8, { opacity: 0.8, scale: 1.2, translateX: -80, translateY: 80, rotate: -45 }),
        kf(1, { opacity: 0, scale: 1.3, translateX: -100, translateY: 100, rotate: -45 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "30px",
        height: "30px",
        backgroundColor: "rgba(200, 230, 255, 0.8)",
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-15px",
        marginTop: "-15px",
        boxShadow: "0 0 20px rgba(200, 230, 255, 0.5)",
      },
    }),

    // Branch crystal 3 — upper left
    draft("Branch Gamma", {
      durationMs: 3000,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      delayMs: 600,
      keyframes: [
        kf(0, { opacity: 0, scale: 0, translateX: 0, translateY: 0, rotate: -45 }),
        kf(0.4, { opacity: 1, scale: 1, translateX: -60, translateY: -60, rotate: -45 }),
        kf(0.8, { opacity: 0.8, scale: 1.2, translateX: -80, translateY: -80, rotate: -45 }),
        kf(1, { opacity: 0, scale: 1.3, translateX: -100, translateY: -100, rotate: -45 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "30px",
        height: "30px",
        backgroundColor: "rgba(180, 220, 255, 0.7)",
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-15px",
        marginTop: "-15px",
        boxShadow: "0 0 20px rgba(180, 220, 255, 0.4)",
      },
    }),

    // Branch crystal 4 — lower right
    draft("Branch Delta", {
      durationMs: 3000,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      delayMs: 800,
      keyframes: [
        kf(0, { opacity: 0, scale: 0, translateX: 0, translateY: 0, rotate: 45 }),
        kf(0.4, { opacity: 1, scale: 1, translateX: 60, translateY: 60, rotate: 45 }),
        kf(0.8, { opacity: 0.8, scale: 1.2, translateX: 80, translateY: 80, rotate: 45 }),
        kf(1, { opacity: 0, scale: 1.3, translateX: 100, translateY: 100, rotate: 45 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "30px",
        height: "30px",
        backgroundColor: "rgba(180, 220, 255, 0.7)",
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-15px",
        marginTop: "-15px",
        boxShadow: "0 0 20px rgba(180, 220, 255, 0.4)",
      },
    }),

    // Lattice shimmer — periodic light refraction across the formation
    draft("Lattice Shimmer", {
      durationMs: 4000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0, scale: 0.5 }),
        kf(0.5, { opacity: 0.3, scale: 1.5 }),
        kf(1, { opacity: 0, scale: 2.5 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100px",
        height: "100px",
        background: "radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)",
        borderRadius: "50%",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-50px",
        marginTop: "-50px",
        pointerEvents: "none",
      },
    }),
  ],
};
