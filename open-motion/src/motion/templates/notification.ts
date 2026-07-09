import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const notificationTemplate: TemplateDef = {
  id: "tpl-notification",
  name: "Notification",
  category: "entrance",
  description: "A toast notification that slides in from the top with a fade.",
  tags: ["translateY", "opacity", "toast", "entrance"],
  build: () => [
    draft("Toast", {
      durationMs: 500,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { translateY: -100, opacity: 0 }),
        kf(1, { translateY: 0, opacity: 1 }),
      ],
      style: {
        _content: "New message arrived",
        width: "280px",
        padding: "12px 16px",
        backgroundColor: "#1e293b",
        color: "#f4f6fb",
        borderRadius: "10px",
        fontSize: 14,
        fontWeight: 500,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      },
    }),
  ],
};
