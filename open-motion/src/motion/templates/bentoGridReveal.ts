import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef, type ComponentDraft } from "./helper.js";

// Bento Grid Reveal: staggered pop-in grid of miniature cards, perfect for
// dashboard onboarding or feature presentation. Each tile lands in diagonal
// order so the user's eye travels across the grid naturally.
export const bentoGridRevealTemplate: TemplateDef = {
  id: "tpl-bento-grid",
  name: "Bento Grid Reveal",
  category: "entrance",
  description: "Staggered diagonal pop-in across a 3x3 bento card grid — tiles land with scale bounce, onboarding dashboard content one diagonal at a time.",
  tags: ["entrance", "bento", "grid", "stagger", "dashboard", "tiles", "cards", "onboarding"],
  build: () => {
    const tiles: ReturnType<typeof draft>[] = [];
    const tileStyle = (bg: string, rows: number, cols: number) => ({
      _content: "",
      _tag: "div",
      width: `${cols === 2 ? 170 : 80}px`,
      height: `${rows === 2 ? 170 : 80}px`,
      borderRadius: "14px",
      background: bg,
      boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
    });

    const configs = [
      { bg: "linear-gradient(135deg, #1E293B 0%, #334155 100%)", rows: 2, cols: 2, stagger: 0 },
      { bg: "linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)", rows: 1, cols: 1, stagger: 80 },
      { bg: "linear-gradient(135deg, #10B981 0%, #34D399 100%)", rows: 1, cols: 1, stagger: 160 },
      { bg: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)", rows: 1, cols: 1, stagger: 240 },
      { bg: "linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)", rows: 2, cols: 1, stagger: 320 },
      { bg: "linear-gradient(135deg, #EC4899 0%, #F472B6 100%)", rows: 1, cols: 2, stagger: 400 },
      { bg: "linear-gradient(135deg, #EF4444 0%, #F87171 100%)", rows: 1, cols: 1, stagger: 480 },
    ];

    for (let i = 0; i < configs.length; i += 1) {
      const c = configs[i];
      const delay = c.stagger;
      tiles.push(
        draft(`Bento Tile ${i + 1}`, {
          durationMs: 900,
          delayMs: delay,
          easing: easingPreset("ease-out-cubic"),
          iterationCount: 1,
          keyframes: [
            kf(0, { opacity: 0, scale: 0.6, translateY: 22 }),
            kf(0.7, { opacity: 1, scale: 1.04, translateY: -2 }),
            kf(1, { opacity: 1, scale: 1, translateY: 0 }),
          ],
          style: tileStyle(c.bg, c.rows, c.cols) as ComponentDraft["style"],
        }),
      );
    }
    return tiles;
  },
};
