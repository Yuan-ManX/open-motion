import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Three dots that scale and fade in a forward-rolling dash rhythm, giving
// a sense of continuous forward momentum while a task is in flight.
export const dashLoaderTemplate: TemplateDef = {
  id: "tpl-dash-loader",
  name: "Dash Loader",
  category: "load",
  description:
    "Three dots rolling forward in a dash rhythm — each scales and fades one beat behind the last, producing a continuous forward pulse that signals active progress.",
  tags: ["dots", "loader", "dash", "rhythm", "stagger", "loop", "loading"],
  build: () => [
    draft("Dash Stage", {
      durationMs: 0,
      easing: easingPreset("linear"),
      keyframes: [],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "24px",
        display: "flex",
        gap: "14px",
        alignItems: "center",
        justifyContent: "center",
      },
    }),
    draft("Dash Dot 1", {
      durationMs: 900,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { scale: 0.6, opacity: 0.4 }),
        kf(0.5, { scale: 1.15, opacity: 1 }),
        kf(1, { scale: 0.6, opacity: 0.4 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        backgroundColor: "#f4f6fb",
      },
    }),
    draft("Dash Dot 2", {
      durationMs: 900,
      delayMs: 180,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { scale: 0.6, opacity: 0.4 }),
        kf(0.5, { scale: 1.15, opacity: 1 }),
        kf(1, { scale: 0.6, opacity: 0.4 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        backgroundColor: "#d4d4d4",
      },
    }),
    draft("Dash Dot 3", {
      durationMs: 900,
      delayMs: 360,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { scale: 0.6, opacity: 0.4 }),
        kf(0.5, { scale: 1.15, opacity: 1 }),
        kf(1, { scale: 0.6, opacity: 0.4 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        backgroundColor: "#8a8a8a",
      },
    }),
  ],
};
