import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Origami Fold — a paper-folding entrance where panels unfold from a
 * collapsed state using 3D rotateX/rotateY transforms with perspective.
 * Creates the illusion of paper origami opening up.
 */
export const origamiFoldTemplate: TemplateDef = {
  id: "tpl-origami-fold",
  name: "Origami Fold",
  category: "entrance",
  description:
    "Paper-folding entrance with 3D rotateX/rotateY panels unfolding from a collapsed state — creates an origami opening effect with perspective depth.",
  tags: ["origami", "fold", "unfold", "3d", "paper", "perspective", "entrance"],
  build: () => [
    draft("Origami Stage", {
      durationMs: 1400,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { opacity: 0 }),
        kf(0.1, { opacity: 1 }),
        kf(1, { opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "240px",
        perspective: "800px",
        transformStyle: "preserve-3d",
        position: "relative",
      },
    }),
    draft("Panel Left", {
      durationMs: 1200,
      delayMs: 200,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { rotateY: -180, opacity: 0 }),
        kf(0.5, { rotateY: -90, opacity: 0.5 }),
        kf(1, { rotateY: 0, opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "160px",
        height: "240px",
        backgroundColor: "#ffffff",
        border: "1px solid #e0e0e0",
        transformOrigin: "right center",
        position: "absolute",
        left: "0",
        top: "0",
        backfaceVisibility: "hidden",
      },
    }),
    draft("Panel Right", {
      durationMs: 1200,
      delayMs: 200,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { rotateY: 180, opacity: 0 }),
        kf(0.5, { rotateY: 90, opacity: 0.5 }),
        kf(1, { rotateY: 0, opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "160px",
        height: "240px",
        backgroundColor: "#f5f5f5",
        border: "1px solid #e0e0e0",
        transformOrigin: "left center",
        position: "absolute",
        right: "0",
        top: "0",
        backfaceVisibility: "hidden",
      },
    }),
    draft("Panel Top", {
      durationMs: 1000,
      delayMs: 600,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { rotateX: -180, opacity: 0 }),
        kf(0.5, { rotateX: -90, opacity: 0.5 }),
        kf(1, { rotateX: 0, opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "120px",
        backgroundColor: "#fafafa",
        border: "1px solid #e8e8e8",
        transformOrigin: "center bottom",
        position: "absolute",
        left: "0",
        top: "0",
        backfaceVisibility: "hidden",
      },
    }),
  ],
};
