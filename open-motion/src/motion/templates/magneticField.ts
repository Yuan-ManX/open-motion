/**
 * Magnetic Field template — particles that follow curved magnetic field lines,
 * creating an organic, physics-driven motion pattern.
 *
 * Multiple particle streams trace invisible field paths, pulsing in intensity
 * and creating a sense of invisible forces at work.
 */

import { easingPreset } from "@openmotion/shared";
import type { TemplateDef } from "./helper.js";
import { draft, kf } from "./helper.js";

export const magneticFieldTemplate: TemplateDef = {
  id: "tpl-magnetic-field",
  name: "Magnetic Field",
  category: "emphasis",
  description:
    "Particles streaming along invisible magnetic field lines — organic, physics-driven motion with pulsing intensity and curved trajectories.",
  tags: ["magnetic", "field", "particle", "stream", "curve", "physics", "force", "loop"],
  build: () => [
    draft("Field Container", {
      durationMs: 4000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { opacity: 0.8 }),
        kf(0.5, { opacity: 1 }),
        kf(1, { opacity: 0.8 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "400px",
        height: "300px",
        backgroundColor: "#0a0a0a",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      },
    }),
    draft("Stream Left", {
      durationMs: 3000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateX: 0, translateY: 0, opacity: 0.3, scale: 0.8 }),
        kf(0.5, { translateX: 120, translateY: -40, opacity: 1, scale: 1.2 }),
        kf(1, { translateX: 200, translateY: 20, opacity: 0.4, scale: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 0 12px #ffffff, 0 0 24px rgba(255,255,255,0.4)",
        position: "absolute",
        left: "20px",
        top: "150px",
      },
    }),
    draft("Stream Center", {
      durationMs: 3500,
      delayMs: 500,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateX: 0, translateY: 0, opacity: 0.2, scale: 0.6 }),
        kf(0.3, { translateX: 60, translateY: -80, opacity: 0.9, scale: 1.3 }),
        kf(0.6, { translateX: 150, translateY: -20, opacity: 1, scale: 1.1 }),
        kf(1, { translateX: 250, translateY: 60, opacity: 0.3, scale: 0.7 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: "#e0e0e0",
        boxShadow: "0 0 16px #e0e0e0, 0 0 32px rgba(224,224,224,0.3)",
        position: "absolute",
        left: "40px",
        top: "180px",
      },
    }),
    draft("Stream Right", {
      durationMs: 2800,
      delayMs: 1000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateX: 0, translateY: 0, opacity: 0.4, scale: 0.9 }),
        kf(0.5, { translateX: -80, translateY: -60, opacity: 1, scale: 1.4 }),
        kf(1, { translateX: -160, translateY: 30, opacity: 0.2, scale: 0.8 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "5px",
        height: "5px",
        borderRadius: "50%",
        backgroundColor: "#c0c0c0",
        boxShadow: "0 0 10px #c0c0c0, 0 0 20px rgba(192,192,192,0.3)",
        position: "absolute",
        right: "40px",
        top: "120px",
      },
    }),
    draft("Core Pulse", {
      durationMs: 2000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 0.6, opacity: 0.5 }),
        kf(0.5, { scale: 1.5, opacity: 0.9 }),
        kf(1, { scale: 0.8, opacity: 0.4 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        backgroundColor: "transparent",
        border: "2px solid #ffffff",
        boxShadow: "0 0 30px rgba(255,255,255,0.5), inset 0 0 20px rgba(255,255,255,0.2)",
        position: "absolute",
        left: "180px",
        top: "130px",
      },
    }),
  ],
};
