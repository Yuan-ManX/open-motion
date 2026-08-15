import type { Keyframe } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Bio-Luminescence — an organic emergence where the element glows
 * into existence like a deep-sea creature, with pulsing bioluminescent
 * waves and a soft organic scale. Creates a mesmerizing, alive feeling.
 */
export const bioLuminescenceTemplate: TemplateDef = {
  id: "tpl-bio-luminescence",
  name: "Bio-Luminescence",
  category: "entrance",
  description:
    "Organic emergence with pulsing bioluminescent waves — glows into existence like deep-sea life.",
  tags: ["entrance", "organic", "glow", "pulse", "bio", "nature", "alive"],
  build: () => {
    const keyframes: Keyframe[] = [
      kf(0, {
        opacity: 0,
        scale: 0.4,
        blur: 20,
      }),
      kf(0.15, {
        opacity: 0.2,
        scale: 0.5,
        blur: 16,
      }),
      kf(0.3, {
        opacity: 0.4,
        scale: 0.65,
        blur: 10,
      }),
      kf(0.45, {
        opacity: 0.6,
        scale: 0.8,
        blur: 6,
      }),
      kf(0.6, {
        opacity: 0.85,
        scale: 0.92,
        blur: 2,
      }),
      kf(0.75, {
        opacity: 0.95,
        scale: 1.02,
        blur: 0.5,
      }),
      kf(0.9, {
        opacity: 1,
        scale: 0.99,
        blur: 0,
      }),
      kf(1, {
        opacity: 1,
        scale: 1,
        blur: 0,
      }),
    ];

    return [
      draft("Bio-Luminescence", {
        durationMs: 1800,
        easing: easingPreset("ease-out"),
        iterationCount: 1,
        keyframes,
        trigger: "onLoad",
        style: {
          _content: "",
          _tag: "div",
          width: "260px",
          height: "260px",
          backgroundColor: "#020817",
          borderRadius: "50%",
          boxShadow:
            "0 0 80px rgba(34, 197, 94, 0.4), 0 0 40px rgba(20, 184, 166, 0.3), inset 0 0 60px rgba(34, 197, 94, 0.15)",
          border: "1px solid rgba(34, 197, 94, 0.2)",
        },
      }),
    ];
  },
};
