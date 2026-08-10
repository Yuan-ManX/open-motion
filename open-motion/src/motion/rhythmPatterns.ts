/** Rhythm Patterns — applies musical timing concepts (syncopation, swing, rubato, polyrhythm) to motion sequences. */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Rhythm pattern identifier. */
export type RhythmId =
  | "steady-beat"
  | "syncopated"
  | "swing"
  | "rubato"
  | "polyrhythm-3-2"
  | "gallop"
  | "waltz"
  | "fanfare"
  | "heartbeat"
  | "wave-flow"
  | "accelerando"
  | "decelerando";

/** A rhythm pattern definition. */
export interface RhythmPattern {
  id: RhythmId;
  name: string;
  description: string;
  /** Musical category. */
  category: "metric" | "expressive" | "biological" | "compound";
  /** Base tempo in BPM. */
  bpm: number;
  /** Number of beats per measure. */
  beatsPerMeasure: number;
  /** Beat value (4 = quarter note, 8 = eighth note). */
  beatValue: number;
  /** Timing multipliers for each beat position (1.0 = on beat). */
  beatMultipliers: number[];
  /** Accent pattern — which beats are emphasized (0-1). */
  accents: number[];
  /** Tags for search. */
  tags: string[];
}

/** A computed rhythm timing result. */
export interface RhythmTiming {
  /** Pattern id used. */
  patternId: RhythmId;
  /** Computed beat times in milliseconds. */
  beatTimes: number[];
  /** Accent values for each beat. */
  beatAccents: number[];
  /** Total duration in milliseconds. */
  totalDurationMs: number;
  /** Number of beats. */
  beatCount: number;
  /** Effective BPM. */
  bpm: number;
}

// ---------------------------------------------------------------------------
// Rhythm Pattern Library
// ---------------------------------------------------------------------------

const RHYTHM_PATTERNS: RhythmPattern[] = [
  {
    id: "steady-beat",
    name: "Steady Beat",
    description: "Uniform, metronomic timing. Every beat has equal duration and accent.",
    category: "metric",
    bpm: 120,
    beatsPerMeasure: 4,
    beatValue: 4,
    beatMultipliers: [1.0, 1.0, 1.0, 1.0],
    accents: [1.0, 0.5, 0.7, 0.5],
    tags: ["uniform", "regular", "basic", "metronomic"],
  },
  {
    id: "syncopated",
    name: "Syncopated",
    description: "Off-beat emphasis creating unexpected, jazzy timing. Beats shift to create tension and release.",
    category: "expressive",
    bpm: 110,
    beatsPerMeasure: 4,
    beatValue: 4,
    beatMultipliers: [0.75, 1.25, 0.75, 1.25],
    accents: [0.5, 1.0, 0.3, 1.0],
    tags: ["jazz", "off-beat", "unexpected", "groove"],
  },
  {
    id: "swing",
    name: "Swing",
    description: "Classic swing feel with long-short pairings. First beat longer, second shorter.",
    category: "expressive",
    bpm: 100,
    beatsPerMeasure: 4,
    beatValue: 4,
    beatMultipliers: [1.33, 0.67, 1.33, 0.67],
    accents: [0.9, 0.4, 0.8, 0.4],
    tags: ["jazz", "swing", "groove", "blues"],
  },
  {
    id: "rubato",
    name: "Rubato",
    description: "Expressive timing with temporal freedom. Speeds up and slows down for emotional effect.",
    category: "expressive",
    bpm: 90,
    beatsPerMeasure: 4,
    beatValue: 4,
    beatMultipliers: [1.2, 0.8, 1.4, 0.6],
    accents: [0.7, 0.5, 0.9, 0.4],
    tags: ["expressive", "free", "romantic", "emotional"],
  },
  {
    id: "polyrhythm-3-2",
    name: "Polyrhythm 3:2",
    description: "Three-against-two cross-rhythm creating complex, layered timing.",
    category: "compound",
    bpm: 105,
    beatsPerMeasure: 6,
    beatValue: 8,
    beatMultipliers: [1.0, 0.67, 1.0, 0.67, 1.0, 0.67],
    accents: [1.0, 0.3, 0.6, 0.3, 0.8, 0.3],
    tags: ["polyrhythm", "complex", "layered", "cross-rhythm"],
  },
  {
    id: "gallop",
    name: "Gallop",
    description: "Dotted rhythm creating a forward-moving gallop feel. Long-short-short pattern.",
    category: "metric",
    bpm: 130,
    beatsPerMeasure: 3,
    beatValue: 8,
    beatMultipliers: [1.5, 0.75, 0.75],
    accents: [1.0, 0.5, 0.5],
    tags: ["dotted", "forward", "energetic", "horse"],
  },
  {
    id: "waltz",
    name: "Waltz",
    description: "Classic 3/4 time with strong downbeat. Elegant, flowing triple meter.",
    category: "metric",
    bpm: 85,
    beatsPerMeasure: 3,
    beatValue: 4,
    beatMultipliers: [1.0, 1.0, 1.0],
    accents: [1.0, 0.4, 0.5],
    tags: ["3-4", "triple", "elegant", "ballroom"],
  },
  {
    id: "fanfare",
    name: "Fanfare",
    description: "Triumphant rhythm with long holds and quick releases. Heraldic and bold.",
    category: "metric",
    bpm: 115,
    beatsPerMeasure: 4,
    beatValue: 4,
    beatMultipliers: [2.0, 0.5, 1.5, 1.0],
    accents: [1.0, 0.6, 0.9, 0.5],
    tags: ["triumphant", "bold", "heraldic", "announcement"],
  },
  {
    id: "heartbeat",
    name: "Heartbeat",
    description: "Biological rhythm mimicking a human heartbeat. Double-pulse with rest.",
    category: "biological",
    bpm: 72,
    beatsPerMeasure: 2,
    beatValue: 4,
    beatMultipliers: [0.6, 1.4],
    accents: [1.0, 0.7],
    tags: ["biological", "organic", "pulse", "life"],
  },
  {
    id: "wave-flow",
    name: "Wave Flow",
    description: "Sine-based timing creating wave-like flow. Smooth accelerations and decelerations.",
    category: "expressive",
    bpm: 95,
    beatsPerMeasure: 4,
    beatValue: 4,
    beatMultipliers: [1.2, 0.8, 1.2, 0.8],
    accents: [0.6, 0.8, 0.6, 0.9],
    tags: ["wave", "flow", "smooth", "organic"],
  },
  {
    id: "accelerando",
    name: "Accelerando",
    description: "Gradually speeding up. Each beat is shorter than the previous, building momentum.",
    category: "expressive",
    bpm: 100,
    beatsPerMeasure: 4,
    beatValue: 4,
    beatMultipliers: [1.4, 1.2, 0.9, 0.5],
    accents: [0.5, 0.6, 0.8, 1.0],
    tags: ["accelerating", "building", "momentum", "crescendo"],
  },
  {
    id: "decelerando",
    name: "Decelerando",
    description: "Gradually slowing down. Each beat is longer, creating a relaxing, settling feel.",
    category: "expressive",
    bpm: 100,
    beatsPerMeasure: 4,
    beatValue: 4,
    beatMultipliers: [0.5, 0.9, 1.2, 1.4],
    accents: [1.0, 0.8, 0.6, 0.5],
    tags: ["decelerating", "settling", "relaxing", "ritardando"],
  },
];

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/** List all rhythm patterns. */
export function listRhythmPatterns(): RhythmPattern[] {
  return RHYTHM_PATTERNS;
}

/** Get a rhythm pattern by id. */
export function getRhythmPattern(id: RhythmId): RhythmPattern | undefined {
  return RHYTHM_PATTERNS.find((p) => p.id === id);
}

/** Get patterns by category. */
export function getRhythmPatternsByCategory(category: RhythmPattern["category"]): RhythmPattern[] {
  return RHYTHM_PATTERNS.filter((p) => p.category === category);
}

/**
 * Compute timing for a rhythm pattern.
 * Returns absolute beat times in milliseconds.
 */
export function computeRhythmTiming(
  patternId: RhythmId,
  options?: {
    /** Number of beats to generate. Defaults to one measure. */
    beatCount?: number;
    /** Override BPM. */
    bpm?: number;
    /** Scale factor for all durations. */
    scale?: number;
  },
): RhythmTiming {
  const pattern = getRhythmPattern(patternId);
  if (!pattern) {
    throw new Error(`Unknown rhythm pattern: ${patternId}`);
  }

  const bpm = options?.bpm ?? pattern.bpm;
  const scale = options?.scale ?? 1;
  const beatCount = options?.beatCount ?? pattern.beatsPerMeasure;

  // Base beat duration in ms
  const baseBeatMs = (60000 / bpm) * (4 / pattern.beatValue);

  const beatTimes: number[] = [];
  const beatAccents: number[] = [];
  let currentTime = 0;

  for (let i = 0; i < beatCount; i++) {
    const multiplierIndex = i % pattern.beatMultipliers.length;
    const accentIndex = i % pattern.accents.length;

    beatTimes.push(Math.round(currentTime * scale));
    beatAccents.push(pattern.accents[accentIndex]);

    currentTime += baseBeatMs * pattern.beatMultipliers[multiplierIndex];
  }

  return {
    patternId,
    beatTimes,
    beatAccents,
    totalDurationMs: Math.round(currentTime * scale),
    beatCount,
    bpm,
  };
}

/**
 * Apply a rhythm pattern to a set of items.
 * Returns stagger delays for each item based on the rhythm.
 */
export function applyRhythmToItems(
  patternId: RhythmId,
  itemCount: number,
  options?: {
    bpm?: number;
    scale?: number;
    /** Whether to start from beat 0 or offset. */
    startBeat?: number;
  },
): { delays: number[]; accents: number[]; totalMs: number } {
  const timing = computeRhythmTiming(patternId, {
    beatCount: itemCount,
    bpm: options?.bpm,
    scale: options?.scale,
  });

  const startBeat = options?.startBeat ?? 0;
  const startOffset = timing.beatTimes[startBeat] ?? 0;

  const delays = timing.beatTimes.map((t) => t - startOffset);
  const accents = timing.beatAccents;

  return {
    delays,
    accents,
    totalMs: timing.totalDurationMs - startOffset,
  };
}

/**
 * Detect the best rhythm pattern for a description.
 * Uses keyword matching against pattern names and tags.
 */
export function detectRhythm(description: string): RhythmId {
  const lower = description.toLowerCase();

  if (/\b(syncopat|off.?beat|jazz)\b/.test(lower)) return "syncopated";
  if (/\b(swing|groove|blues)\b/.test(lower)) return "swing";
  if (/\b(rubato|free|expressive|emotional)\b/.test(lower)) return "rubato";
  if (/\b(polyrhythm|cross.?rhythm|complex)\b/.test(lower)) return "polyrhythm-3-2";
  if (/\b(gallop|dotted|forward|running)\b/.test(lower)) return "gallop";
  if (/\b(waltz|3\/4|triple|elegant)\b/.test(lower)) return "waltz";
  if (/\b(fanfare|triumphant|herald|announce)\b/.test(lower)) return "fanfare";
  if (/\b(heartbeat|pulse|biological|life|cardiac)\b/.test(lower)) return "heartbeat";
  if (/\b(wave|flow|smooth|fluid)\b/.test(lower)) return "wave-flow";
  if (/\b(accelerat|speed.?up|build|crescendo)\b/.test(lower)) return "accelerando";
  if (/\b(decelerat|slow.?down|settle|relax|ritard)\b/.test(lower)) return "decelerando";

  return "steady-beat";
}

/**
 * Get a human-readable summary of a rhythm pattern.
 */
export function summarizeRhythm(pattern: RhythmPattern): string {
  const lines: string[] = [];
  lines.push(`Rhythm: "${pattern.name}" (${pattern.category})`);
  lines.push(`Description: ${pattern.description}`);
  lines.push(`Tempo: ${pattern.bpm} BPM, ${pattern.beatsPerMeasure}/${pattern.beatValue} time`);
  lines.push(`Beat pattern: ${pattern.beatMultipliers.map((m) => m.toFixed(2)).join(" | ")}`);
  lines.push(`Accents: ${pattern.accents.map((a) => `${Math.round(a * 100)}%`).join(" | ")}`);
  return lines.join("\n");
}

/**
 * Generate a rhythm visualization as text.
 * Shows the beat pattern with accents.
 */
export function visualizeRhythm(timing: RhythmTiming): string {
  const pattern = getRhythmPattern(timing.patternId);
  if (!pattern) return "Unknown pattern";

  const lines: string[] = [];
  lines.push(`Rhythm: ${pattern.name} at ${timing.bpm} BPM`);
  lines.push("");

  // Create a visual representation
  const maxBars = 32;
  const beatsPerLine = 4;

  for (let i = 0; i < timing.beatCount; i++) {
    if (i % beatsPerLine === 0 && i > 0) lines.push("");

    const accent = timing.beatAccents[i] ?? 0.5;
    const barCount = Math.max(1, Math.round(accent * maxBars));
    const bar = "█".repeat(barCount) + "░".repeat(maxBars - barCount);

    const time = timing.beatTimes[i] ?? 0;
    lines.push(`Beat ${String(i + 1).padStart(2, "0")} |${bar}| ${time.toString().padStart(5)}ms ${Math.round(accent * 100)}%`);
  }

  lines.push("");
  lines.push(`Total: ${timing.totalDurationMs}ms across ${timing.beatCount} beats`);

  return lines.join("\n");
}
