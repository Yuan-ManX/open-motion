import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const stateTransitionTemplate: TemplateDef = {
  id: "tpl-state-transition",
  name: "State Transition",
  category: "transition",
  description: "A crossfade between two states — old content scales out, new content scales in.",
  tags: ["state", "transition", "crossfade", "scale", "opacity"],
  build: () => [
    draft("State A", {
      durationMs: 350,
      easing: easingPreset("ease-in"),
      keyframes: [
        kf(0, { opacity: 1, scale: 1 }),
        kf(1, { opacity: 0, scale: 0.92 }),
      ],
      style: {
        _content: "Idle",
        width: 160,
        height: 48,
        background: "#333",
        borderRadius: 10,
        color: "#999",
        fontSize: 15,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    }),
    draft("State B", {
      durationMs: 350,
      delayMs: 250,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { opacity: 0, scale: 1.08 }),
        kf(1, { opacity: 1, scale: 1 }),
      ],
      style: {
        _content: "Active",
        width: 160,
        height: 48,
        background: "#f4f6fb",
        borderRadius: 10,
        color: "#0a0a0a",
        fontSize: 15,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
      },
    }),
  ],
};
