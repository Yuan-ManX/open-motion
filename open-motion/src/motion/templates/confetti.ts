import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

export const confettiTemplate: TemplateDef = {
  id: "tpl-confetti",
  name: "Confetti",
  category: "emphasis",
  description: "A burst of colorful particles scattering outward — the universal celebration and success-state pattern.",
  tags: ["confetti", "celebration", "particles", "burst", "success", "translateX", "translateY", "rotate"],
  build: () => {
    const particles = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 80 + Math.random() * 40;
      const tx = Math.round(Math.cos(angle) * dist);
      const ty = Math.round(Math.sin(angle) * dist);
      const rot = Math.round(Math.random() * 720 - 360);
      particles.push(
        draft(`Confetti ${i + 1}`, {
          durationMs: 1200,
          delayMs: i * 30,
          easing: easingPreset("ease-out"),
          iterationCount: 1,
          direction: "normal",
          keyframes: [
            kf(0, { translateX: "0px", translateY: "0px", rotate: 0, opacity: 1, scale: 1 }),
            kf(1, { translateX: `${tx}px`, translateY: `${ty}px`, rotate: rot, opacity: 0, scale: 0.3 }),
          ],
          style: {
            _content: "",
            width: "10px",
            height: "10px",
            borderRadius: "2px",
            backgroundColor: COLORS[i % COLORS.length],
          },
        }),
      );
    }
    return particles;
  },
};
