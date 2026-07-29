import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Spectrum Wave — a flowing wave that cycles through the full color
 * spectrum. A gradient layer shifts hues continuously while a wave
 * overlay undulates across the surface in a synchronized loop.
 */
export const spectrumWaveTemplate: TemplateDef = {
  id: "tpl-spectrum-wave",
  name: "Spectrum Wave",
  category: "emphasis",
  description:
    "Flowing wave that cycles through the full color spectrum with a continuously shifting gradient layer and an undulating wave overlay — a vibrant looping effect.",
  tags: ["spectrum", "rainbow", "color", "wave", "gradient", "loop", "vibrant"],
  build: () => [
    draft("Spectrum Stage", {
      durationMs: 5000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 1 }),
        kf(1, { opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "360px",
        height: "200px",
        backgroundColor: "#0a0a0a",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      },
    }),
    draft("Spectrum Gradient Layer", {
      durationMs: 5000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { translateX: "-50%", scaleY: 1 }),
        kf(0.25, { translateX: "-37.5%", scaleY: 1.04 }),
        kf(0.5, { translateX: "-25%", scaleY: 1 }),
        kf(0.75, { translateX: "-37.5%", scaleY: 0.96 }),
        kf(1, { translateX: "-50%", scaleY: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200%",
        height: "100%",
        background:
          "linear-gradient(90deg, #ff0040, #ff8c00, #ffe000, #00e676, #00b0ff, #304ffe, #aa00ff, #ff0040)",
        position: "absolute",
        top: "0",
        left: "0",
        filter: "saturate(1.1)",
      },
    }),
    draft("Wave Overlay", {
      durationMs: 4000,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateY: "0%", skewX: 0, opacity: 0.5 }),
        kf(0.5, { translateY: "-8%", skewX: -6, opacity: 0.7 }),
        kf(1, { translateY: "6%", skewX: 6, opacity: 0.5 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120%",
        height: "60%",
        background:
          "linear-gradient(180deg, transparent, rgba(10,10,10,0.65), rgba(10,10,10,0.9))",
        position: "absolute",
        bottom: "-10%",
        left: "-10%",
        borderRadius: "50% 50% 0 0 / 30% 30% 0 0",
      },
    }),
  ],
};
