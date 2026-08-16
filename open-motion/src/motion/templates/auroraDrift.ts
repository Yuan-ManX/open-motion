import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Aurora drift: soft luminous curtains of light flow across the screen
// like the northern lights, creating an ethereal, calming entrance.
export const auroraDriftTemplate: TemplateDef = {
  id: "tpl-aurora-drift",
  name: "Aurora Drift",
  category: "entrance",
  description: "Soft luminous curtains of light drift across the canvas like the northern lights — an ethereal, calming entrance with organic flow.",
  tags: ["entrance", "aurora", "light", "drift", "ethereal", "organic", "calm", "flow"],
  build: () => [
    // Create 3 curtain layers with different colors, sizes, and delays
    // Layer 1: Green curtain drifting from left
    draft("Aurora Curtain Green", {
      durationMs: 2000,
      delayMs: 0,
      easing: easingPreset("smooth"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, translateX: -300, skewX: -15, scale: 0.8 }),
        kf(0.3, { opacity: 0.6, translateX: -100, skewX: -10, scale: 0.9 }),
        kf(0.7, { opacity: 0.8, translateX: 50, skewX: -5, scale: 1 }),
        kf(1, { opacity: 0.5, translateX: 200, skewX: 0, scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "400px",
        height: "300px",
        background: "linear-gradient(135deg, transparent 0%, rgba(34,197,94,0.3) 30%, rgba(74,222,128,0.5) 50%, rgba(34,197,94,0.3) 70%, transparent 100%)",
        borderRadius: "50%",
        filter: "blur(40px)",
        position: "absolute",
        left: "0",
        top: "50px",
      },
    }),
    // Layer 2: Purple curtain drifting from right with delay
    draft("Aurora Curtain Purple", {
      durationMs: 2200,
      delayMs: 400,
      easing: easingPreset("smooth"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, translateX: 300, skewX: 15, scale: 0.8 }),
        kf(0.3, { opacity: 0.5, translateX: 100, skewX: 10, scale: 0.9 }),
        kf(0.7, { opacity: 0.7, translateX: -50, skewX: 5, scale: 1 }),
        kf(1, { opacity: 0.4, translateX: -200, skewX: 0, scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "450px",
        height: "350px",
        background: "linear-gradient(225deg, transparent 0%, rgba(168,85,247,0.3) 30%, rgba(192,132,252,0.5) 50%, rgba(168,85,247,0.3) 70%, transparent 100%)",
        borderRadius: "50%",
        filter: "blur(45px)",
        position: "absolute",
        right: "0",
        top: "100px",
      },
    }),
    // Layer 3: Teal curtain center reveal
    draft("Aurora Curtain Teal", {
      durationMs: 1800,
      delayMs: 800,
      easing: easingPreset("smooth"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.3, blur: 60 }),
        kf(0.5, { opacity: 0.6, scale: 0.8, blur: 30 }),
        kf(1, { opacity: 0.3, scale: 1.2, blur: 20 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "500px",
        height: "200px",
        background: "linear-gradient(180deg, transparent 0%, rgba(20,184,166,0.4) 40%, rgba(45,212,191,0.5) 50%, rgba(20,184,166,0.4) 60%, transparent 100%)",
        borderRadius: "50%",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
  ],
};
