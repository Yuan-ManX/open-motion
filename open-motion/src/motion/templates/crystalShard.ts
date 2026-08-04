import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Crystal Shard — an entrance where a crystalline form assembles from
 * multiple shards flying in from different directions using 3D rotateX/
 * rotateY transforms with perspective. Each shard converges into place.
 */
export const crystalShardTemplate: TemplateDef = {
  id: "tpl-crystal-shard",
  name: "Crystal Shard",
  category: "entrance",
  description:
    "Crystalline entrance where multiple shard pieces fly in from different directions and assemble into a unified form using 3D rotateX/rotateY transforms with perspective depth.",
  tags: ["crystal", "shard", "assemble", "3d", "geometric", "entrance", "perspective"],
  build: () => [
    draft("Crystal Stage", {
      durationMs: 1600,
      easing: easingPreset("ease-in-out"),
      keyframes: [
        kf(0, { opacity: 0 }),
        kf(0.1, { opacity: 1 }),
        kf(1, { opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "320px",
        backgroundColor: "#0a0a0a",
        borderRadius: "12px",
        perspective: "900px",
        transformStyle: "preserve-3d",
        position: "relative",
        overflow: "hidden",
      },
    }),
    draft("Shard Top", {
      durationMs: 1200,
      delayMs: 100,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { rotateX: -120, rotateY: 60, translateZ: -200, opacity: 0 }),
        kf(0.5, { rotateX: -45, rotateY: 20, translateZ: -40, opacity: 0.7 }),
        kf(1, { rotateX: 0, rotateY: 0, translateZ: 0, opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "0",
        height: "0",
        borderLeft: "70px solid transparent",
        borderRight: "70px solid transparent",
        borderBottom: "120px solid rgba(255,255,255,0.85)",
        position: "absolute",
        top: "40px",
        left: "90px",
        transformOrigin: "center bottom",
        filter: "drop-shadow(0 0 6px rgba(180,200,255,0.4))",
      },
    }),
    draft("Shard Bottom Left", {
      durationMs: 1200,
      delayMs: 250,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { rotateX: 100, rotateY: -80, translateZ: -200, opacity: 0 }),
        kf(0.5, { rotateX: 30, rotateY: -25, translateZ: -40, opacity: 0.7 }),
        kf(1, { rotateX: 0, rotateY: 0, translateZ: 0, opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "0",
        height: "0",
        borderRight: "70px solid transparent",
        borderTop: "120px solid rgba(235,235,235,0.75)",
        position: "absolute",
        top: "160px",
        left: "90px",
        transformOrigin: "center top",
        filter: "drop-shadow(0 0 6px rgba(180,200,255,0.3))",
      },
    }),
    draft("Shard Bottom Right", {
      durationMs: 1200,
      delayMs: 400,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { rotateX: 100, rotateY: 80, translateZ: -200, opacity: 0 }),
        kf(0.5, { rotateX: 30, rotateY: 25, translateZ: -40, opacity: 0.7 }),
        kf(1, { rotateX: 0, rotateY: 0, translateZ: 0, opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "0",
        height: "0",
        borderLeft: "70px solid transparent",
        borderTop: "120px solid rgba(245,245,245,0.8)",
        position: "absolute",
        top: "160px",
        left: "160px",
        transformOrigin: "center top",
        filter: "drop-shadow(0 0 6px rgba(180,200,255,0.3))",
      },
    }),
    draft("Shard Core", {
      durationMs: 800,
      delayMs: 700,
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { rotateY: 180, scale: 0.1, opacity: 0 }),
        kf(0.6, { rotateY: 30, scale: 0.8, opacity: 0.6 }),
        kf(1, { rotateY: 0, scale: 1, opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "28px",
        height: "28px",
        backgroundColor: "#ffffff",
        boxShadow: "0 0 14px 4px rgba(150,180,255,0.7), 0 0 28px 8px rgba(150,180,255,0.3)",
        position: "absolute",
        top: "146px",
        left: "146px",
        transformOrigin: "center center",
      },
    }),
  ],
};
