import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// A central orb that breathes while two satellites orbit it on tilted
// paths. Reads as an active, energetic loader without leaning on dots or
// bars, useful when a process needs to feel alive rather than mechanical.
export const orbLoaderTemplate: TemplateDef = {
  id: "tpl-orb-loader",
  name: "Orb Loader",
  category: "load",
  description:
    "A breathing central orb ringed by two satellites traveling tilted orbits — an energetic, non-mechanical loader that feels alive while a process runs.",
  tags: ["orb", "loader", "orbit", "breathing", "loop", "loading", "energy"],
  build: () => [
    draft("Orb Stage", {
      durationMs: 0,
      easing: easingPreset("linear"),
      keyframes: [],
      style: {
        _content: "",
        _tag: "div",
        width: "160px",
        height: "160px",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    }),
    draft("Core Orb", {
      durationMs: 1600,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 0.85, opacity: 0.7 }),
        kf(1, { scale: 1.1, opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0%, rgba(200,200,200,0.55) 55%, rgba(120,120,120,0.25) 100%)",
        boxShadow: "0 0 28px rgba(244,246,251,0.35)",
        position: "absolute",
      },
    }),
    draft("Satellite Alpha", {
      durationMs: 1800,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { rotate: 0, translateX: "52px" }),
        kf(1, { rotate: 360, translateX: "52px" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        backgroundColor: "#f4f6fb",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-6px",
        marginTop: "-6px",
        transformOrigin: "center center",
      },
    }),
    draft("Satellite Beta", {
      durationMs: 2400,
      delayMs: 200,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { rotate: 0, translateX: "70px" }),
        kf(1, { rotate: -360, translateX: "70px" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: "#8a8a8a",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: "-4px",
        marginTop: "-4px",
        transformOrigin: "center center",
      },
    }),
  ],
};
