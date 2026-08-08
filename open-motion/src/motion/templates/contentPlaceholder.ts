import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// A grouped placeholder layout: a header line, an avatar circle, and two
// text rows. Each block pulses on its own stagger so the composition reads
// as a populated UI preparing to be filled with real content.
export const contentPlaceholderTemplate: TemplateDef = {
  id: "tpl-content-placeholder",
  name: "Content Placeholder",
  category: "load",
  description:
    "A stacked placeholder layout — header line, avatar, and text rows — each shimmering on a staggered beat so an empty UI feels staged and alive while real content arrives.",
  tags: ["placeholder", "skeleton", "loading", "stagger", "layout", "shimmer"],
  build: () => [
    draft("Placeholder Stage", {
      durationMs: 0,
      easing: easingPreset("linear"),
      keyframes: [],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        padding: "16px",
        backgroundColor: "#0a0a0a",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      },
    }),
    draft("Header Line", {
      durationMs: 1200,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.35 }),
        kf(1, { opacity: 0.75 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "60%",
        height: "14px",
        backgroundColor: "#2a2a2a",
        borderRadius: "6px",
      },
    }),
    draft("Avatar Circle", {
      durationMs: 1200,
      delayMs: 180,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.3, scale: 0.94 }),
        kf(1, { opacity: 0.7, scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "44px",
        height: "44px",
        borderRadius: "50%",
        backgroundColor: "#2a2a2a",
      },
    }),
    draft("Text Row A", {
      durationMs: 1200,
      delayMs: 360,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.3 }),
        kf(1, { opacity: 0.65 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100%",
        height: "10px",
        backgroundColor: "#2a2a2a",
        borderRadius: "5px",
      },
    }),
    draft("Text Row B", {
      durationMs: 1200,
      delayMs: 540,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.25 }),
        kf(1, { opacity: 0.55 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "75%",
        height: "10px",
        backgroundColor: "#2a2a2a",
        borderRadius: "5px",
      },
    }),
  ],
};
