import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const dissolveOutTemplate: TemplateDef = {
  id: "tpl-dissolve-out",
  name: "Dissolve Out",
  category: "exit",
  description: "Dissolves with a progressive blur and opacity fade — a cinematic departure suited for scene transitions.",
  tags: ["dissolve", "blur", "exit", "cinematic", "opacity", "filter"],
  build: () => [
    draft("Dissolving Frame", {
      durationMs: 800,
      easing: easingPreset("smooth"),
      keyframes: [
        kf(0, { opacity: 1, blur: "0px" }),
        kf(0.4, { opacity: 0.8, blur: "2px" }),
        kf(0.7, { opacity: 0.4, blur: "6px" }),
        kf(1, { opacity: 0, blur: "12px" }),
      ],
      style: {
        width: "200px",
        height: "140px",
        borderRadius: "12px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #333333",
      },
    }),
  ],
};
