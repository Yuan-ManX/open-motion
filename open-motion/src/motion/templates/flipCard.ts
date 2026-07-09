import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const flipCardTemplate: TemplateDef = {
  id: "tpl-flip-card",
  name: "Flip Card",
  category: "transition",
  description: "A 3D card flip revealing the back face with rotateY.",
  tags: ["rotateY", "3d", "transition", "card"],
  build: () => [
    draft("Card Front", {
      durationMs: 600,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { rotateY: 0 }),
        kf(1, { rotateY: 180 }),
      ],
      style: {
        _content: "Front",
        width: "200px",
        height: "120px",
        backgroundColor: "#3b82f6",
        borderRadius: 12,
        color: "#ffffff",
        fontSize: 24,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    }),
  ],
};
