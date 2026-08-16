import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Tidal Flow: ocean tide waves flowing in and out in a natural rhythm
export const tidalFlowTemplate: TemplateDef = {
  id: "tpl-tidal-flow",
  name: "Tidal Flow",
  category: "transition",
  description:
    "Ocean tide waves flow in and out in a natural rhythm — an incoming wave rolls forward, a tidal surge swells at the peak, and receding foam pulls back toward the sea.",
  tags: ["transition", "tide", "ocean", "wave", "flow", "natural", "rhythm", "water"],
  build: () => [
    draft("Incoming Wave", {
      durationMs: 2600,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateX: 90, translateY: 24, opacity: 0.35 }),
        kf(0.5, { translateX: 0, translateY: 0, opacity: 0.85 }),
        kf(1, { translateX: -50, translateY: 14, opacity: 0.5 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "220px",
        height: "44px",
        borderRadius: "50%",
        background: "linear-gradient(180deg, rgba(120,180,230,0.55), rgba(40,90,160,0.85))",
        filter: "blur(4px)",
        position: "absolute",
        top: "90px",
        left: "70px",
      },
    }),
    draft("Tidal Surge", {
      durationMs: 3000,
      delayMs: 350,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateY: 36, scaleY: 0.7, opacity: 0.3 }),
        kf(0.5, { translateY: -12, scaleY: 1.15, opacity: 0.75 }),
        kf(1, { translateY: 22, scaleY: 0.8, opacity: 0.4 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "260px",
        height: "70px",
        borderRadius: "50%",
        background: "linear-gradient(180deg, rgba(80,140,210,0.6), rgba(20,60,130,0.9))",
        filter: "blur(8px)",
        position: "absolute",
        top: "70px",
        left: "50px",
      },
    }),
    draft("Receding Foam", {
      durationMs: 2200,
      delayMs: 700,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateX: -40, opacity: 0 }),
        kf(0.35, { translateX: 0, opacity: 0.9 }),
        kf(0.7, { translateX: 30, opacity: 0.55 }),
        kf(1, { translateX: 60, opacity: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "14px",
        borderRadius: "50%",
        background: "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(220,235,250,0.35))",
        filter: "blur(3px)",
        position: "absolute",
        top: "128px",
        left: "80px",
      },
    }),
  ],
};
