import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const foldExitTemplate: TemplateDef = {
  id: "tpl-fold-exit",
  name: "Fold Exit",
  category: "exit",
  description: "Folds vertically like paper closing — a tactile dismissal for cards, leaves, and accordion-style content blocks.",
  tags: ["fold", "exit", "scaleY", "vertical", "paper", "tactile"],
  build: () => [
    draft("Folding Card", {
      durationMs: 560,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { scaleY: 1, opacity: 1, rotateX: "0deg" }),
        kf(0.4, { scaleY: 0.85, opacity: 0.9, rotateX: "20deg" }),
        kf(0.75, { scaleY: 0.4, opacity: 0.5, rotateX: "55deg" }),
        kf(1, { scaleY: 0, opacity: 0, rotateX: "90deg" }),
      ],
      style: {
        width: "200px",
        height: "130px",
        borderRadius: "10px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #262626",
        transformOrigin: "top",
      },
    }),
  ],
};
