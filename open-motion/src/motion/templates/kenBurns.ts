import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Ken Burns — a slow cinematic pan-and-zoom. Combines a gentle scale ramp with
 * a continuous translate drift so a still surface feels alive, evoking the
 * classic documentary dolly. Useful for hero imagery and detail establishes.
 */
export const kenBurnsTemplate: TemplateDef = {
  id: "tpl-ken-burns",
  name: "Ken Burns",
  category: "emphasis",
  description: "A slow cinematic pan-and-zoom — scale ramps while the surface drifts, breathing life into still imagery.",
  tags: ["scale", "pan", "zoom", "cinematic", "drift", "translate"],
  build: () => [
    draft("Cinematic Frame", {
      durationMs: 2400,
      easing: easingPreset("smooth"),
      keyframes: [
        kf(0, { scale: 1, translateX: "0%", opacity: 0.9 }),
        kf(0.35, { scale: 1.08, translateX: "2%", opacity: 1 }),
        kf(0.7, { scale: 1.16, translateX: "-1.5%", opacity: 1 }),
        kf(1, { scale: 1.24, translateX: "0%", opacity: 1 }),
      ],
      style: {
        width: "220px",
        height: "150px",
        borderRadius: "10px",
        backgroundColor: "#1a1a1a",
        border: "1px solid #2e2e2e",
        overflow: "hidden",
      },
    }),
  ],
};