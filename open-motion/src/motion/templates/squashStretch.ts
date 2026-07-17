import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const squashStretchTemplate: TemplateDef = {
  id: "tpl-squash-stretch",
  name: "Squash & Stretch",
  category: "emphasis",
  description: "A classic animation principle: squash on impact, stretch on release.",
  tags: ["scale", "squash", "emphasis"],
  build: () => [
    draft("Ball", {
      durationMs: 1000,
      iterationCount: "infinite",
      direction: "alternate",
      easing: easingPreset("ease-in-out-cubic"),
      keyframes: [
        kf(0, { translateY: -80, scaleX: 0.8, scaleY: 1.2 }),
        kf(0.5, { translateY: 0, scaleX: 1.3, scaleY: 0.7 }),
        kf(1, { translateY: -80, scaleX: 0.8, scaleY: 1.2 }),
      ],
      style: {
        width: 70,
        height: 70,
        borderRadius: "50%",
        backgroundColor: "#f59e0b",
      },
    }),
  ],
};
