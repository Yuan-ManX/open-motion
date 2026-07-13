import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const gestureTapTemplate: TemplateDef = {
  id: "tpl-gesture-tap",
  name: "Gesture Tap",
  category: "emphasis",
  description: "A tactile press-and-release feedback for touch and click interactions.",
  tags: ["tap", "gesture", "click", "feedback", "scale"],
  build: () => [
    draft("Tap Button", {
      durationMs: 300,
      easing: easingPreset("ease-out"),
      trigger: "onClick",
      keyframes: [
        kf(0, { scale: 1 }),
        kf(0.4, { scale: 0.9 }),
        kf(1, { scale: 1 }),
      ],
      style: {
        _content: "Tap Me",
        width: 140,
        height: 48,
        background: "#f4f6fb",
        borderRadius: 10,
        color: "#0a0a0a",
        fontSize: 16,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      },
    }),
  ],
};
