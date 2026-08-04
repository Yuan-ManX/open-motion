import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Dimensional Fold — a spatial transition where a surface folds along an
 * invisible crease, collapsing one state into another through a 3D origami
 * motion. Two panels rotate on opposite axes around a central hinge, with
 * shadow modulation that reinforces the perception of depth. Original
 * composition for state transitions and view changes.
 */
export const dimensionalFoldTemplate: TemplateDef = {
  id: "tpl-dimensional-fold",
  name: "Dimensional Fold",
  category: "transition",
  description:
    "Surface folds along an invisible crease through 3D origami motion — two panels rotate on opposite axes around a central hinge with shadow modulation for state transitions.",
  tags: ["dimensional", "fold", "origami", "3d", "spatial", "transition", "state-change", "hinge"],
  build: () => [
    draft("Fold Stage", {
      durationMs: 2200,
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
        width: "400px",
        height: "240px",
        backgroundColor: "#0a0a0a",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
        perspective: "1000px",
      },
    }),
    draft("Panel Left", {
      durationMs: 1800,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 1, rotateY: "0deg", translateX: "0%" }),
        kf(0.4, { opacity: 0.9, rotateY: "45deg", translateX: "-5%" }),
        kf(0.7, { opacity: 0.7, rotateY: "75deg", translateX: "-12%" }),
        kf(1, { opacity: 0.95, rotateY: "0deg", translateX: "0%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "50%",
        height: "100%",
        backgroundColor: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
        background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
        position: "absolute",
        top: "0",
        left: "0",
        transformOrigin: "right center",
        boxShadow: "inset -8px 0 24px rgba(0,0,0,0.6)",
      },
    }),
    draft("Panel Right", {
      durationMs: 1800,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 1, rotateY: "0deg", translateX: "0%" }),
        kf(0.4, { opacity: 0.9, rotateY: "-45deg", translateX: "5%" }),
        kf(0.7, { opacity: 0.7, rotateY: "-75deg", translateX: "12%" }),
        kf(1, { opacity: 0.95, rotateY: "0deg", translateX: "0%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "50%",
        height: "100%",
        background: "linear-gradient(225deg, #1a1a1a 0%, #2a2a2a 100%)",
        position: "absolute",
        top: "0",
        right: "0",
        transformOrigin: "left center",
        boxShadow: "inset 8px 0 24px rgba(0,0,0,0.6)",
      },
    }),
    draft("Central Hinge Glow", {
      durationMs: 1400,
      delayMs: 400,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0, scaleY: 0.4 }),
        kf(0.4, { opacity: 1, scaleY: 1 }),
        kf(0.8, { opacity: 0.8, scaleY: 1.2 }),
        kf(1, { opacity: 0, scaleY: 0.6 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "4px",
        height: "80%",
        backgroundColor: "#ffffff",
        position: "absolute",
        top: "10%",
        left: "50%",
        transform: "translateX(-50%)",
        boxShadow: "0 0 16px 4px rgba(255,255,255,0.8), 0 0 32px 8px rgba(200,220,255,0.4)",
      },
    }),
    draft("Fold Shadow Plane", {
      durationMs: 1800,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0 }),
        kf(0.5, { opacity: 0.5 }),
        kf(1, { opacity: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100%",
        height: "100%",
        background: "radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, transparent 70%)",
        position: "absolute",
        top: "0",
        left: "0",
      },
    }),
  ],
};
