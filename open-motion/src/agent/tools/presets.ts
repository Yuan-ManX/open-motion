import type { Easing, Keyframe } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";

/** A preset bundles keyframes, easing, duration, and loop into one named animation. */
export interface AnimationPreset {
  keyframes: Keyframe[];
  easing: Easing;
  durationMs: number;
  iterationCount: number | "infinite";
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
}

export const PRESET_NAMES = ["shake", "wiggle", "float", "glow", "heartbeat", "typewriter"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

const kf = (offset: number, properties: Keyframe["properties"]): Keyframe => ({ offset, properties });

export const PRESETS: Record<PresetName, AnimationPreset> = {
  shake: {
    keyframes: [
      kf(0, { translateX: 0 }),
      kf(0.15, { translateX: -8 }),
      kf(0.3, { translateX: 8 }),
      kf(0.45, { translateX: -6 }),
      kf(0.6, { translateX: 6 }),
      kf(0.75, { translateX: -3 }),
      kf(1, { translateX: 0 }),
    ],
    easing: easingPreset("linear"),
    durationMs: 500,
    iterationCount: "infinite",
    direction: "normal",
  },
  wiggle: {
    keyframes: [
      kf(0, { rotate: 0 }),
      kf(0.25, { rotate: -5 }),
      kf(0.75, { rotate: 5 }),
      kf(1, { rotate: 0 }),
    ],
    easing: easingPreset("ease-in-out"),
    durationMs: 1000,
    iterationCount: "infinite",
    direction: "alternate",
  },
  float: {
    keyframes: [
      kf(0, { translateY: 0 }),
      kf(0.5, { translateY: -12 }),
      kf(1, { translateY: 0 }),
    ],
    easing: easingPreset("ease-in-out"),
    durationMs: 2000,
    iterationCount: "infinite",
    direction: "alternate",
  },
  glow: {
    keyframes: [
      kf(0, { opacity: 0.6, boxShadow: "0 0 5px rgba(255,255,255,0.3)" }),
      kf(0.5, { opacity: 1, boxShadow: "0 0 20px rgba(255,255,255,0.8)" }),
      kf(1, { opacity: 0.6, boxShadow: "0 0 5px rgba(255,255,255,0.3)" }),
    ],
    easing: easingPreset("ease-in-out"),
    durationMs: 1500,
    iterationCount: "infinite",
    direction: "alternate",
  },
  heartbeat: {
    keyframes: [
      kf(0, { scale: 1 }),
      kf(0.15, { scale: 1.15 }),
      kf(0.3, { scale: 1 }),
      kf(0.45, { scale: 1.12 }),
      kf(0.6, { scale: 1 }),
      kf(1, { scale: 1 }),
    ],
    easing: easingPreset("ease-in-out"),
    durationMs: 1300,
    iterationCount: "infinite",
    direction: "normal",
  },
  typewriter: {
    keyframes: [
      kf(0, { width: "0%" }),
      kf(1, { width: "100%" }),
    ],
    easing: easingPreset("linear"),
    durationMs: 1500,
    iterationCount: 1,
    direction: "normal",
  },
};

export function getPreset(name: string): AnimationPreset | undefined {
  return PRESETS[name as PresetName];
}
