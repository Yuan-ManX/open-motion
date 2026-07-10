import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const textScrambleTemplate: TemplateDef = {
  id: "tpl-text-scramble",
  name: "Text Scramble",
  category: "entrance",
  description: "Text that unscrambles from random characters to the final word — a cinematic, decoder-style reveal.",
  tags: ["text", "scramble", "decode", "width", "opacity", "entrance"],
  build: () => [
    draft("Scrambling Text", {
      durationMs: 1800,
      easing: easingPreset("linear"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0.3, letterSpacing: "8px" }),
        kf(0.2, { opacity: 0.5, letterSpacing: "6px" }),
        kf(0.4, { opacity: 0.7, letterSpacing: "4px" }),
        kf(0.6, { opacity: 0.85, letterSpacing: "2px" }),
        kf(0.8, { opacity: 1, letterSpacing: "1px" }),
        kf(1, { opacity: 1, letterSpacing: "0px" }),
      ],
      style: {
        _content: "DECODE",
        _tag: "div",
        width: "300px",
        height: "50px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontSize: "28px",
        fontFamily: "monospace",
        fontWeight: "bold",
        textTransform: "uppercase",
      },
    }),
  ],
};
