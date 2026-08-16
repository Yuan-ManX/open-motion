import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Prism Refract: a white light beam enters a glass prism and splits into red, green, and blue beams that spread outward
export const prismRefractTemplate: TemplateDef = {
  id: "tpl-prism-refract",
  name: "Prism Refract",
  category: "emphasis",
  description:
    "A white light beam enters a glass prism and refracts into spreading red, green, and blue beams — a luminous emphasis that conveys spectral separation and colorful dispersion.",
  tags: ["emphasis", "prism", "light", "rainbow", "refract", "spectrum", "split", "colorful"],
  build: () => [
    draft("White Light Beam", {
      durationMs: 900,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scaleX: 0.2 }),
        kf(0.4, { opacity: 1, scaleX: 1 }),
        kf(1, { opacity: 1, scaleX: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "130px",
        height: "6px",
        background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, #ffffff 70%, #ffffff 100%)",
        boxShadow: "0 0 14px rgba(255,255,255,0.85)",
        position: "absolute",
        top: "127px",
        left: "20px",
        transformOrigin: "left center",
      },
    }),
    draft("Prism Triangle", {
      durationMs: 1100,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, rotate: -18, scale: 0.6 }),
        kf(0.5, { opacity: 1, rotate: 0, scale: 1 }),
        kf(1, { opacity: 1, rotate: 0, scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "0",
        height: "0",
        borderLeft: "50px solid transparent",
        borderRight: "50px solid transparent",
        borderBottom: "90px solid rgba(190,210,255,0.32)",
        position: "absolute",
        top: "85px",
        left: "150px",
        filter: "drop-shadow(0 0 10px rgba(150,180,255,0.55))",
        transformOrigin: "center center",
      },
    }),
    draft("Spectrum Beams", {
      durationMs: 900,
      delayMs: 450,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scaleX: 0.1 }),
        kf(0.6, { opacity: 0.95, scaleX: 1 }),
        kf(1, { opacity: 0.95, scaleX: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "160px",
        height: "100px",
        background:
          "conic-gradient(from -22deg at 0% 50%, #ff3b3b 0deg 8deg, rgba(255,59,59,0) 8deg 18deg, #3bff7a 18deg 26deg, rgba(59,255,122,0) 26deg 36deg, #3b8aff 36deg 44deg, rgba(59,138,255,0) 44deg)",
        clipPath: "polygon(0% 50%, 100% 0%, 100% 100%)",
        position: "absolute",
        top: "80px",
        left: "200px",
        transformOrigin: "0% 50%",
      },
    }),
    draft("Prism Core Glow", {
      durationMs: 1400,
      delayMs: 500,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.4, scale: 0.8 }),
        kf(0.5, { opacity: 0.9, scale: 1.15 }),
        kf(1, { opacity: 0.5, scale: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "40px",
        height: "40px",
        background:
          "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(180,200,255,0.4) 50%, transparent 75%)",
        borderRadius: "50%",
        position: "absolute",
        top: "110px",
        left: "180px",
        transformOrigin: "center center",
      },
    }),
  ],
};
