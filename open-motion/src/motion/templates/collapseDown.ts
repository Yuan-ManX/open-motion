import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const collapseDownTemplate: TemplateDef = {
  id: "tpl-collapse-down",
  name: "Collapse Down",
  category: "exit",
  description: "Shrinks vertically toward the bottom edge — an accordion-style dismissal that reclaims layout space smoothly.",
  tags: ["collapse", "exit", "vertical", "height", "accordion"],
  build: () => [
    draft("Collapsing Section", {
      durationMs: 450,
      easing: easingPreset("ease-in"),
      keyframes: [
        kf(0, { scaleY: 1, opacity: 1 }),
        kf(0.7, { scaleY: 0.1, opacity: 0.5 }),
        kf(1, { scaleY: 0, opacity: 0 }),
      ],
      style: {
        width: "200px",
        height: "100px",
        borderRadius: "8px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #262626",
        transformOrigin: "bottom",
      },
    }),
  ],
};
