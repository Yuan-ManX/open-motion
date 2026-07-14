import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const scrollRevealTemplate: TemplateDef = {
  id: "tpl-scroll-reveal",
  name: "Scroll Reveal",
  category: "entrance",
  description: "Content rises into view with a subtle fade when the user scrolls.",
  tags: ["scroll", "reveal", "entrance", "opacity", "translateY"],
  build: () => [
    draft("Reveal Card", {
      durationMs: 700,
      easing: easingPreset("smooth"),
      trigger: "onScroll",
      keyframes: [
        kf(0, { opacity: 0, translateY: 40 }),
        kf(1, { opacity: 1, translateY: 0 }),
      ],
      style: {
        _content: "Scroll to Reveal",
        width: 320,
        height: 80,
        background: "#1a1a1a",
        borderRadius: 12,
        padding: 24,
        color: "#f4f6fb",
        fontSize: 18,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    }),
  ],
};
