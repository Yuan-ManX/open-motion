import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Success checkmark — a circular badge that pops in with a spring-like scale,
 * followed by a checkmark stroke that draws itself via clipPath reveal.
 * Used for confirmation states, form completion, and achievement unlocks.
 */
export const successCheckmarkTemplate: TemplateDef = {
  id: "tpl-success-checkmark",
  name: "Success Checkmark",
  category: "emphasis",
  description: "A confirmation badge with a self-drawing checkmark stroke for success states.",
  tags: ["success", "checkmark", "confirm", "badge", "emphasis"],
  build: () => [
    draft("Success Badge", {
      durationMs: 600,
      easing: easingPreset("back"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { scale: 0, opacity: "0" }),
        kf(0.6, { scale: 1.15, opacity: "1" }),
        kf(1, { scale: 1 }),
      ],
      style: {
        _content: "",
        width: 72,
        height: 72,
        borderRadius: "50%",
        backgroundColor: "#22c55e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 12px 32px rgba(34,197,94,0.35)",
      },
    }),
    draft("Checkmark Stroke", {
      durationMs: 450,
      delayMs: 250,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { clipPath: "inset(0 100% 0 0)" }),
        kf(1, { clipPath: "inset(0 0 0 0)" }),
      ],
      style: {
        _content: "\u2713",
        fontSize: 40,
        fontWeight: 800,
        color: "#ffffff",
        lineHeight: 1,
        width: 72,
        height: 72,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    }),
  ],
};
