import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const gestureSwipeTemplate: TemplateDef = {
  id: "tpl-gesture-swipe",
  name: "Gesture Swipe",
  category: "transition",
  description: "A card that slides horizontally and fades — simulating a swipe-to-dismiss gesture.",
  tags: ["swipe", "gesture", "drag", "translateX", "opacity"],
  build: () => [
    draft("Swipe Card", {
      durationMs: 400,
      easing: easingPreset("snappy"),
      trigger: "onClick",
      keyframes: [
        kf(0, { translateX: 0, opacity: 1 }),
        kf(1, { translateX: 120, opacity: 0 }),
      ],
      style: {
        _content: "Swipe →",
        width: 200,
        height: 60,
        background: "#222",
        borderRadius: 12,
        padding: 16,
        color: "#f4f6fb",
        fontSize: 15,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    }),
  ],
};
