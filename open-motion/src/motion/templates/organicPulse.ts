import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Organic pulse: biologically-inspired heartbeat with breathing rhythm
export const organicPulseTemplate: TemplateDef = {
  id: "tpl-organic-pulse",
  name: "Organic Pulse",
  category: "emphasis",
  description: "A biologically-inspired pulsing rhythm with authentic heartbeat cadence — a living, breathing emphasis that feels naturally organic.",
  tags: ["emphasis", "organic", "pulse", "heartbeat", "breathing", "biological", "living", "rhythm"],
  build: () => [
    // Primary heartbeat pulse (lub-dub pattern)
    draft("Heartbeat Primary", {
      durationMs: 1000,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { scale: 1, opacity: 0.9 }),
        kf(0.1, { scale: 1.15, opacity: 1 }),
        kf(0.2, { scale: 1.05, opacity: 0.95 }),
        kf(0.35, { scale: 1.2, opacity: 1 }),
        kf(0.5, { scale: 1, opacity: 0.9 }),
        kf(1, { scale: 1, opacity: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "120px",
        background: "radial-gradient(circle, rgba(16,185,129,0.9) 0%, rgba(5,150,105,0.7) 40%, rgba(6,78,59,0.5) 70%, transparent 100%)",
        borderRadius: "50%",
        boxShadow: "0 0 40px rgba(16,185,129,0.6), 0 0 80px rgba(16,185,129,0.3)",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
    // Secondary breathing ring
    draft("Breathing Ring", {
      durationMs: 4000,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 1, opacity: 0.3 }),
        kf(0.5, { scale: 1.3, opacity: 0.6 }),
        kf(1, { scale: 1, opacity: 0.3 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "150px",
        height: "150px",
        border: "3px solid rgba(16,185,129,0.6)",
        borderRadius: "50%",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
    // Tertiary aura
    draft("Bio Aura", {
      durationMs: 3000,
      delayMs: 500,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 0.95, opacity: 0.2 }),
        kf(0.5, { scale: 1.1, opacity: 0.4 }),
        kf(1, { scale: 0.95, opacity: 0.2 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "200px",
        background: "radial-gradient(circle, transparent 40%, rgba(16,185,129,0.15) 60%, transparent 80%)",
        borderRadius: "50%",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      },
    }),
  ],
};