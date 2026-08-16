import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Plasma storm: ionized energy gathers from the edges into a contained core,
// discharging in a brief flare before settling. Conveys raw, contained power.
export const plasmaStormTemplate: TemplateDef = {
  id: "tpl-plasma-storm",
  name: "Plasma Storm",
  category: "entrance",
  description: "Ionized energy swirls inward from the edges into a contained core, flaring once before stabilizing — a high-voltage entrance with electromagnetic tension.",
  tags: ["entrance", "plasma", "energy", "storm", "ionized", "voltage", "electromagnetic"],
  build: () => [
    draft("Plasma Core", {
      durationMs: 1400,
      easing: easingPreset("ease-in-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.1, rotate: -180, blur: 20 }),
        kf(0.3, { opacity: 0.5, scale: 0.45, rotate: -90, blur: 12 }),
        kf(0.6, { opacity: 0.85, scale: 0.92, rotate: -30, blur: 4 }),
        kf(0.78, { opacity: 1, scale: 1.08, rotate: 8, blur: 0 }),
        kf(1, { opacity: 1, scale: 1, rotate: 0, blur: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "160px",
        height: "160px",
        borderRadius: "50%",
        background: "radial-gradient(circle at 50% 50%, #F0ABFC 0%, #C026D3 35%, #7E22CE 65%, #1E1B4B 100%)",
        boxShadow: "0 0 60px rgba(192,38,211,0.55), inset 0 0 40px rgba(240,171,252,0.4)",
      },
    }),
    draft("Energy Halo", {
      durationMs: 1400,
      easing: easingPreset("ease-in-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0.8, scale: 2.4, rotate: 360 }),
        kf(0.5, { opacity: 0.4, scale: 1.6, rotate: 180 }),
        kf(0.78, { opacity: 0.9, scale: 1.25, rotate: 60 }),
        kf(1, { opacity: 0, scale: 1.05, rotate: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "200px",
        borderRadius: "50%",
        background: "conic-gradient(from 0deg, transparent 0deg, rgba(240,171,252,0.5) 90deg, transparent 180deg, rgba(192,38,211,0.4) 270deg, transparent 360deg)",
        position: "absolute",
        top: "-20px",
        left: "-20px",
        filter: "blur(8px)",
      },
    }),
    draft("Discharge Spark", {
      durationMs: 1400,
      easing: easingPreset("ease-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0 }),
        kf(0.7, { opacity: 0, scale: 0 }),
        kf(0.78, { opacity: 1, scale: 1.4 }),
        kf(0.85, { opacity: 0.6, scale: 0.9 }),
        kf(1, { opacity: 0, scale: 1.1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "180px",
        height: "180px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(240,171,252,0.6) 30%, transparent 70%)",
        position: "absolute",
        top: "-10px",
        left: "-10px",
      },
    }),
  ],
};
