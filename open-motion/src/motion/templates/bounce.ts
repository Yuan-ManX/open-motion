import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const bounceTemplate: TemplateDef = {
  id: "tpl-bounce-in",
  name: "Bounce In",
  category: "entrance",
  description: "Drops in with a springy overshoot — playful and energetic.",
  tags: ["bounce", "spring", "entrance"],
  build: () => [
    draft("Badge", {
      durationMs: 900,
      easing: easingPreset("bounce"),
      keyframes: [
        kf(0, { translateY: -120, opacity: 0 }),
        kf(0.6, { translateY: 12, opacity: 1 }),
        kf(1, { translateY: 0 }),
      ],
      style: {
        _content: "Bounce",
        _tag: "button",
        padding: "12px 24px",
        borderRadius: 999,
        backgroundColor: "#6366f1",
        color: "#ffffff",
        fontSize: 18,
        fontWeight: 600,
      },
    }),
  ],
};
