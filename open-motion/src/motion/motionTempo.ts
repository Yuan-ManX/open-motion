/** Motion tempo utilities — quantize animation timing to a musical beat grid. */

/** Supported beat divisions — how many slices per whole note. */
export const BEAT_DIVISIONS = [1, 2, 4, 8, 16] as const;
export type BeatDivision = (typeof BEAT_DIVISIONS)[number];

/** Human label for a division, e.g. 4 -> "1/4". */
export function divisionLabel(division: BeatDivision): string {
  return `1/${division}`;
}

/**
 * Milliseconds occupied by one beat division at a given tempo.
 * A "whole note" at BPM beats-per-minute lasts (60_000 / BPM) * 4 ms,
 * because a beat is a quarter note by convention. Each division slices
 * that whole note into `division` equal parts.
 */
export function divisionMs(bpm: number, division: BeatDivision): number {
  const wholeNoteMs = (60_000 / bpm) * 4;
  return wholeNoteMs / division;
}

/**
 * Pick the beat division whose duration is closest to `targetMs`.
 * Returns the division and its exact ms. Clamps to the supported range,
 * so very short durations land on sixteenths and very long ones on wholes.
 */
export function nearestDivision(
  targetMs: number,
  bpm: number,
): { division: BeatDivision; ms: number } {
  let best: { division: BeatDivision; ms: number } = {
    division: 4,
    ms: divisionMs(bpm, 4),
  };
  let bestDelta = Infinity;
  for (const d of BEAT_DIVISIONS) {
    const ms = divisionMs(bpm, d);
    const delta = Math.abs(ms - targetMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = { division: d, ms };
    }
  }
  return best;
}

/**
 * Snap a duration to the nearest beat division at the given tempo.
 * If `division` is supplied, snaps to that specific division (useful for
 * "lock everything to eighths"). Otherwise picks the closest division.
 * Always rounds to the nearest whole millisecond.
 */
export function quantizeDuration(
  ms: number,
  bpm: number,
  division?: BeatDivision,
): { ms: number; division: BeatDivision } {
  const div: BeatDivision =
    division ?? nearestDivision(ms, bpm).division;
  const snapped = Math.round(divisionMs(bpm, div));
  return { ms: snapped, division: div };
}

/**
 * Quantize a stagger interval between components so that cascading
 * entrances land exactly on the beat grid. Same semantics as
 * {@link quantizeDuration} but documented for the stagger use-case.
 */
export function quantizeStagger(
  staggerMs: number,
  bpm: number,
  division?: BeatDivision,
): { ms: number; division: BeatDivision } {
  return quantizeDuration(staggerMs, bpm, division);
}

/** Return true when a tempo is within the playable range. */
export function isValidTempo(bpm: number): boolean {
  return Number.isFinite(bpm) && bpm >= 20 && bpm <= 300;
}

/* ----------------------------- Phase & Polyrhythm ----------------------------- */
//
// Tempo + quantize lock *durations* to a beat grid. Phase locks *start times*
// to a musical position within a bar so components can move on the downbeat,
// the offbeat, or any beat in between. Layering several phases produces a
// polyrhythm — multiple streams of motion cycling at different rates against
// the same pulse, resolving back to the downbeat every cycle.

/** Beats per bar (4/4 assumed throughout). */
export const BEATS_PER_BAR = 4;

/** Milliseconds occupied by one beat (quarter note) at the given tempo. */
export function beatMs(bpm: number): number {
  return 60_000 / bpm;
}

/**
 * Named musical phases expressed as a beat offset from the downbeat within
 * one 4/4 bar. 0 = beat 1 (downbeat), 1 = beat 2 (backbeat), 0.5 = the "and"
 * of 1 (offbeat). These give the agent a vocabulary to speak in musical terms
 * instead of raw milliseconds.
 */
export const PHASE_LABELS: Readonly<Record<string, number>> = {
  downbeat: 0,
  beat1: 0,
  beat2: 1,
  beat3: 2,
  beat4: 3,
  backbeat: 1,
  offbeat: 0.5,
};

/** Resolve a phase label to a beat offset. Returns null when unknown. */
export function resolvePhaseLabel(label: string): number | null {
  const key = label.toLowerCase().trim();
  return key in PHASE_LABELS ? (PHASE_LABELS as Record<string, number>)[key] : null;
}

/**
 * Convert a musical phase (in beats from the downbeat) to a start delay in
 * milliseconds at the given tempo. A phase of 0.5 at 120 BPM yields 250ms —
 * the "and" of beat 1. Phase wraps within a bar so values >= 4 fold back,
 * and negative values wrap to their positive equivalent.
 */
export function phaseToDelayMs(bpm: number, phaseBeats: number): number {
  const wrapped =
    ((phaseBeats % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR;
  return Math.round(wrapped * beatMs(bpm));
}

/**
 * Distribute `count` events evenly across a polyrhythmic cycle of `cycleBeats`
 * beats and return each event's start delay in milliseconds. This is the
 * engine behind k:base polyrhythms — e.g. count=3, cycleBeats=2 produces the
 * 3:2 polyrhythm: three equally spaced events that resolve back to the
 * downbeat every two beats. `rotation` shifts the whole pattern by a phase
 * offset (in beats) so the cycle can start away from the downbeat.
 */
export function polyrhythmDelays(
  bpm: number,
  count: number,
  cycleBeats: number,
  rotation = 0,
): number[] {
  if (count <= 0) return [];
  const span = cycleBeats / count;
  const delays: number[] = [];
  for (let i = 0; i < count; i++) {
    delays.push(phaseToDelayMs(bpm, i * span + rotation));
  }
  return delays;
}

/**
 * Snap a start delay to the nearest beat division at the given tempo. Used
 * when a component should begin exactly on the grid rather than between
 * beats. A delay of 0 always lands on a downbeat regardless of division.
 * Returns the snapped delay and the division it landed on.
 */
export function quantizeDelay(
  delayMs: number,
  bpm: number,
  division?: BeatDivision,
): { ms: number; division: BeatDivision } {
  if (delayMs <= 0) return { ms: 0, division: division ?? 1 };
  const div: BeatDivision =
    division ?? nearestDivision(delayMs, bpm).division;
  const step = divisionMs(bpm, div);
  const snapped = Math.round(delayMs / step) * step;
  return { ms: Math.round(snapped), division: div };
}
