import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Neon Pulse — a rhythmic neon glow pulse with layered expanding rings
 * and a bright pulsing core. Creates a vibrant cyberpunk-style beacon
 * effect with color-shifting glow.
 */
export const neonPulseTemplate: TemplateDef = {
  id: "tpl-neon-pulse",
  name: "Neon Pulse",
  category: "emphasis",
  description:
    "Rhythmic neon glow pulse with expanding rings and a bright pulsing core — cyberpunk-style beacon with color-shifting glow and infinite loop.",
  tags: ["neon", "pulse", "glow", "cyberpunk", "beacon", "ring", "loop", "vibrant"],
  build: () => [
    draft("Neon Core", {
      durationMs: 1600,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 0.85, opacity: 0.7 }),
        kf(0.5, { scale: 1.1, opacity: 1 }),
        kf(1, { scale: 0.9, opacity: 0.8 }),
      ],
      style: {
        _content: "NEON",
        _tag: "div",
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        backgroundColor: "#0a0a0a",
        border: "2px solid #00ffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "16px",
        fontWeight: "bold",
        color: "#00ffff",
        textShadow: "0 0 10px #00ffff, 0 0 20px #00ffff",
        boxShadow: "0 0 20px #00ffff, 0 0 40px rgba(0,255,255,0.5), inset 0 0 20px rgba(0,255,255,0.2)",
        position: "relative",
      },
    }),
    draft("Ring 1", {
      durationMs: 2000,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { scale: 0.8, opacity: 0.8 }),
        kf(1, { scale: 2.5, opacity: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        border: "2px solid #00ffff",
        position: "absolute",
        top: "0",
        left: "0",
      },
    }),
    draft("Ring 2", {
      durationMs: 2000,
      delayMs: 600,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { scale: 0.8, opacity: 0.6 }),
        kf(1, { scale: 2.5, opacity: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        border: "2px solid #ff00ff",
        position: "absolute",
        top: "0",
        left: "0",
      },
    }),
    draft("Ring 3", {
      durationMs: 2000,
      delayMs: 1200,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { scale: 0.8, opacity: 0.5 }),
        kf(1, { scale: 2.5, opacity: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        border: "2px solid #ffff00",
        position: "absolute",
        top: "0",
        left: "0",
      },
    }),
  ],
};
