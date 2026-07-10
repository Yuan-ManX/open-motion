import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const elasticCollapseTemplate: TemplateDef = {
  id: "tpl-elastic-collapse",
  name: "Elastic Collapse",
  category: "exit",
  description: "Collapses with an elastic overshoot — scales down with a springy bounce before disappearing. A playful exit motion.",
  tags: ["elastic", "collapse", "exit", "spring", "scale", "opacity"],
  build: () => [
    draft("Collapsing Card", {
      durationMs: 900,
      delayMs: 0,
      easing: easingPreset("elastic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { scale: 1, opacity: 1 }),
        kf(0.3, { scale: 0.85, opacity: 0.9 }),
        kf(0.5, { scale: 1.05, opacity: 0.8 }),
        kf(1, { scale: 0, opacity: 0 }),
      ],
      style: {
        width: "180px",
        height: "120px",
        borderRadius: "12px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #262626",
      },
    }),
  ],
};
