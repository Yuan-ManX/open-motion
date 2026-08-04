import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Ink Bleed — a dark ink drop that spreads, blurs, and resolves into the
 * target element. The entrance has three coordinated layers: a faint halo
 * that fades in first, the ink body that scales up while a heavy blur
 * clears to sharp, and a settling scale pulse that gives the reveal a
 * physical ink-meeting-paper weight. Pure opacity alone would feel cheap;
 * the blur+scale coupling is what makes it read as ink.
 */
export const inkBleedTemplate: TemplateDef = {
  id: "tpl-ink-bleed",
  name: "Ink Bleed",
  category: "emphasis",
  description: "Dark ink drop spreads, blurs, and resolves into the target — a weighted reveal with paper-meets-ink physicality.",
  tags: ["ink", "bleed", "blur", "scale", "reveal", "entrance", "weighted", "organic"],
  build: () => [
    // Halo — the faint outer bleed that arrives first.
    draft("Ink Halo", {
      durationMs: 1100,
      delayMs: 0,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: 0, scale: 0.4 }),
        kf(0.35, { opacity: 0.5, scale: 1.15 }),
        kf(1, { opacity: 0, scale: 1.6 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "240px",
        height: "240px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(20,20,25,0.35) 0%, rgba(20,20,25,0) 70%)",
        filter: "blur(14px)",
        position: "absolute",
        top: "0",
        left: "0",
      },
    }),
    // Ink body — the main layer that scales up while blur clears.
    draft("Ink Body", {
      durationMs: 900,
      delayMs: 120,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: 0, scale: 0.6, rotate: -4 }),
        kf(0.45, { opacity: 0.85, scale: 1.08, rotate: 0 }),
        kf(1, { opacity: 1, scale: 1, rotate: 0 }),
      ],
      style: {
        _content: "Ink",
        _tag: "div",
        width: "200px",
        height: "200px",
        borderRadius: "18px",
        backgroundColor: "#0a0a0a",
        color: "#fafafa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "ui-serif, Georgia, serif",
        fontSize: "32px",
        letterSpacing: "0.02em",
        position: "relative",
      },
    }),
    // Settle pulse — a tiny scale oscillation that gives the ink its weight.
    draft("Ink Settle", {
      durationMs: 500,
      delayMs: 1020,
      easing: easingPreset("smooth"),
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        kf(0, { scale: 1 }),
        kf(0.5, { scale: 1.02 }),
        kf(1, { scale: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "200px",
        borderRadius: "18px",
        border: "1px solid rgba(10,10,10,0.08)",
        position: "absolute",
        top: "0",
        left: "0",
        pointerEvents: "none",
      },
    }),
  ],
};
