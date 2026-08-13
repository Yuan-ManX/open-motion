import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Aurora stroll — two aurora layers drift horizontally at different rates,
// while a silhouetted foreground card slides in from the left with a
// staggered parallax. The result evokes calm, cinematic landscapes — great
// for onboarding headers or any scene that should feel vast and quiet.
export const auroraStrollTemplate: TemplateDef = {
  id: "tpl-aurora-stroll",
  name: "Aurora Stroll",
  category: "entrance",
  description: "Dual aurora curtains drift horizontally while a card strolls in with parallax — calm, cinematic, vast.",
  tags: ["aurora", "stroll", "cinematic", "drift", "calm", "landscape", "header", "onboarding", "serene"],
  build: () => [
    draft("Aurora Curtain A", {
      durationMs: 12000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateX: "-15%", opacity: 0.85 }),
        kf(1, { translateX: "15%", opacity: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "520px",
        height: "260px",
        borderRadius: "50%",
        background:
          "radial-gradient(ellipse at 30% 50%, rgba(74,222,128,0.55) 0%, rgba(14,165,233,0.35) 45%, transparent 75%)",
        filter: "blur(30px)",
      },
    }),
    draft("Aurora Curtain B", {
      durationMs: 9000,
      easing: easingPreset("linear"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateX: "12%", opacity: 0.7 }),
        kf(1, { translateX: "-18%", opacity: 0.8 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "460px",
        height: "220px",
        borderRadius: "50%",
        background:
          "radial-gradient(ellipse at 60% 45%, rgba(167,139,250,0.5) 0%, rgba(236,72,153,0.25) 45%, transparent 75%)",
        filter: "blur(36px)",
      },
    }),
    draft("Strolling Card", {
      durationMs: 1800,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      direction: "normal",
      keyframes: [
        kf(0, { translateX: "-100%", opacity: 0 }),
        kf(0.7, { translateX: "6%", opacity: 1 }),
        kf(1, { translateX: "0%", opacity: 1 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "320px",
        height: "160px",
        borderRadius: "24px",
        background: "rgba(15,23,42,0.82)",
        backdropFilter: "blur(14px)",
        boxShadow: "0 20px 60px rgba(15,23,42,0.35)",
        border: "1px solid rgba(148,163,184,0.18)",
      },
    }),
  ],
};
