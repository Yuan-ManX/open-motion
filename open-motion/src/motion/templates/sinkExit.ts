import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const sinkExitTemplate: TemplateDef = {
  id: "tpl-sink-exit",
  name: "Sink Exit",
  category: "exit",
  description: "Drops downward off-screen with a gravity curve — a confident dismissal for modals, sheets, and stacked cards.",
  tags: ["sink", "exit", "translate", "vertical", "gravity", "downward"],
  build: () => [
    draft("Sinking Panel", {
      durationMs: 520,
      easing: easingPreset("ease-in-cubic"),
      keyframes: [
        kf(0, { translateY: "0px", opacity: 1 }),
        kf(0.5, { translateY: "40px", opacity: 0.85 }),
        kf(1, { translateY: "140px", opacity: 0 }),
      ],
      style: {
        width: "220px",
        height: "120px",
        borderRadius: "12px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #262626",
      },
    }),
  ],
};
