/**
 * Motion Storyboard — a narrative timeline system that sequences motions into
 * a story. Each beat represents a moment in the animation sequence with a
 * title, description, duration, scene reference, and component references.
 *
 * Storyboards help designers plan motion sequences before implementation,
 * ensuring the narrative flow is coherent before tuning individual components.
 */

import { createId } from "../utils/id.js";

export interface StoryboardBeat {
  id: string;
  title: string;
  description: string;
  durationMs: number;
  sceneId: string | null;
  componentIds: string[];
  transition: "cut" | "fade" | "slide" | "zoom" | "dissolve" | "wipe";
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardSummary {
  id: string;
  title: string;
  description: string;
  durationMs: number;
  transition: string;
  componentCount: number;
  order: number;
}

const STORYBOARD_KEY = "__storyboard";

/** Read all storyboard beats from project tokens. */
export function readBeats(tokens: Record<string, string | number>): StoryboardBeat[] {
  const raw = tokens[STORYBOARD_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoryboardBeat[];
  } catch {
    return [];
  }
}

/** Write storyboard beats to project tokens. */
export function writeBeats(
  tokens: Record<string, string | number>,
  beats: StoryboardBeat[],
): Record<string, string | number> {
  return { ...tokens, [STORYBOARD_KEY]: JSON.stringify(beats) };
}

/** Find a single beat by id. */
export function findBeat(
  tokens: Record<string, string | number>,
  beatId: string,
): StoryboardBeat | undefined {
  return readBeats(tokens).find((b) => b.id === beatId);
}

/** Create a new storyboard beat. */
export function createBeat(
  tokens: Record<string, string | number>,
  input: {
    title: string;
    description?: string;
    durationMs?: number;
    sceneId?: string | null;
    componentIds?: string[];
    transition?: StoryboardBeat["transition"];
  },
): { beat: StoryboardBeat; tokens: Record<string, string | number> } {
  const beats = readBeats(tokens);
  const now = new Date().toISOString();
  const beat: StoryboardBeat = {
    id: createId("beat_"),
    title: input.title,
    description: input.description ?? "",
    durationMs: input.durationMs ?? 1000,
    sceneId: input.sceneId ?? null,
    componentIds: input.componentIds ?? [],
    transition: input.transition ?? "fade",
    order: beats.length,
    createdAt: now,
    updatedAt: now,
  };
  const updated = [...beats, beat];
  return { beat, tokens: writeBeats(tokens, updated) };
}

/** Update a storyboard beat. */
export function updateBeat(
  tokens: Record<string, string | number>,
  beatId: string,
  patch: Partial<Pick<StoryboardBeat, "title" | "description" | "durationMs" | "sceneId" | "componentIds" | "transition">>,
): { beat: StoryboardBeat | null; tokens: Record<string, string | number> } {
  const beats = readBeats(tokens);
  const idx = beats.findIndex((b) => b.id === beatId);
  if (idx === -1) return { beat: null, tokens };
  const updated: StoryboardBeat = {
    ...beats[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  beats[idx] = updated;
  return { beat: updated, tokens: writeBeats(tokens, beats) };
}

/** Delete a storyboard beat and reindex order. */
export function deleteBeat(
  tokens: Record<string, string | number>,
  beatId: string,
): Record<string, string | number> {
  const beats = readBeats(tokens).filter((b) => b.id !== beatId);
  const reindexed = beats
    .sort((a, b) => a.order - b.order)
    .map((b, i) => ({ ...b, order: i }));
  return writeBeats(tokens, reindexed);
}

/** Reorder beats by an explicit id sequence. */
export function reorderBeats(
  tokens: Record<string, string | number>,
  beatIds: string[],
): Record<string, string | number> {
  const beats = readBeats(tokens);
  const reordered: StoryboardBeat[] = [];
  for (let i = 0; i < beatIds.length; i++) {
    const beat = beats.find((b) => b.id === beatIds[i]);
    if (beat) {
      reordered.push({ ...beat, order: i });
    }
  }
  for (const beat of beats) {
    if (!beatIds.includes(beat.id)) {
      reordered.push({ ...beat, order: reordered.length });
    }
  }
  return writeBeats(tokens, reordered);
}

/** Summarize beats for compact listing. */
export function summarizeBeats(
  tokens: Record<string, string | number>,
): StoryboardSummary[] {
  return readBeats(tokens)
    .sort((a, b) => a.order - b.order)
    .map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      durationMs: b.durationMs,
      transition: b.transition,
      componentCount: b.componentIds.length,
      order: b.order,
    }));
}

/** Export the storyboard as Markdown. */
export function exportStoryboardMarkdown(
  tokens: Record<string, string | number>,
): string {
  const beats = readBeats(tokens).sort((a, b) => a.order - b.order);
  if (beats.length === 0) return "# Motion Storyboard\n\nNo beats defined.\n";

  const totalMs = beats.reduce((sum, b) => sum + b.durationMs, 0);
  let md = "# Motion Storyboard\n\n";
  md += `**Total beats:** ${beats.length}  \n`;
  md += `**Total duration:** ${(totalMs / 1000).toFixed(1)}s  \n`;
  md += `**Transitions:** ${beats.map((b) => b.transition).join(" → ")}\n\n`;
  md += "---\n\n";

  let cumulativeMs = 0;
  for (const beat of beats) {
    const startSec = (cumulativeMs / 1000).toFixed(1);
    const endSec = ((cumulativeMs + beat.durationMs) / 1000).toFixed(1);
    md += `## Beat ${beat.order + 1}: ${beat.title}\n\n`;
    md += `**Time:** ${startSec}s → ${endSec}s (${beat.durationMs}ms)  \n`;
    md += `**Transition:** ${beat.transition}  \n`;
    if (beat.sceneId) md += `**Scene:** ${beat.sceneId}  \n`;
    if (beat.componentIds.length > 0) {
      md += `**Components:** ${beat.componentIds.length} component(s)  \n`;
    }
    if (beat.description) {
      md += `\n${beat.description}\n`;
    }
    md += "\n";
    cumulativeMs += beat.durationMs;
  }

  return md;
}

/** Export the storyboard as JSON. */
export function exportStoryboardJson(
  tokens: Record<string, string | number>,
): string {
  const beats = readBeats(tokens).sort((a, b) => a.order - b.order);
  const totalMs = beats.reduce((sum, b) => sum + b.durationMs, 0);
  return JSON.stringify(
    {
      totalBeats: beats.length,
      totalDurationMs: totalMs,
      beats: beats.map((b) => ({
        order: b.order,
        title: b.title,
        description: b.description,
        durationMs: b.durationMs,
        transition: b.transition,
        sceneId: b.sceneId,
        componentIds: b.componentIds,
      })),
    },
    null,
    2,
  );
}

/** Get storyboard statistics. */
export function getStoryboardStats(
  tokens: Record<string, string | number>,
): {
  totalBeats: number;
  totalDurationMs: number;
  transitions: string[];
  componentRefs: number;
} {
  const beats = readBeats(tokens);
  return {
    totalBeats: beats.length,
    totalDurationMs: beats.reduce((sum, b) => sum + b.durationMs, 0),
    transitions: [...new Set(beats.map((b) => b.transition))],
    componentRefs: beats.reduce((sum, b) => sum + b.componentIds.length, 0),
  };
}
