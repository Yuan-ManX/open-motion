import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// A theatrical scene change: two opaque panels meet in the middle, then
// slide apart vertically — the top half rises off-screen, the bottom half
// sinks away — unveiling the incoming content underneath.
export const curtainRiseTemplate: TemplateDef = {
  id: "tpl-curtain-rise",
  name: "Curtain Rise",
  category: "transition",
  description:
    "Theatrical scene change — two opaque panels split apart vertically (top rises, bottom sinks) to unveil incoming content, giving a stage-curtain reveal between views.",
  tags: ["curtain", "transition", "reveal", "split", "stage", "scene-change"],
  build: () => [
    draft("Curtain Stage", {
      durationMs: 0,
      easing: easingPreset("linear"),
      keyframes: [],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "200px",
        position: "relative",
        overflow: "hidden",
        borderRadius: "12px",
        backgroundColor: "#0a0a0a",
      },
    }),
    draft("Incoming Content", {
      durationMs: 600,
      delayMs: 350,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { opacity: 0, scale: 0.96 }),
        kf(1, { opacity: 1, scale: 1 }),
      ],
      style: {
        _content: "Scene B",
        _tag: "div",
        width: "320px",
        height: "200px",
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
    draft("Curtain Top", {
      durationMs: 700,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { translateY: "0%" }),
        kf(0.5, { translateY: "0%" }),
        kf(1, { translateY: "-100%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "100px",
        background:
          "repeating-linear-gradient(90deg, #1a1a1a 0 12px, #0a0a0a 12px 24px)",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 2,
      },
    }),
    draft("Curtain Bottom", {
      durationMs: 700,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { translateY: "0%" }),
        kf(0.5, { translateY: "0%" }),
        kf(1, { translateY: "100%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "100px",
        background:
          "repeating-linear-gradient(90deg, #1a1a1a 0 12px, #0a0a0a 12px 24px)",
        position: "absolute",
        bottom: 0,
        left: 0,
        zIndex: 2,
      },
    }),
  ],
};
