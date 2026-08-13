import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Book-flip entrance — the element appears as a closed cover, hinges along its
// left edge, rotates open through 3D space, and settles flat with a soft
// shadow underneath. A fine touch for content portals, chapter reveals, or
// document-heavy UIs.
export const bookFlipTemplate: TemplateDef = {
  id: "tpl-book-flip",
  name: "Book Flip",
  category: "entrance",
  description: "3D page-turn entrance that hinges along the left edge and settles flat with a soft shadow — ideal for chapter reveals and document UIs.",
  tags: ["book", "flip", "page", "3d", "cover", "chapter", "document", "read", "reveal"],
  build: () => [
    draft("Book Page", {
      durationMs: 1400,
      easing: easingPreset("ease-out-cubic"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { rotateY: -170, scale: 0.9, opacity: 0.3 }),
        kf(0.55, { rotateY: -20, scale: 0.98, opacity: 1 }),
        kf(0.8, { rotateY: 3, scale: 1, opacity: 1 }),
        kf(1, { rotateY: 0, scale: 1, opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "220px",
        height: "300px",
        borderRadius: "4px 14px 14px 4px",
        background:
          "linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.04) 6%, #FBF8F4 10%, #FBF8F4 100%)",
        boxShadow:
          "-1px 0 0 rgba(0,0,0,0.25), 2px 0 0 rgba(255,255,255,0.4) inset, 4px 8px 24px rgba(0,0,0,0.2)",
      },
    }),
    draft("Book Spine", {
      durationMs: 1400,
      easing: easingPreset("ease-out-cubic"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { opacity: 0 }),
        kf(0.55, { opacity: 1 }),
        kf(1, { opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "6px",
        height: "300px",
        borderRadius: "2px",
        background: "linear-gradient(90deg, #5C4A3A, #8C6E52)",
        boxShadow: "1px 0 3px rgba(0,0,0,0.3)",
      },
    }),
  ],
};
