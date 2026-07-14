import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const skeletonLoaderTemplate: TemplateDef = {
  id: "tpl-skeleton-loader",
  name: "Skeleton Loader",
  category: "load",
  description: "A shimmering placeholder block that pulses while content loads.",
  tags: ["skeleton", "loading", "shimmer", "placeholder", "loop"],
  build: () => [
    draft("Skeleton Bar", {
      durationMs: 1200,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.3 }),
        kf(1, { opacity: 0.7 }),
      ],
      style: {
        width: 240,
        height: 16,
        background: "#2a2a2a",
        borderRadius: 6,
      },
    }),
    draft("Skeleton Block", {
      durationMs: 1200,
      delayMs: 200,
      easing: easingPreset("ease-in-out"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.25 }),
        kf(1, { opacity: 0.6 }),
      ],
      style: {
        width: 240,
        height: 80,
        background: "#2a2a2a",
        borderRadius: 8,
        marginTop: 8,
      },
    }),
  ],
};
