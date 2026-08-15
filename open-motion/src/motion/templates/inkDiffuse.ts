import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef, type ComponentDraft } from "./helper.js";

// Ink Diffuse: viscous ink-like blob spreads across the page perimeter
// then pulls back to reveal content underneath — works great for modal
// overlays or section headers where content needs a dramatic reveal window.
export const inkDiffuseTemplate: TemplateDef = {
  id: "tpl-ink-diffuse",
  name: "Ink Diffuse",
  category: "transition",
  description: "An ink-like viscous blob seeps along the perimeter of the panel, then contracts — cleanly revealing the content sitting underneath, as if the ink dried and retracted.",
  tags: ["transition", "ink", "diffuse", "blob", "viscous", "seep", "overlay", "reveal"],
  build: () => {
    // Four perimeter blobs that converge then contract.
    const blobs: ReturnType<typeof draft>[] = [];
    const positions = [
      { top: "0", left: "0", borderRadius: "0 0 100% 0", corner: "tl" },
      { top: "0", right: "0", borderRadius: "0 0 0 100%", corner: "tr" },
      { bottom: "0", right: "0", borderRadius: "100% 0 0 0", corner: "br" },
      { bottom: "0", left: "0", borderRadius: "0 100% 0 0", corner: "bl" },
    ];
    for (let i = 0; i < positions.length; i += 1) {
      const p = positions[i];
      blobs.push(
        draft(`Ink Blob ${p.corner.toUpperCase()}`, {
          durationMs: 1700,
          delayMs: i * 90,
          easing: easingPreset("ease-in-out"),
          iterationCount: 1,
          keyframes: [
            // Phase 1: ooze across the perimeter
            kf(0, { scale: 0.2, opacity: 0.9 }),
            kf(0.35, { scale: 1.05, opacity: 0.98 }),
            kf(0.55, { scale: 1.3, opacity: 1 }),
            // Phase 2: contract back to corner (reveal)
            kf(0.7, { scale: 1.2, opacity: 0.95 }),
            kf(0.9, { scale: 0.3, opacity: 0.55 }),
            kf(1, { scale: 0.05, opacity: 0 }),
          ],
          style: {
            _content: "",
            _tag: "div",
            width: "220px",
            height: "220px",
            borderRadius: p.borderRadius,
            background: `radial-gradient(circle at ${p.corner.includes("l") ? "0%" : "100%"} ${p.corner.includes("t") ? "0%" : "100%"}, #0A0A0A 0%, #1F2937 40%, #374151 75%, rgba(55,65,81,0.6) 100%)`,
            position: "absolute",
            top: p.top,
            left: p.left,
            right: p.right,
            bottom: p.bottom,
            mixBlendMode: "multiply",
          } as ComponentDraft["style"],
        }),
      );
    }
    // Central content sits "underneath" and snaps to full opacity once inks retract.
    const content = draft("Revealed Window", {
      durationMs: 1700,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.9, blur: 12 }),
        kf(0.55, { opacity: 0, scale: 0.94, blur: 10 }),
        kf(0.72, { opacity: 0.8, scale: 1.01, blur: 2 }),
        kf(1, { opacity: 1, scale: 1, blur: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "280px",
        height: "180px",
        borderRadius: "22px",
        background: "linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 50%, #CBD5E1 100%)",
        boxShadow: "0 20px 50px rgba(15,23,42,0.25), inset 0 1px 0 rgba(255,255,255,0.8)",
        border: "1px solid rgba(255,255,255,0.7)",
      },
    });
    return [content, ...blobs];
  },
};
