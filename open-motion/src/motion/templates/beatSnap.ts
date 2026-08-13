import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Beat snap — a 120 BPM grid where the element locks to each downbeat with a
// crisp punch and a brief overdamped settle. The 2-second cycle spans a full
// musical bar (4 beats) with accent on beat 1. A natural fit for rhythm UI,
// music players, or any content that benefits from a percussive cadence.
export const beatSnapTemplate: TemplateDef = {
  id: "tpl-beat-snap",
  name: "Beat Snap",
  category: "emphasis",
  description: "120 BPM percussive grid with a snappy downbeat punch and overdamped settle — tuned for rhythmic UIs and music surfaces.",
  tags: ["beat", "rhythm", "bpm", "grid", "snap", "percussive", "music", "tempo", "groove"],
  build: () => [
    draft("Beat Body", {
      durationMs: 2000,
      easing: easingPreset("snappy"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        // Beat 1 (downbeat) — strongest punch
        kf(0, { scale: 1, translateY: 0 }),
        kf(0.015, { scale: 1.14, translateY: -6 }),
        kf(0.04, { scale: 1, translateY: 0 }),
        // Beat 2
        kf(0.25, { scale: 1, translateY: 0 }),
        kf(0.265, { scale: 1.06, translateY: -2 }),
        kf(0.29, { scale: 1, translateY: 0 }),
        // Beat 3 (backbeat emphasis)
        kf(0.5, { scale: 1, translateY: 0 }),
        kf(0.515, { scale: 1.1, translateY: -4 }),
        kf(0.54, { scale: 1, translateY: 0 }),
        // Beat 4
        kf(0.75, { scale: 1, translateY: 0 }),
        kf(0.765, { scale: 1.06, translateY: -2 }),
        kf(0.79, { scale: 1, translateY: 0 }),
        // Bar end
        kf(1, { scale: 1, translateY: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "140px",
        height: "140px",
        borderRadius: "28px",
        background:
          "linear-gradient(145deg, #1A1A1E 0%, #2D2D33 55%, #0E0E12 100%)",
        boxShadow:
          "0 16px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.06)",
      },
    }),
    draft("Downbeat Flash", {
      durationMs: 2000,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.6, scale: 1 }),
        kf(0.05, { opacity: 0, scale: 1.18 }),
        kf(0.5, { opacity: 0.35, scale: 1 }),
        kf(0.55, { opacity: 0, scale: 1.12 }),
        kf(1, { opacity: 0, scale: 1.12 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "140px",
        height: "140px",
        borderRadius: "28px",
        background:
          "radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)",
        pointerEvents: "none",
      },
    }),
  ],
};
