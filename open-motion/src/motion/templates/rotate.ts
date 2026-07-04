import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const rotateTemplate: TemplateDef = {
  id: "tpl-flip-in",
  name: "Flip In",
  category: "entrance",
  description: "Rotates into view on the Y axis with a 3D turn.",
  tags: ["rotate", "3d", "entrance"],
  build: () => [
    draft("Panel", {
      durationMs: 800,
      easing: easingPreset("ease-out-cubic"),
      keyframes: [
        kf(0, { rotateY: 90, opacity: 0 }),
        kf(1, { rotateY: 0, opacity: 1 }),
      ],
      style: {
        _content: "Flip",
        width: 200,
        height: 120,
        borderRadius: 16,
        backgroundColor: "#0ea5e9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        fontWeight: 700,
        color: "#ffffff",
      },
    }),
  ],
};
