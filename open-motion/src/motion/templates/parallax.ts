import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const parallaxTemplate: TemplateDef = {
  id: "tpl-parallax",
  name: "Parallax Layers",
  category: "emphasis",
  description: "Three layers moving at different speeds — creates depth and dimensionality on scroll or hover.",
  tags: ["parallax", "scroll", "depth", "layers", "translateY"],
  build: () => [
    draft("Parallax Background", {
      durationMs: 1200,
      delayMs: 0,
      easing: easingPreset("smooth"),
      iterationCount: 1,
      keyframes: [
        kf(0, { translateY: "0px" }),
        kf(1, { translateY: "-20px" }),
      ],
      style: {
        width: "320px",
        height: "180px",
        borderRadius: "8px",
        backgroundColor: "#161616",
      },
    }),
    draft("Parallax Midground", {
      durationMs: 1200,
      delayMs: 0,
      easing: easingPreset("smooth"),
      iterationCount: 1,
      keyframes: [
        kf(0, { translateY: "0px" }),
        kf(1, { translateY: "-40px" }),
      ],
      style: {
        width: "240px",
        height: "140px",
        borderRadius: "8px",
        backgroundColor: "#262626",
      },
    }),
    draft("Parallax Foreground", {
      durationMs: 1200,
      delayMs: 0,
      easing: easingPreset("smooth"),
      iterationCount: 1,
      keyframes: [
        kf(0, { translateY: "0px" }),
        kf(1, { translateY: "-60px" }),
      ],
      style: {
        width: "160px",
        height: "100px",
        borderRadius: "8px",
        backgroundColor: "#ffffff",
      },
    }),
  ],
};
