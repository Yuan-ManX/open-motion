import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const orbitTemplate: TemplateDef = {
  id: "tpl-orbit",
  name: "Orbit",
  category: "emphasis",
  description: "A component traveling in a circular path — perfect for loading indicators, solar system visuals, and orbital mechanics.",
  tags: ["orbit", "circle", "rotate", "translate", "loop", "loading"],
  build: () => [
    draft("Orbiting Body", {
      durationMs: 2000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "normal",
      keyframes: [
        kf(0, { translateX: "40px", translateY: "0px", rotate: 0 }),
        kf(0.25, { translateX: "0px", translateY: "-40px", rotate: 90 }),
        kf(0.5, { translateX: "-40px", translateY: "0px", rotate: 180 }),
        kf(0.75, { translateX: "0px", translateY: "40px", rotate: 270 }),
        kf(1, { translateX: "40px", translateY: "0px", rotate: 360 }),
      ],
      style: {
        _content: "",
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        backgroundColor: "#6366f1",
      },
    }),
  ],
};
