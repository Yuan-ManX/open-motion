import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const reveal3dTemplate: TemplateDef = {
  id: "tpl-reveal-3d",
  name: "3D Reveal",
  category: "entrance",
  description: "A 3D card flip reveal — rotates from edge-on to face-on with depth and scale for a dramatic entrance.",
  tags: ["3d", "flip", "reveal", "rotateY", "scale", "perspective", "entrance"],
  build: () => [
    draft("3D Card", {
      durationMs: 1000,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { rotateY: 90, scale: 0.8, opacity: 0 }),
        kf(0.3, { rotateY: 45, scale: 0.9, opacity: 0.5 }),
        kf(0.6, { rotateY: 15, scale: 0.95, opacity: 0.8 }),
        kf(1, { rotateY: 0, scale: 1, opacity: 1 }),
      ],
      style: {
        _content: "3D",
        _tag: "div",
        width: "160px",
        height: "160px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "12px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #404040",
        color: "#ffffff",
        fontSize: "32px",
        fontWeight: "bold",
        perspective: "600px",
        transformStyle: "preserve-3d",
      },
    }),
  ],
};
