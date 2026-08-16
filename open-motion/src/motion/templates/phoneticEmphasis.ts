import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Phonetic Emphasis: a text badge that pulses in sync with spoken-style
// phoneme cadence — good for highlighting feature announcements or taglines
// that the user wants the viewer to literally "hear" visually.
export const phoneticEmphasisTemplate: TemplateDef = {
  id: "tpl-phonetic-emphasis",
  name: "Phonetic Emphasis",
  category: "emphasis",
  description: "Badge text pulses on a phonetic syllable grid — short bounces on plosives, long holds on vowels — so copy reads out loud to the eyes.",
  tags: ["emphasis", "phonetic", "text", "speech", "syllable", "announcement", "badge", "tagline"],
  build: () => {
    // Keyframes tuned to approximate syllable cadence:
    // plosives (P/B/T/D) = quick snaps, vowels = longer holds.
    const body = draft("Phonetic Badge", {
      durationMs: 1800,
      easing: easingPreset("snappy"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        // Rest
        kf(0, { scale: 1, translateY: 0 }),
        // Syllable 1: plosive snap
        kf(0.04, { scale: 1.08, translateY: -3 }),
        kf(0.1, { scale: 1, translateY: 0 }),
        // Syllable 2: vowel hold
        kf(0.18, { scale: 1.05, translateY: -1 }),
        kf(0.3, { scale: 1.04, translateY: -1 }),
        kf(0.36, { scale: 1, translateY: 0 }),
        // Syllable 3: another plosive
        kf(0.44, { scale: 1.09, translateY: -4 }),
        kf(0.5, { scale: 1, translateY: 0 }),
        // Breath
        kf(0.58, { scale: 0.99, translateY: 1 }),
        // Syllable 4: held vowel
        kf(0.68, { scale: 1.06, translateY: -2 }),
        kf(0.82, { scale: 1.05, translateY: -2 }),
        kf(0.9, { scale: 1, translateY: 0 }),
        // End
        kf(1, { scale: 1, translateY: 0 }),
      ],
      style: {
        _content: "SIGNAL · BOOST · LAUNCH",
        _tag: "div",
        width: "260px",
        height: "56px",
        lineHeight: "56px",
        textAlign: "center",
        fontSize: "15px",
        fontWeight: 700,
        letterSpacing: "2px",
        color: "#F8FAFC",
        borderRadius: "28px",
        background: "linear-gradient(90deg, #0EA5E9 0%, #8B5CF6 50%, #EC4899 100%)",
        boxShadow: "0 10px 30px rgba(139,92,246,0.35)",
      },
    });

    const dot = draft("Syllable Dot", {
      durationMs: 1800,
      easing: easingPreset("ease-out"),
      iterationCount: "infinite",
      keyframes: [
        kf(0, { opacity: 0.6, scale: 0.9 }),
        kf(0.04, { opacity: 1, scale: 1.6 }),
        kf(0.18, { opacity: 0.8, scale: 1.1 }),
        kf(0.44, { opacity: 1, scale: 1.7 }),
        kf(0.68, { opacity: 0.9, scale: 1.3 }),
        kf(1, { opacity: 0.6, scale: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: "#FFFFFF",
        position: "absolute",
        top: "23px",
        right: "18px",
      },
    });

    return [body, dot];
  },
};
