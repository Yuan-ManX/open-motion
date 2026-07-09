import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const waveTemplate: TemplateDef = {
  id: "tpl-wave",
  name: "Wave",
  category: "emphasis",
  description: "A smooth sine-wave oscillation — ideal for equalizer bars, breathing indicators, and fluid UI accents.",
  tags: ["wave", "sine", "oscillate", "translateY", "loop", "smooth"],
  build: () => [
    draft("Wave Bar", {
      durationMs: 1500,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateY: "0px", scaleY: 1 }),
        kf(0.25, { translateY: "-15px", scaleY: 1.2 }),
        kf(0.5, { translateY: "0px", scaleY: 1 }),
        kf(0.75, { translateY: "15px", scaleY: 0.8 }),
        kf(1, { translateY: "0px", scaleY: 1 }),
      ],
      style: {
        _content: "",
        width: "8px",
        height: "60px",
        borderRadius: "4px",
        backgroundColor: "#22d3ee",
      },
    }),
  ],
};
