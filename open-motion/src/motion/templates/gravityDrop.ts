import { easingPreset, easingSpring } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const gravityDropTemplate: TemplateDef = {
  id: "tpl-gravity-drop",
  name: "Gravity Drop",
  category: "entrance",
  description: "Physics-based gravity drop with realistic bounce settle — element falls from above, impacts, and settles with diminishing bounces.",
  tags: ["gravity", "drop", "fall", "physics", "bounce", "settle", "entrance"],
  build: () => [
    draft("Gravity Element", {
      durationMs: 1200,
      easing: easingPreset("ease-in"),
      keyframes: [
        kf(0, { translateY: "-300%", opacity: 0, scale: 0.8 }),
        kf(0.15, { opacity: 1, scale: 1 }),
        kf(0.4, { translateY: "0%", scale: 1 }, easingSpring(600, 20, 1)),
        kf(0.55, { translateY: "-15%", scale: 1.05 }, easingPreset("ease-out")),
        kf(0.7, { translateY: "0%", scale: 0.98 }, easingSpring(500, 15, 1)),
        kf(0.82, { translateY: "-5%", scale: 1.02 }, easingPreset("ease-out")),
        kf(0.92, { translateY: "0%", scale: 0.99 }, easingSpring(400, 12, 1)),
        kf(1, { translateY: "0%", scale: 1 }),
      ],
      style: {
        _content: "Drop",
        _tag: "div",
        width: "120px",
        height: "120px",
        borderRadius: "12px",
        backgroundColor: "#1a1a1a",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        fontWeight: "600",
      },
    }),
    draft("Impact Shadow", {
      durationMs: 1200,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { scale: 0.3, opacity: 0 }),
        kf(0.35, { scale: 0.5, opacity: 0.3 }),
        kf(0.4, { scale: 1.2, opacity: 0.5 }),
        kf(0.55, { scale: 0.8, opacity: 0.25 }),
        kf(0.7, { scale: 1, opacity: 0.35 }),
        kf(1, { scale: 0.9, opacity: 0.3 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100px",
        height: "12px",
        borderRadius: "50%",
        backgroundColor: "rgba(0,0,0,0.4)",
        filter: "blur(6px)",
        marginTop: "110px",
        marginLeft: "10px",
      },
    }),
  ],
};
