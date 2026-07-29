import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Photon Stream — a directional photonic flow visualization where luminous
 * packets travel along a constrained channel, modulating intensity and trail
 * length. Three interleaved streams with offset phases create a coherent
 * data-flow narrative. Original composition for connectivity and streaming
 * contexts.
 */
export const photonStreamTemplate: TemplateDef = {
  id: "tpl-photon-stream",
  name: "Photon Stream",
  category: "emphasis",
  description:
    "Directional photonic flow with three interleaved luminous streams, modulating intensity and trail length across a constrained channel — visualizes data movement and connectivity.",
  tags: ["photon", "stream", "data", "flow", "luminous", "channel", "connectivity"],
  build: () => [
    draft("Stream Channel", {
      durationMs: 4000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.9 }),
        kf(0.5, { opacity: 1 }),
        kf(1, { opacity: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "420px",
        height: "120px",
        backgroundColor: "#080808",
        borderRadius: "8px",
        overflow: "hidden",
        position: "relative",
        boxShadow: "inset 0 0 24px rgba(0,0,0,0.8)",
      },
    }),
    draft("Photon Stream Alpha", {
      durationMs: 1800,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, translateX: "-30%", scaleX: 0.6 }),
        kf(0.2, { opacity: 1, translateX: "10%", scaleX: 1 }),
        kf(0.7, { opacity: 0.9, translateX: "60%", scaleX: 1.4 }),
        kf(1, { opacity: 0, translateX: "110%", scaleX: 0.8 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "60px",
        height: "4px",
        borderRadius: "2px",
        backgroundColor: "#ffffff",
        boxShadow:
          "0 0 12px 2px rgba(255,255,255,0.9), 0 0 24px 6px rgba(180,220,255,0.6), -8px 0 16px rgba(150,200,255,0.4)",
        position: "absolute",
        top: "30%",
        left: "0",
      },
    }),
    draft("Photon Stream Beta", {
      durationMs: 2200,
      delayMs: 600,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, translateX: "-30%", scaleX: 0.5 }),
        kf(0.25, { opacity: 0.9, translateX: "15%", scaleX: 1.1 }),
        kf(0.75, { opacity: 0.8, translateX: "65%", scaleX: 1.5 }),
        kf(1, { opacity: 0, translateX: "110%", scaleX: 0.7 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "80px",
        height: "3px",
        borderRadius: "2px",
        backgroundColor: "#e8f0ff",
        boxShadow:
          "0 0 10px 2px rgba(220,235,255,0.9), 0 0 20px 5px rgba(160,200,255,0.5), -10px 0 18px rgba(130,180,255,0.4)",
        position: "absolute",
        top: "55%",
        left: "0",
      },
    }),
    draft("Photon Stream Gamma", {
      durationMs: 1600,
      delayMs: 1200,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, translateX: "-30%", scaleX: 0.7 }),
        kf(0.2, { opacity: 1, translateX: "20%", scaleX: 1 }),
        kf(0.7, { opacity: 0.9, translateX: "70%", scaleX: 1.3 }),
        kf(1, { opacity: 0, translateX: "110%", scaleX: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "50px",
        height: "5px",
        borderRadius: "3px",
        backgroundColor: "#ffffff",
        boxShadow:
          "0 0 14px 3px rgba(255,255,255,1), 0 0 28px 7px rgba(200,220,255,0.7), -6px 0 14px rgba(170,210,255,0.5)",
        position: "absolute",
        top: "75%",
        left: "0",
      },
    }),
    draft("Channel Pulse Gate", {
      durationMs: 3000,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.3, scaleX: 0.8 }),
        kf(0.5, { opacity: 0.6, scaleX: 1 }),
        kf(1, { opacity: 0.3, scaleX: 0.8 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "20px",
        height: "100px",
        backgroundColor: "rgba(150,200,255,0.15)",
        position: "absolute",
        top: "10%",
        right: "0",
        filter: "blur(4px)",
      },
    }),
  ],
};
