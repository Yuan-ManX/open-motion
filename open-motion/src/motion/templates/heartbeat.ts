import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Cardiac pulse — two rapid squeeze-and-release thumps followed by a longer
// diastolic rest. The timing mimics a real "lub-dub" cardiac cycle, producing
// a biomimetic heartbeat feel that reads as urgency, vitality, or life
// depending on the surrounding context.
export const heartbeatTemplate: TemplateDef = {
  id: "tpl-heartbeat",
  name: "Heartbeat",
  category: "emphasis",
  description: "Biomimetic cardiac pulse — a double lub-dub squeeze with diastolic rest, evoking vitality, urgency, or life.",
  tags: ["heartbeat", "pulse", "cardiac", "bump", "thump", "biometric", "life", "vital", "urgency"],
  build: () => [
    draft("Heart Core", {
      durationMs: 1200,
      easing: easingPreset("snappy"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { scale: 1 }),
        kf(0.05, { scale: 0.88 }),
        kf(0.12, { scale: 1.14 }),
        kf(0.18, { scale: 1 }),
        kf(0.22, { scale: 0.92 }),
        kf(0.28, { scale: 1.08 }),
        kf(0.34, { scale: 1 }),
        kf(1, { scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "120px",
        borderRadius: "32px",
        background: "radial-gradient(circle at 30% 30%, #FF6B6B 0%, #E53E3E 55%, #9B2C2C 100%)",
        boxShadow: "0 8px 30px rgba(229,62,62,0.45), inset 0 2px 10px rgba(255,255,255,0.2)",
      },
    }),
    draft("Halo Ring", {
      durationMs: 1200,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scale: 1 }),
        kf(0.12, { opacity: 0.6, scale: 1.22 }),
        kf(0.34, { opacity: 0, scale: 1.5 }),
        kf(1, { opacity: 0, scale: 1.5 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "120px",
        borderRadius: "32px",
        border: "3px solid #FC8181",
      },
    }),
  ],
};
