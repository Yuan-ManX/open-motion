import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Aurora Borealis — atmospheric light curtains that flow and shift like the
 * northern lights. Multiple translucent layers with gradient backgrounds
 * undulate at different speeds and phases, creating the impression of
 * charged solar particles interacting with the atmosphere. Original
 * composition exploring layered transparency and flowing color fields.
 */
export const auroraBorealisTemplate: TemplateDef = {
  id: "tpl-aurora-borealis",
  name: "Aurora Borealis",
  category: "emphasis",
  description:
    "Atmospheric light curtains with flowing gradients, layered transparency, and organic undulation — models the aurora borealis through multiple phase-shifted translucent layers.",
  tags: ["aurora", "borealis", "northern lights", "atmospheric", "flow", "gradient", "emphasis", "nature"],
  build: () => [
    draft("Night Sky", {
      durationMs: 8000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 1 }),
        kf(0.5, { opacity: 0.95 }),
        kf(1, { opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "420px",
        height: "260px",
        backgroundColor: "#020210",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      },
    }),
    draft("Aurora Curtain Green", {
      durationMs: 6000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.5, translateX: -40, skewX: -10, scale: 1 }),
        kf(0.5, { opacity: 0.8, translateX: 20, skewX: 5, scale: 1.1 }),
        kf(1, { opacity: 0.6, translateX: 40, skewX: 10, scale: 0.95 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "380px",
        height: "200px",
        background: "linear-gradient(180deg, transparent 0%, rgba(0,255,136,0.6) 30%, rgba(0,200,255,0.4) 60%, transparent 100%)",
        borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
        position: "absolute",
        top: "20px",
        left: "20px",
        filter: "blur(8px)",
      },
    }),
    draft("Aurora Curtain Teal", {
      durationMs: 7000,
      delayMs: 500,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.4, translateX: 30, skewX: 8, scale: 0.95 }),
        kf(0.5, { opacity: 0.7, translateX: -20, skewX: -5, scale: 1.05 }),
        kf(1, { opacity: 0.5, translateX: -30, skewX: -8, scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "340px",
        height: "180px",
        background: "linear-gradient(180deg, transparent 0%, rgba(0,229,200,0.5) 40%, rgba(100,255,200,0.3) 70%, transparent 100%)",
        borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
        position: "absolute",
        top: "30px",
        left: "40px",
        filter: "blur(12px)",
      },
    }),
    draft("Aurora Curtain Violet", {
      durationMs: 5000,
      delayMs: 1000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.3, translateX: -20, skewX: -5, scale: 1 }),
        kf(0.5, { opacity: 0.6, translateX: 30, skewX: 10, scale: 1.1 }),
        kf(1, { opacity: 0.4, translateX: 20, skewX: 5, scale: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "300px",
        height: "160px",
        background: "linear-gradient(180deg, transparent 0%, rgba(150,100,255,0.4) 35%, rgba(200,150,255,0.2) 65%, transparent 100%)",
        borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
        position: "absolute",
        top: "40px",
        left: "60px",
        filter: "blur(16px)",
      },
    }),
    draft("Star Field", {
      durationMs: 4000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.6 }),
        kf(0.5, { opacity: 1 }),
        kf(1, { opacity: 0.7 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "420px",
        height: "260px",
        background: "radial-gradient(2px 2px at 20px 30px, #fff, transparent), radial-gradient(2px 2px at 60px 70px, #fff, transparent), radial-gradient(1px 1px at 90px 40px, #fff, transparent), radial-gradient(2px 2px at 130px 80px, #fff, transparent), radial-gradient(1px 1px at 160px 30px, #fff, transparent), radial-gradient(2px 2px at 200px 90px, #fff, transparent), radial-gradient(1px 1px at 240px 50px, #fff, transparent), radial-gradient(2px 2px at 280px 70px, #fff, transparent), radial-gradient(1px 1px at 320px 20px, #fff, transparent), radial-gradient(2px 2px at 360px 60px, #fff, transparent), radial-gradient(1px 1px at 400px 90px, #fff, transparent)",
        position: "absolute",
        top: "0",
        left: "0",
      },
    }),
    draft("Horizon Glow", {
      durationMs: 8000,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.4, scaleY: 0.8 }),
        kf(0.5, { opacity: 0.7, scaleY: 1.2 }),
        kf(1, { opacity: 0.5, scaleY: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "420px",
        height: "60px",
        background: "linear-gradient(180deg, transparent 0%, rgba(0,255,136,0.2) 50%, rgba(0,200,255,0.3) 100%)",
        position: "absolute",
        bottom: "0",
        left: "0",
        filter: "blur(20px)",
        transformOrigin: "bottom",
      },
    }),
  ],
};
