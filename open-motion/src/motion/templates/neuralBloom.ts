import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Neural bloom: signals propagate outward like a neural network firing
export const neuralBloomTemplate: TemplateDef = {
  id: "tpl-neural-bloom",
  name: "Neural Bloom",
  category: "entrance",
  description: "Electrical signals propagate outward from a center node like neurons firing — a pulsing, network-like entrance that conveys intelligence and connection.",
  tags: ["entrance", "neural", "bloom", "signal", "network", "pulse", "intelligence", "fire"],
  build: () => [
    // Core neuron firing pulse
    draft("Neural Core", {
      durationMs: 1200,
      delayMs: 0,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { scale: 0.3, opacity: 0.2 }),
        kf(0.2, { scale: 1.2, opacity: 1 }),
        kf(0.5, { scale: 0.8, opacity: 0.6 }),
        kf(0.8, { scale: 1.1, opacity: 0.9 }),
        kf(1, { scale: 0.3, opacity: 0.2 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "80px",
        height: "80px",
        background: "radial-gradient(circle, rgba(99,102,241,1) 0%, rgba(99,102,241,0.6) 40%, transparent 70%)",
        borderRadius: "50%",
        boxShadow: "0 0 30px rgba(99,102,241,0.8), 0 0 60px rgba(139,92,246,0.4)",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
    // Signal ring propagation
    draft("Signal Ring A", {
      durationMs: 1500,
      delayMs: 100,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { scale: 0.5, opacity: 1 }),
        kf(0.6, { scale: 2, opacity: 0.3 }),
        kf(1, { scale: 3, opacity: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100px",
        height: "100px",
        border: "2px solid rgba(99,102,241,0.8)",
        borderRadius: "50%",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
    // Signal ring B with delay
    draft("Signal Ring B", {
      durationMs: 1500,
      delayMs: 400,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { scale: 0.5, opacity: 1 }),
        kf(0.6, { scale: 2, opacity: 0.3 }),
        kf(1, { scale: 3, opacity: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100px",
        height: "100px",
        border: "2px solid rgba(139,92,246,0.8)",
        borderRadius: "50%",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
    // Signal ring C with longer delay
    draft("Signal Ring C", {
      durationMs: 1500,
      delayMs: 700,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { scale: 0.5, opacity: 1 }),
        kf(0.6, { scale: 2, opacity: 0.3 }),
        kf(1, { scale: 3, opacity: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100px",
        height: "100px",
        border: "2px solid rgba(168,85,247,0.8)",
        borderRadius: "50%",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
  ],
};