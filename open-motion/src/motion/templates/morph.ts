import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const morphTemplate: TemplateDef = {
  id: "tpl-morph",
  name: "Morph",
  category: "transition",
  description: "A shape morph from circle to square via borderRadius and scale.",
  tags: ["borderRadius", "scale", "morph", "transition"],
  build: () => [
    draft("Morph Shape", {
      durationMs: 800,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { borderRadius: 50, scale: 1 }),
        kf(0.5, { borderRadius: 25, scale: 1.1 }),
        kf(1, { borderRadius: 0, scale: 1.2 }),
      ],
      style: {
        _content: "",
        width: "160px",
        height: "160px",
        backgroundColor: "#8b5cf6",
        borderRadius: "50%",
      },
    }),
  ],
};
