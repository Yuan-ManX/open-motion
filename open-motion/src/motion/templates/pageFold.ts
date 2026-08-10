import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// A page-turn transition: the outgoing sheet folds diagonally from its
// top-right corner using a 3D rotateY pivot, peeling away to expose the
// incoming sheet beneath — like turning a page in a book.
export const pageFoldTemplate: TemplateDef = {
  id: "tpl-page-fold",
  name: "Page Fold",
  category: "transition",
  description:
    "A page-turn transition — the outgoing sheet folds from its top-right corner via a 3D rotateY pivot, peeling away to reveal the incoming sheet beneath, like turning a page in a book.",
  tags: ["page", "fold", "transition", "3d", "turn", "rotateY", "scene-change"],
  build: () => [
    draft("Fold Stage", {
      durationMs: 0,
      easing: easingPreset("linear"),
      keyframes: [],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "220px",
        perspective: "900px",
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
      },
    }),
    draft("Incoming Page", {
      durationMs: 600,
      delayMs: 300,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { opacity: 0.4 }),
        kf(1, { opacity: 1 }),
      ],
      style: {
        _content: "Page B",
        _tag: "div",
        width: "320px",
        height: "220px",
        backgroundColor: "#f4f6fb",
        color: "#0a0a0a",
        fontSize: "22px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "absolute",
        top: 0,
        left: 0,
      },
    }),
    draft("Outgoing Page", {
      durationMs: 900,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { rotateY: 0, opacity: 1 }),
        kf(0.6, { rotateY: -90, opacity: 0.85 }),
        kf(1, { rotateY: -160, opacity: 0 }),
      ],
      style: {
        _content: "Page A",
        _tag: "div",
        width: "320px",
        height: "220px",
        backgroundColor: "#1a1a1a",
        color: "#f4f6fb",
        fontSize: "22px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "absolute",
        top: 0,
        left: 0,
        transformOrigin: "right center",
        backfaceVisibility: "hidden",
        zIndex: 2,
      },
    }),
  ],
};
