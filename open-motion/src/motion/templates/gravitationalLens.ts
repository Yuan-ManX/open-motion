import type { Keyframe } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Gravitational Lens — a spacetime-warping entrance where the element
 * appears to emerge from a gravitational distortion field, bending light
 * around it before snapping into focus.
 */
export const gravitationalLensTemplate: TemplateDef = {
  id: "tpl-gravitational-lens",
  name: "Gravitational Lens",
  category: "entrance",
  description:
    "Spacetime-warping entrance — the element emerges from a gravitational distortion field with chromatic separation and scale warping.",
  tags: ["entrance", "warp", "cinematic", "sci-fi", "scale", "blur"],
  build: () => {
    const keyframes: Keyframe[] = [
      kf(0, {
        opacity: 0,
        scale: 0.2,
        rotateX: 45,
        rotateZ: -8,
        blur: 24,
        translateY: 60,
      }),
      kf(0.3, {
        opacity: 0.4,
        scale: 0.6,
        rotateX: 20,
        rotateZ: -3,
        blur: 12,
        translateY: 25,
      }),
      kf(0.6, {
        opacity: 0.8,
        scale: 0.92,
        rotateX: 5,
        rotateZ: 0,
        blur: 3,
        translateY: 5,
      }),
      kf(1, {
        opacity: 1,
        scale: 1,
        rotateX: 0,
        rotateZ: 0,
        blur: 0,
        translateY: 0,
      }),
    ];

    return [
      draft("Gravitational Lens", {
        durationMs: 1400,
        easing: easingPreset("ease-out-cubic"),
        iterationCount: 1,
        keyframes,
        trigger: "onLoad",
        style: {
          _content: "",
          _tag: "div",
          width: "280px",
          height: "180px",
          backgroundColor: "#0a0a14",
          borderRadius: "16px",
          boxShadow: "0 0 60px rgba(99, 102, 241, 0.4), inset 0 0 30px rgba(168, 85, 247, 0.15)",
          border: "1px solid rgba(99, 102, 241, 0.3)",
        },
      }),
    ];
  },
};
