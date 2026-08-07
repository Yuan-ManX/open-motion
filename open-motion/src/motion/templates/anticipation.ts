import { easingSpring, easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Anticipation — the classic animation principle of a forward recoil before
 * the main jump. The surface draws back slightly, then springs into place with
 * a weighted overshoot, so the primary motion reads as grounded and deliberate
 * rather than abruptly appearing. Ideal for buttons, chips and list items.
 */
export const anticipationTemplate: TemplateDef = {
  id: "tpl-anticipation",
  name: "Anticipation",
  category: "entrance",
  description: "A deliberate recoil before a springy jump-in — the anticipation principle that makes entrances feel weighted and intentional.",
  tags: ["anticipation", "recoil", "spring", "entrance", "weighted", "micro"],
  build: () => [
    draft("Anticipated Chip", {
      durationMs: 850,
      easing: easingSpring(160, 14, 1),
      keyframes: [
        kf(0, { scale: 1, translateY: "0%", opacity: 0 }),
        kf(0.28, { scale: 0.86, translateY: "0%", opacity: 1 }),
        kf(0.5, { scale: 1.12, translateY: "-12%", opacity: 1 }),
        kf(0.72, { scale: 0.97, translateY: "0%", opacity: 1 }),
        kf(1, { scale: 1, translateY: "0%", opacity: 1 }),
      ],
      style: {
        _content: "Go",
        width: 120,
        height: 120,
        borderRadius: "50%",
        backgroundColor: "#8b5cf6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        fontWeight: 700,
        color: "#ffffff",
        boxShadow: "0 12px 34px rgba(139,92,246,0.4)",
      },
    }),
  ],
};