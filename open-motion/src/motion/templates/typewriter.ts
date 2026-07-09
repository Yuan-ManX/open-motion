import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const typewriterTemplate: TemplateDef = {
  id: "tpl-typewriter",
  name: "Typewriter",
  category: "entrance",
  description: "Text reveals character by character via width animation.",
  tags: ["width", "text", "entrance"],
  build: () => [
    draft("Typewriter Text", {
      durationMs: 1500,
      easing: easingPreset("linear"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { width: "0%" }),
        kf(1, { width: "100%" }),
      ],
      style: {
        _content: "Typewriter effect",
        fontSize: 32,
        fontWeight: 600,
        color: "#f4f6fb",
        overflow: "hidden",
        whiteSpace: "nowrap",
        fontFamily: "monospace",
      },
    }),
  ],
};
