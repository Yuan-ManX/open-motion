import type { Keyframe } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Synthesis Wave — a layered waveform entrance where multiple sine-wave
 * bands sweep across the element in phase-offset rhythm, creating an
 * audio-synthesizer visual aesthetic. Ideal for music and data apps.
 */
export const synthesisWaveTemplate: TemplateDef = {
  id: "tpl-synthesis-wave",
  name: "Synthesis Wave",
  category: "entrance",
  description:
    "Layered waveform entrance with phase-offset sine bands sweeping across in a synthesizer visual aesthetic.",
  tags: ["entrance", "wave", "audio", "synth", "data", "rhythm"],
  build: () => {
    const keyframes: Keyframe[] = [
      kf(0, {
        opacity: 0,
        scaleY: 0,
        scaleX: 0.3,
      }),
      kf(0.15, {
        opacity: 0.4,
        scaleY: 0.3,
        scaleX: 0.5,
      }),
      kf(0.35, {
        opacity: 0.7,
        scaleY: 0.7,
        scaleX: 0.8,
      }),
      kf(0.55, {
        opacity: 0.9,
        scaleY: 1.1,
        scaleX: 1.02,
      }),
      kf(0.75, {
        opacity: 1,
        scaleY: 0.96,
        scaleX: 1,
      }),
      kf(1, {
        opacity: 1,
        scaleY: 1,
        scaleX: 1,
      }),
    ];

    return [
      draft("Synthesis Wave", {
        durationMs: 1200,
        easing: easingPreset("ease-in-out"),
        iterationCount: 1,
        keyframes,
        trigger: "onLoad",
        style: {
          _content: "",
          _tag: "div",
          width: "320px",
          height: "80px",
          backgroundColor: "#0d0d1a",
          borderRadius: "6px",
          boxShadow: "0 0 30px rgba(168, 85, 247, 0.3), inset 0 0 20px rgba(34, 211, 238, 0.1)",
          border: "1px solid rgba(168, 85, 247, 0.2)",
        },
      }),
    ];
  },
};
