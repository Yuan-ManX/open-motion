import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const progressBarTemplate: TemplateDef = {
  id: "tpl-progress",
  name: "Progress Bar",
  category: "load",
  description: "A progress bar that fills from 0 to 100 percent.",
  tags: ["width", "progress", "load"],
  build: () => [
    draft("Progress Track", {
      durationMs: 0,
      easing: easingPreset("linear"),
      keyframes: [],
      style: {
        _content: "",
        width: "320px",
        height: "8px",
        backgroundColor: "#1e293b",
        borderRadius: "4px",
        overflow: "hidden",
        position: "relative",
      },
    }),
    draft("Progress Fill", {
      durationMs: 2000,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { width: "0%" }),
        kf(1, { width: "100%" }),
      ],
      style: {
        _content: "",
        height: "8px",
        backgroundColor: "#3b82f6",
        borderRadius: "4px",
        position: "absolute",
        top: 0,
        left: 0,
      },
    }),
  ],
};
