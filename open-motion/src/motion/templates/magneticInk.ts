import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Magnetic Ink — an ink calligraphy stroke that materializes under the
 * influence of an unseen magnetic field, warping and extending with organic
 * tension before settling into a final form. The stroke opacity, length, and
 * curvature shift across three phases: attraction, extension, and rest.
 * Original composition for expressive entrances and editorial transitions.
 */
export const magneticInkTemplate: TemplateDef = {
  id: "tpl-magnetic-ink",
  name: "Magnetic Ink",
  category: "transition",
  description:
    "Ink stroke materializes under magnetic tension, warping through attraction, extension, and rest phases — organic calligraphic transition with curvature shift.",
  tags: ["ink", "magnetic", "calligraphy", "stroke", "organic", "warp", "transition", "editorial"],
  build: () => [
    draft("Ink Canvas", {
      durationMs: 2800,
      easing: easingPreset("linear"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0 }),
        kf(0.1, { opacity: 1 }),
        kf(1, { opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "420px",
        height: "180px",
        backgroundColor: "#fafafa",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      },
    }),
    draft("Ink Stroke Body", {
      durationMs: 2400,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scaleX: 0, scaleY: 0.4, translateX: "-40%", rotate: "-8deg" }),
        kf(0.3, { opacity: 0.8, scaleX: 0.5, scaleY: 0.8, translateX: "-15%", rotate: "-4deg" }),
        kf(0.6, { opacity: 1, scaleX: 0.85, scaleY: 1, translateX: "10%", rotate: "2deg" }),
        kf(1, { opacity: 1, scaleX: 1, scaleY: 1, translateX: "20%", rotate: "0deg" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "280px",
        height: "12px",
        backgroundColor: "#0a0a0a",
        borderRadius: "6px",
        position: "absolute",
        top: "50%",
        left: "50%",
        transformOrigin: "left center",
        transform: "translate(-50%, -50%)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      },
    }),
    draft("Ink Tail Whisper", {
      durationMs: 2000,
      delayMs: 600,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scaleX: 0, translateX: "-20%" }),
        kf(0.4, { opacity: 0.7, scaleX: 0.8, translateX: "10%" }),
        kf(1, { opacity: 0, scaleX: 1.2, translateX: "30%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "4px",
        backgroundColor: "rgba(10,10,10,0.6)",
        borderRadius: "2px",
        position: "absolute",
        top: "52%",
        left: "20%",
        transformOrigin: "left center",
        filter: "blur(1.5px)",
      },
    }),
    draft("Magnetic Anchor Point", {
      durationMs: 1800,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scale: 0 }),
        kf(0.3, { opacity: 0.9, scale: 1.4 }),
        kf(0.7, { opacity: 0.5, scale: 1 }),
        kf(1, { opacity: 0, scale: 0.6 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        backgroundColor: "#0a0a0a",
        position: "absolute",
        top: "50%",
        left: "10%",
        transform: "translate(-50%, -50%)",
        boxShadow: "0 0 12px 2px rgba(0,0,0,0.4)",
      },
    }),
    draft("Ink Splatter Accent", {
      durationMs: 1200,
      delayMs: 1600,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scale: 0 }),
        kf(0.5, { opacity: 0.7, scale: 1 }),
        kf(1, { opacity: 0.4, scale: 1.1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: "#0a0a0a",
        position: "absolute",
        top: "40%",
        right: "25%",
        transform: "translate(-50%, -50%)",
        boxShadow:
          "6px 8px 0 -2px #0a0a0a, -4px 10px 0 -3px #0a0a0a, 10px -4px 0 -4px #0a0a0a",
      },
    }),
  ],
};
