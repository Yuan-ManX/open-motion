import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const breathingLightTemplate: TemplateDef = {
  id: "tpl-breathing-light",
  name: "Breathing Light",
  category: "load",
  description: "Organic breathing light with color temperature shift — warm to cool glow that expands and contracts like a living organism.",
  tags: ["breathing", "light", "organic", "ambient", "glow", "warm", "cool", "alive"],
  build: () => [
    draft("Breathing Orb", {
      durationMs: 4000,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 0.85, opacity: 0.6 }),
        kf(0.5, { scale: 1.1, opacity: 1 }),
        kf(1, { scale: 0.85, opacity: 0.6 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "160px",
        height: "160px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,220,180,0.9) 0%, rgba(255,180,120,0.4) 40%, transparent 70%)",
        filter: "blur(4px)",
      },
    }),
    draft("Inner Core", {
      durationMs: 4000,
      delayMs: 200,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 0.7, opacity: 0.5 }),
        kf(0.5, { scale: 1, opacity: 0.9 }),
        kf(1, { scale: 0.7, opacity: 0.5 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(200,230,255,0.8) 0%, rgba(150,200,255,0.3) 50%, transparent 80%)",
        position: "absolute",
        top: "40px",
        left: "40px",
      },
    }),
    draft("Outer Aura", {
      durationMs: 5000,
      delayMs: 400,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 1, opacity: 0.15 }),
        kf(0.5, { scale: 1.3, opacity: 0.3 }),
        kf(1, { scale: 1, opacity: 0.15 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "220px",
        height: "220px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(180,200,255,0.2) 0%, transparent 60%)",
        filter: "blur(12px)",
        position: "absolute",
        top: "-30px",
        left: "-30px",
      },
    }),
  ],
};
