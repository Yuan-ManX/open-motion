import { create } from "zustand";
import type { MotionComponent } from "@openmotion/shared";

interface ClipboardEntry {
  name: string;
  easing: MotionComponent["easing"];
  durationMs: number;
  delayMs: number;
  iterationCount: number | "infinite";
  direction: MotionComponent["direction"];
  fillMode: MotionComponent["fillMode"];
  playState: MotionComponent["playState"];
  keyframes: MotionComponent["keyframes"];
  style: Record<string, string | number>;
  trigger: MotionComponent["trigger"];
}

interface ClipboardState {
  entries: ClipboardEntry[];
  copy: (components: MotionComponent[]) => void;
  hasContent: () => boolean;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  entries: [],
  copy: (components) => {
    set({
      entries: components.map((c) => ({
        name: c.name,
        easing: c.easing,
        durationMs: c.durationMs,
        delayMs: c.delayMs,
        iterationCount: c.iterationCount,
        direction: c.direction,
        fillMode: c.fillMode,
        playState: c.playState,
        keyframes: c.keyframes,
        style: { ...(c.style as Record<string, string | number>) },
        trigger: c.trigger,
      })),
    });
  },
  hasContent: () => get().entries.length > 0,
}));
