import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Eclipse reveal: a dark disc slides across a luminous orb, briefly occluding
// it before sliding away to reveal the bright element. Conveys cosmic drama.
export const eclipseRevealTemplate: TemplateDef = {
  id: "tpl-eclipse-reveal",
  name: "Eclipse Reveal",
  category: "entrance",
  description: "A shadow disc transits across a luminous orb, briefly eclipsing it before sliding away to reveal the bright element beneath — a cosmic, dramatic entrance with celestial timing.",
  tags: ["entrance", "eclipse", "cosmic", "celestial", "shadow", "transit", "reveal"],
  build: () => [
    draft("Luminous Orb", {
      durationMs: 1600,
      easing: easingPreset("ease-in-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.4 }),
        kf(0.25, { opacity: 0.9, scale: 1 }),
        kf(0.5, { opacity: 0.15, scale: 1 }),
        kf(0.75, { opacity: 0.9, scale: 1 }),
        kf(1, { opacity: 1, scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "160px",
        height: "160px",
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, #FEF3C7 0%, #FBBF24 40%, #F59E0B 70%, #B45309 100%)",
        boxShadow: "0 0 80px rgba(251,191,36,0.6), 0 0 30px rgba(245,158,11,0.5)",
      },
    }),
    draft("Shadow Disc", {
      durationMs: 1600,
      easing: easingPreset("ease-in-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, translateX: -220 }),
        kf(0.2, { opacity: 1, translateX: -160 }),
        kf(0.5, { opacity: 1, translateX: 0 }),
        kf(0.8, { opacity: 1, translateX: 160 }),
        kf(1, { opacity: 0, translateX: 220 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "155px",
        height: "155px",
        borderRadius: "50%",
        background: "radial-gradient(circle at 40% 40%, #1E293B 0%, #0F172A 60%, #000 100%)",
        position: "absolute",
        top: "2px",
        left: "2px",
        boxShadow: "0 0 20px rgba(0,0,0,0.7)",
      },
    }),
    draft("Corona Flare", {
      durationMs: 1600,
      easing: easingPreset("ease-in-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.8 }),
        kf(0.4, { opacity: 0, scale: 0.9 }),
        kf(0.5, { opacity: 1, scale: 1.1 }),
        kf(0.6, { opacity: 0.7, scale: 1.05 }),
        kf(0.8, { opacity: 0, scale: 1 }),
        kf(1, { opacity: 0, scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "200px",
        borderRadius: "50%",
        background: "radial-gradient(circle, transparent 35%, rgba(251,191,36,0.4) 45%, rgba(245,158,11,0.15) 60%, transparent 75%)",
        position: "absolute",
        top: "-20px",
        left: "-20px",
      },
    }),
  ],
};
