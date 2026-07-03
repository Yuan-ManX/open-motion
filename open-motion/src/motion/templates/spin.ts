import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const spinTemplate: TemplateDef = {
  id: "tpl-spin",
  name: "Spin Loader",
  category: "load",
  description: "An infinite rotation — the classic loading indicator.",
  tags: ["rotate", "loop", "load"],
  build: () => [
    draft("Spinner", {
      durationMs: 1000,
      iterationCount: "infinite",
      direction: "normal",
      easing: easingPreset("linear"),
      keyframes: [kf(0, { rotate: 0 }), kf(1, { rotate: 360 })],
      style: {
        width: 56,
        height: 56,
        borderRadius: "50%",
        border: "6px solid rgba(255,255,255,0.15)",
        borderTopColor: "#6366f1",
      },
    }),
  ],
};
