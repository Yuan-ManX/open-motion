import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Shatter Reveal — an exit effect where the layer breaks into four shards
 * that fly outward along divergent vectors while fading and rotating. Each
 * shard uses the same source visual (a colored panel) clipped to a quadrant
 * so the viewer reads it as one piece fracturing apart, not four
 * independent boxes. The shards accelerate outward with a snappy ease-out
 * and a small gravity-like downward drift on the lower pair gives the
 * break a physical weight.
 */
export const shatterRevealTemplate: TemplateDef = {
  id: "tpl-shatter-reveal",
  name: "Shatter Reveal",
  category: "exit",
  description: "Layer fractures into four shards that fly outward along divergent vectors with rotation and fade — a physical, destructive exit.",
  tags: ["shatter", "break", "exit", "fracture", "shard", "destructive", "outward"],
  build: () => [
    // Top-left shard — flies up-left, rotates counter-clockwise.
    draft("Shard TL", {
      durationMs: 700,
      delayMs: 0,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: 1, translateX: 0, translateY: 0, rotate: 0 }),
        kf(1, { opacity: 0, translateX: -120, translateY: -90, rotate: -28 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100px",
        height: "100px",
        backgroundColor: "#0a0a0a",
        position: "absolute",
        top: "0",
        left: "0",
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
      },
    }),
    // Top-right shard — flies up-right, rotates clockwise.
    draft("Shard TR", {
      durationMs: 700,
      delayMs: 0,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: 1, translateX: 0, translateY: 0, rotate: 0 }),
        kf(1, { opacity: 0, translateX: 120, translateY: -90, rotate: 24 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100px",
        height: "100px",
        backgroundColor: "#0a0a0a",
        position: "absolute",
        top: "0",
        left: "100px",
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
      },
    }),
    // Bottom-left shard — flies down-left with gravity drift.
    draft("Shard BL", {
      durationMs: 750,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: 1, translateX: 0, translateY: 0, rotate: 0 }),
        kf(1, { opacity: 0, translateX: -110, translateY: 120, rotate: -18 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100px",
        height: "100px",
        backgroundColor: "#0a0a0a",
        position: "absolute",
        top: "100px",
        left: "0",
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
      },
    }),
    // Bottom-right shard — flies down-right with gravity drift.
    draft("Shard BR", {
      durationMs: 750,
      delayMs: 0,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: 1, translateX: 0, translateY: 0, rotate: 0 }),
        kf(1, { opacity: 0, translateX: 110, translateY: 120, rotate: 22 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "100px",
        height: "100px",
        backgroundColor: "#0a0a0a",
        position: "absolute",
        top: "100px",
        left: "100px",
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
      },
    }),
  ],
};
