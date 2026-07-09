import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const marqueeTemplate: TemplateDef = {
  id: "tpl-marquee",
  name: "Marquee",
  category: "emphasis",
  description: "Horizontally scrolling text — the classic news ticker and announcement banner pattern.",
  tags: ["marquee", "scroll", "translateX", "text", "ticker"],
  build: () => [
    draft("Marquee Text", {
      durationMs: 8000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { translateX: "100%" }),
        kf(1, { translateX: "-100%" }),
      ],
      style: {
        _content: "Breaking news — OpenMotion ships AI-native motion design",
        _tag: "span",
        width: "auto",
        height: "24px",
        fontSize: "14px",
        color: "#e2e8f0",
        whiteSpace: "nowrap",
        padding: "0 8px",
      },
    }),
  ],
};
