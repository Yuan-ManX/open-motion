import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// A perpetual levitating idle motion: the surface bobs gently on a vertical
// axis while a soft ground shadow shrinks and grows in sync, giving the
// element a weightless, breathable presence without any user interaction.
export const floatTemplate: TemplateDef = {
  id: "tpl-float",
  name: "Float",
  category: "load",
  description: "Weightless levitation — a gentle vertical bob paired with a breathing ground shadow, so an idle element feels suspended and alive.",
  tags: ["float", "levitate", "bob", "idle", "suspended", "hover", "shadow", "weightless"],
  build: () => [
    draft("Floating Body", {
      durationMs: 3200,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { translateY: "0%" }),
        kf(0.5, { translateY: "-18%" }),
        kf(1, { translateY: "0%" }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0%, rgba(180,200,255,0.7) 45%, rgba(120,150,255,0.4) 100%)",
        boxShadow: "0 12px 28px rgba(90,120,255,0.35)",
      },
    }),
    draft("Ground Shadow", {
      durationMs: 3200,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { scale: 1, opacity: 0.55 }),
        kf(0.5, { scale: 0.7, opacity: 0.3 }),
        kf(1, { scale: 1, opacity: 0.55 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "90px",
        height: "18px",
        borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 70%)",
        position: "absolute",
        bottom: "-28px",
        left: "15px",
      },
    }),
  ],
};