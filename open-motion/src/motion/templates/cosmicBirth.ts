import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Cosmic Birth — a multi-stage cosmological animation that mirrors the expansion
 * of a universe from a singularity. A central point condenses, ignites, and
 * radiates outward through layered shockwaves, leaving a residual field of
 * stellar particles. Original composition that pairs a singular origin frame
 * with staggered radial propagation.
 */
export const cosmicBirthTemplate: TemplateDef = {
  id: "tpl-cosmic-birth",
  name: "Cosmic Birth",
  category: "entrance",
  description:
    "Singularity condensation, ignition flash, and radial shockwave expansion with residual stellar particles — models cosmological emergence in five layered stages.",
  tags: ["cosmic", "birth", "expansion", "shockwave", "stellar", "entrance", "abstract", "origin"],
  build: () => [
    draft("Cosmic Stage", {
      durationMs: 3600,
      easing: easingPreset("linear"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0 }),
        kf(0.1, { opacity: 1 }),
        kf(0.9, { opacity: 1 }),
        kf(1, { opacity: 0.85 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "420px",
        height: "300px",
        backgroundColor: "#050507",
        borderRadius: "16px",
        overflow: "hidden",
        position: "relative",
      },
    }),
    draft("Singularity Core", {
      durationMs: 1200,
      delayMs: 0,
      easing: easingPreset("ease-in"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scale: 0 }),
        kf(0.4, { opacity: 1, scale: 0.6 }),
        kf(0.8, { opacity: 1, scale: 1 }),
        kf(1, { opacity: 0.95, scale: 1.2 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow:
          "0 0 16px 4px rgba(255,255,255,0.9), 0 0 32px 8px rgba(200,220,255,0.7), 0 0 64px 16px rgba(150,180,255,0.4)",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
    draft("Ignition Flash", {
      durationMs: 600,
      delayMs: 1100,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scale: 0.8 }),
        kf(0.3, { opacity: 1, scale: 1.4 }),
        kf(1, { opacity: 0, scale: 2.2 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "60px",
        height: "60px",
        borderRadius: "50%",
        backgroundColor: "rgba(255,255,255,0.95)",
        boxShadow:
          "0 0 40px 12px rgba(255,255,255,0.9), 0 0 80px 24px rgba(220,230,255,0.6)",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        filter: "blur(2px)",
      },
    }),
    draft("Shockwave Ring One", {
      durationMs: 1800,
      delayMs: 1200,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.9, scale: 0.2 }),
        kf(0.5, { opacity: 0.6, scale: 1.5 }),
        kf(1, { opacity: 0, scale: 3 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        border: "2px solid rgba(180,210,255,0.8)",
        boxShadow: "0 0 24px 4px rgba(150,190,255,0.5)",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
    draft("Shockwave Ring Two", {
      durationMs: 2200,
      delayMs: 1500,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.7, scale: 0.3 }),
        kf(0.5, { opacity: 0.4, scale: 2 }),
        kf(1, { opacity: 0, scale: 4 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100px",
        height: "100px",
        borderRadius: "50%",
        border: "1px solid rgba(140,180,255,0.6)",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
    draft("Stellar Field Cluster", {
      durationMs: 2400,
      delayMs: 1800,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scale: 0.4, rotate: "0deg" }),
        kf(0.4, { opacity: 1, scale: 1, rotate: "60deg" }),
        kf(1, { opacity: 0.7, scale: 1.1, rotate: "120deg" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "200px",
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.9) 1px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(200,220,255,0.8) 1px, transparent 2px), radial-gradient(circle at 40% 80%, rgba(255,255,255,0.7) 1px, transparent 2px), radial-gradient(circle at 85% 25%, rgba(180,200,255,0.8) 1px, transparent 2px), radial-gradient(circle at 15% 70%, rgba(255,255,255,0.6) 1px, transparent 2px)",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
  ],
};
