import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Badge unlock — a celebratory achievement badge that pops in with a rotate
 * and scale, trailed by a soft glow ring that expands and fades. Used for
 * gamification milestones, streak rewards, and level-up moments.
 */
export const badgeUnlockTemplate: TemplateDef = {
  id: "tpl-badge-unlock",
  name: "Badge Unlock",
  category: "emphasis",
  description: "Achievement badge pop with an expanding glow ring for reward moments.",
  tags: ["badge", "achievement", "reward", "celebration", "gamification", "emphasis"],
  build: () => [
    draft("Achievement Badge", {
      durationMs: 700,
      easing: easingPreset("back"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { scale: 0, rotate: -45, opacity: "0" }),
        kf(0.5, { scale: 1.2, rotate: 8, opacity: "1" }),
        kf(0.75, { scale: 0.95, rotate: -3 }),
        kf(1, { scale: 1, rotate: 0 }),
      ],
      style: {
        _content: "\u2605",
        fontSize: 44,
        fontWeight: 800,
        color: "#ffffff",
        width: 96,
        height: 96,
        borderRadius: "50%",
        backgroundColor: "#6366f1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 16px 40px rgba(99,102,241,0.45)",
        backgroundImage: "radial-gradient(circle at 30% 30%, #818cf8, #6366f1 70%)",
      },
    }),
    draft("Glow Ring", {
      durationMs: 900,
      delayMs: 300,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { scale: 0.6, opacity: "0.7" }),
        kf(1, { scale: 1.8, opacity: "0" }),
      ],
      style: {
        _content: "",
        width: 96,
        height: 96,
        borderRadius: "50%",
        border: "3px solid #818cf8",
      },
    }),
    draft("Reward Label", {
      durationMs: 400,
      delayMs: 500,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", translateY: 8 }),
        kf(1, { opacity: "1", translateY: 0 }),
      ],
      style: {
        _content: "Achievement Unlocked",
        fontSize: 14,
        fontWeight: 600,
        color: "#f4f6fb",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      },
    }),
  ],
};
