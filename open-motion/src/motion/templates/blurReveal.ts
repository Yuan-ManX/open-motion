import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Blur reveal animation — content emerges from heavy blur and scale into
 * sharp focus. Creates a depth-of-field effect common in modern UI
 * transitions and landing page hero sections.
 */
export const blurRevealTemplate: TemplateDef = {
  id: "tpl-blur-reveal",
  name: "Blur Reveal",
  category: "entrance",
  description: "Depth-of-field blur to focus transition for hero content.",
  tags: ["blur", "focus", "depth", "scale", "entrance"],
  build: () => [
    draft("Blur Reveal Content", {
      durationMs: 1600,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", blur: "20px", scale: 1.1 }),
        kf(0.4, { opacity: "0.4", blur: "10px", scale: 1.05 }),
        kf(0.7, { opacity: "0.8", blur: "4px", scale: 1.02 }),
        kf(1, { opacity: "1", blur: "0px", scale: 1 }),
      ],
      style: {
        _content: "In Focus",
        fontSize: 42,
        fontWeight: 700,
        color: "#f4f6fb",
        textAlign: "center",
        padding: "24px 48px",
      },
    }),
    draft("Blur Reveal Backdrop", {
      durationMs: 1600,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", blur: "30px" }),
        kf(0.5, { opacity: "0.2", blur: "15px" }),
        kf(1, { opacity: "0.1", blur: "0px" }),
      ],
      style: {
        _content: "",
        width: "120%",
        height: "120%",
        position: "absolute" as const,
        top: "-10%",
        left: "-10%",
        background: "radial-gradient(circle, rgba(74,158,255,0.15) 0%, transparent 70%)",
        zIndex: -1,
      },
    }),
  ],
};
