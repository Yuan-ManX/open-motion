import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

export const particleBurstTemplate: TemplateDef = {
  id: "tpl-particle-burst",
  name: "Particle Burst",
  category: "emphasis",
  description: "Six particles burst outward from center with staggered timing — an attention-grabbing explosion that draws the eye.",
  tags: ["particle", "burst", "explosion", "attention", "scale", "opacity", "translateX", "translateY"],
  build: () => {
    const particles = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 90;
      const tx = Math.round(Math.cos(angle) * dist);
      const ty = Math.round(Math.sin(angle) * dist);
      particles.push(
        draft(`Particle ${i + 1}`, {
          durationMs: 800,
          delayMs: i * 40,
          easing: easingPreset("ease-out"),
          iterationCount: 1,
          keyframes: [
            kf(0, { translateX: "0px", translateY: "0px", scale: 1, opacity: 1 }),
            kf(0.7, { translateX: `${tx * 0.7}px`, translateY: `${ty * 0.7}px`, scale: 0.8, opacity: 0.8 }),
            kf(1, { translateX: `${tx}px`, translateY: `${ty}px`, scale: 0, opacity: 0 }),
          ],
          style: {
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: "#ffffff",
          },
        }),
      );
    }
    return particles;
  },
};
