import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Tessera Tile Transition: an on-screen panel shatters into small square
// tesserae that spin off-screen, then the new scene's tesserae fly back to
// reassemble. Ideal for scene-to-scene replacement with a tactile feel.
export const tesseraTransitionTemplate: TemplateDef = {
  id: "tpl-tessera-transition",
  name: "Tessera Tile Transition",
  category: "transition",
  description: "Panel shatters into rotating tessera squares that scatter and return to assemble the replacement scene — segmented transition with tactile, craft-like tactility.",
  tags: ["transition", "tessera", "tiles", "shatter", "segmented", "craft", "assemble"],
  build: () => {
    const tiles: ReturnType<typeof draft>[] = [];
    const cols = 4;
    const rows = 3;
    const cellW = 48;
    const cellH = 52;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const idx = r * cols + c;
        const diag = r + c;
        const dx = (c - (cols - 1) / 2) * 180;
        const dy = (r - (rows - 1) / 2) * 200;
        const rot = ((idx % 4) - 1.5) * 90;
        tiles.push(
          draft(`Tessera ${idx + 1}`, {
            durationMs: 1300,
            delayMs: diag * 60,
            easing: easingPreset("ease-in-out"),
            iterationCount: 1,
            keyframes: [
              kf(0, { opacity: 1, translateX: 0, translateY: 0, rotateZ: 0, scale: 1 }),
              kf(0.35, { opacity: 0.85, translateX: dx * 0.5, translateY: dy * 0.5 - 18, rotateZ: rot * 0.5, scale: 0.82 }),
              kf(0.5, { opacity: 0, translateX: dx, translateY: dy - 60, rotateZ: rot, scale: 0.55 }),
              kf(0.65, { opacity: 0.85, translateX: dx * 0.5 * -1, translateY: dy * 0.5 * -1 + 18, rotateZ: rot * 0.5 * -1, scale: 0.82 }),
              kf(1, { opacity: 1, translateX: 0, translateY: 0, rotateZ: 0, scale: 1 }),
            ],
            style: {
              _content: "",
              _tag: "div",
              width: `${cellW}px`,
              height: `${cellH}px`,
              borderRadius: idx % 7 === 0 ? "8px" : "3px",
              background: idx % 2 === 0
                ? "linear-gradient(135deg, #1E293B 0%, #334155 100%)"
                : "linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)",
              boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
              position: "absolute",
              top: `${r * cellH}px`,
              left: `${c * cellW}px`,
            },
          }),
        );
      }
    }
    return tiles;
  },
};
