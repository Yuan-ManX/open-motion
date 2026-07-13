import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const pageTransitionTemplate: TemplateDef = {
  id: "tpl-page-transition",
  name: "Page Transition",
  category: "transition",
  description: "A full-screen page change — content fades and slides out, new content slides in.",
  tags: ["page", "transition", "route", "fade", "slide"],
  build: () => [
    draft("Outgoing Page", {
      durationMs: 400,
      easing: easingPreset("ease-in"),
      keyframes: [
        kf(0, { opacity: 1, translateX: 0 }),
        kf(1, { opacity: 0, translateX: -60 }),
      ],
      style: {
        _content: "Page A",
        width: 320,
        height: 120,
        background: "#1a1a1a",
        borderRadius: 12,
        color: "#f4f6fb",
        fontSize: 20,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    }),
    draft("Incoming Page", {
      durationMs: 500,
      delayMs: 300,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { opacity: 0, translateX: 60 }),
        kf(1, { opacity: 1, translateX: 0 }),
      ],
      style: {
        _content: "Page B",
        width: 320,
        height: 120,
        background: "#f4f6fb",
        borderRadius: 12,
        color: "#0a0a0a",
        fontSize: 20,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
      },
    }),
  ],
};
