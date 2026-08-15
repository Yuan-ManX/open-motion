import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Chromatic Orbit Exit: colored concentric rings orbit outwards while the
// content dissolves through a rainbow-tinted blur — perfect for closing a
// high-energy feature panel.
export const chromaticOrbitExitTemplate: TemplateDef = {
  id: "tpl-chromatic-orbit-exit",
  name: "Chromatic Orbit Exit",
  category: "exit",
  description: "Concentric rainbow rings spiral outward as the core fades — a flamboyant exit that trails chromatic color energy behind it.",
  tags: ["exit", "chromatic", "orbit", "rainbow", "spiral", "rings", "dissolve", "flamboyant"],
  build: () => {
    const rings: ReturnType<typeof draft>[] = [];
    const colors = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#0EA5E9", "#8B5CF6", "#EC4899"];
    for (let i = 0; i < colors.length; i += 1) {
      const size = 140 + i * 18;
      rings.push(
        draft(`Orbit Ring ${i + 1}`, {
          durationMs: 1150,
          delayMs: i * 55,
          easing: easingPreset("ease-in-cubic"),
          iterationCount: 1,
          keyframes: [
            kf(0, { opacity: 0.65, scale: 1, rotateZ: i * 12, translateX: 0, translateY: 0 }),
            kf(0.55, { opacity: 0.5, scale: 1.8, rotateZ: i * 28 + 45, translateX: Math.cos(i) * 40, translateY: Math.sin(i) * 40 }),
            kf(1, { opacity: 0, scale: 2.6, rotateZ: i * 48 + 90, translateX: Math.cos(i) * 110, translateY: Math.sin(i) * 110 }),
          ],
          style: {
            _content: "",
            _tag: "div",
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: "50%",
            border: `2.5px solid ${colors[i]}`,
            position: "absolute",
            top: `${-9 - i * 9}px`,
            left: `${-9 - i * 9}px`,
          },
        }),
      );
    }
    rings.unshift(
      draft("Fading Core", {
        durationMs: 900,
        easing: easingPreset("ease-in"),
        iterationCount: 1,
        keyframes: [
          kf(0, { opacity: 1, scale: 1, blur: 0 }),
          kf(0.5, { opacity: 0.5, scale: 0.85, blur: 5 }),
          kf(1, { opacity: 0, scale: 0.5, blur: 24 }),
        ],
        style: {
          _content: "",
          _tag: "div",
          width: "140px",
          height: "140px",
          borderRadius: "20px",
          background: "linear-gradient(135deg, #1E293B 0%, #0EA5E9 55%, #8B5CF6 100%)",
        },
      }),
    );
    return rings;
  },
};
