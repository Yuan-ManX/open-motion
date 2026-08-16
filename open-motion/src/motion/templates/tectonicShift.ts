import type { Keyframe } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Tectonic Shift — a slow, powerful transition where the element
 * fractures and shifts along fault lines before reassembling in a
 * new position. Conveys weight, gravity, and geological force.
 */
export const tectonicShiftTemplate: TemplateDef = {
  id: "tpl-tectonic-shift",
  name: "Tectonic Shift",
  category: "transition",
  description:
    "Fractures and shifts along fault lines before reassembling — conveys geological weight and force.",
  tags: ["transition", "fracture", "shift", "weight", "geological", "power"],
  build: () => {
    const keyframes: Keyframe[] = [
      kf(0, {
        opacity: 1,
        translateX: 0,
        skewX: 0,
        scaleY: 1,
      }),
      kf(0.15, {
        opacity: 0.95,
        translateX: -3,
        skewX: 1,
        scaleY: 1.01,
      }),
      kf(0.3, {
        opacity: 0.7,
        translateX: 8,
        skewX: -2,
        scaleY: 0.98,
      }),
      kf(0.45, {
        opacity: 0.5,
        translateX: -12,
        skewX: 3,
        scaleY: 1.02,
      }),
      kf(0.6, {
        opacity: 0.4,
        translateX: 16,
        skewX: -1,
        scaleY: 0.99,
      }),
      kf(0.8, {
        opacity: 0.8,
        translateX: -4,
        skewX: 0.5,
        scaleY: 1,
      }),
      kf(1, {
        opacity: 1,
        translateX: 0,
        skewX: 0,
        scaleY: 1,
      }),
    ];

    return [
      draft("Tectonic Shift", {
        durationMs: 1600,
        easing: easingPreset("ease-in-out"),
        iterationCount: 1,
        keyframes,
        trigger: "onLoad",
        style: {
          _content: "",
          _tag: "div",
          width: "300px",
          height: "200px",
          backgroundColor: "#1a1a1a",
          borderRadius: "4px",
          boxShadow: "0 8px 40px rgba(0, 0, 0, 0.6)",
          border: "1px solid rgba(120, 120, 120, 0.2)",
        },
      }),
    ];
  },
};
