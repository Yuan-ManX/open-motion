/** Acoustic Wave Template — sound wave visualization with frequency-based motion. */

import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const acousticWaveTemplate: TemplateDef = {
  id: "tpl-acoustic-wave",
  name: "Acoustic Wave",
  category: "emphasis",
  description:
    "Sound wave visualization with frequency-based motion — vertical bars oscillate at phase-shifted intervals to form a living spectrum that breathes, pulses, and ripples like an audio waveform.",
  tags: ["acoustic", "wave", "sound", "frequency", "spectrum", "audio", "bars", "emphasis"],
  build: () => {
    const components = [
      // Background container
      draft("Spectrum Container", {
        durationMs: 4000,
        easing: easingPreset("linear"),
        iterationCount: "infinite",
        direction: "normal",
        keyframes: [
          kf(0, { opacity: 0.9 }),
          kf(0.5, { opacity: 1 }),
          kf(1, { opacity: 0.9 }),
        ],
        style: {
          _content: "",
          _tag: "div",
          width: "420px",
          height: "200px",
          backgroundColor: "#080808",
          borderRadius: "12px",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "0 20px",
        },
      }),
    ];

    // Generate 12 frequency bars with phase-shifted oscillation
    const barCount = 12;
    for (let i = 0; i < barCount; i++) {
      const phaseOffset = (i / barCount) * 0.5; // Phase shift across bars
      const amplitude = 40 + Math.sin(i * 0.5) * 30; // Varying amplitude
      const isCenter = i >= 4 && i <= 7; // Center bars are taller (bass frequencies)

      const maxHeight = isCenter ? 80 + amplitude : 50 + amplitude;
      const minHeight = 10;

      components.push(
        draft(`Frequency Bar ${i + 1}`, {
          durationMs: 800,
          easing: easingPreset("ease-in-out"),
          iterationCount: "infinite",
          direction: "alternate",
          delayMs: Math.round(phaseOffset * 800),
          keyframes: [
            kf(0, { scaleY: 0.2, opacity: 0.5 }),
            kf(0.5, { scaleY: 1, opacity: 1 }),
            kf(1, { scaleY: 0.3, opacity: 0.7 }),
          ],
          style: {
            _content: "",
            _tag: "div",
            width: "16px",
            height: `${maxHeight}px`,
            backgroundColor: isCenter ? "#ffffff" : "#a0a0a0",
            borderRadius: "4px",
            transformOrigin: "center",
            minHeight: `${minHeight}px`,
            boxShadow: isCenter ? "0 0 12px rgba(255, 255, 255, 0.4)" : "none",
          },
        }),
      );
    }

    // Wave overlay — a sinusoidal pulse that travels across the bars
    components.push(
      draft("Wave Pulse", {
        durationMs: 3000,
        easing: easingPreset("linear"),
        iterationCount: "infinite",
        direction: "normal",
        keyframes: [
          kf(0, { opacity: 0, translateX: -200 }),
          kf(0.2, { opacity: 0.4 }),
          kf(0.5, { opacity: 0.6, translateX: 0 }),
          kf(0.8, { opacity: 0.4 }),
          kf(1, { opacity: 0, translateX: 200 }),
        ],
        style: {
          _content: "",
          _tag: "div",
          width: "80px",
          height: "100%",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
          position: "absolute",
          top: "0",
          left: "50%",
          marginLeft: "-40px",
          pointerEvents: "none",
        },
      }),
    );

    return components;
  },
};
