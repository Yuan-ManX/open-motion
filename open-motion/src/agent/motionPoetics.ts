/** Motion Poetics Engine — applies poetic meter and form to motion. */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A poetic foot classification. */
export type PoeticFoot =
  | "iamb"      // unstressed-STRESSED (short-long)
  | "trochee"   // STRESSED-unstressed (long-short)
  | "dactyl"    // STRESSED-unstressed-unstressed (long-short-short)
  | "anapest"   // unstressed-unstressed-STRESSED (short-short-long)
  | "spondee"   // STRESSED-STRESSED (long-long)
  | "pyrrhic";  // unstressed-unstressed (short-short)

/** A detected poetic foot in the composition. */
export interface FootInstance {
  /** Index of the foot in the meter. */
  index: number;
  /** The foot type. */
  foot: PoeticFoot;
  /** Component ids participating in this foot. */
  componentIds: string[];
  /** Duration ratio (short:long) — 1.0 = equal, >1 = first longer. */
  durationRatio: number;
  /** Start time in ms. */
  startMs: number;
}

/** A stanza (grouped set of motions). */
export interface Stanza {
  index: number;
  /** Component ids in this stanza. */
  componentIds: string[];
  /** Start time in ms. */
  startMs: number;
  /** End time in ms. */
  endMs: number;
  /** Number of "feet" in this stanza. */
  footCount: number;
  /** Whether the stanza ends with a caesura (pause). */
  endsWithCaesura: boolean;
}

/** Poetic analysis result. */
export interface PoeticAnalysis {
  /** Detected feet. */
  feet: FootInstance[];
  /** Detected stanzas. */
  stanzas: Stanza[];
  /** Dominant meter (e.g., "iambic pentameter"). */
  dominantMeter: string;
  /** Dominant foot type. */
  dominantFoot: PoeticFoot;
  /** Average feet per stanza. */
  avgFeetPerStanza: number;
  /** Rhythmic regularity 0..1 (1 = perfectly regular meter). */
  regularity: number;
  /** Detected caesuras (pauses). */
  caesuras: Array<{ timeMs: number; durationMs: number }>;
  /** Detected enjambments (flow across stanza boundaries). */
  enjambments: Array<{ fromStanza: number; toStanza: number }>;
  /** Poetic form classification. */
  form: "free-verse" | "blank-verse" | "haiku" | "sonnet" | "ballad" | "structured";
  /** Rhythmic tempo classification. */
  tempo: "largo" | "adagio" | "andante" | "moderato" | "allegro" | "presto";
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Foot Detection
// ---------------------------------------------------------------------------

/**
 * Classify a pair of durations as a poetic foot.
 */
function classifyFoot(firstDuration: number, secondDuration: number): PoeticFoot {
  const ratio = firstDuration / secondDuration;

  // Thresholds for stressed (long) vs unstressed (short)
  if (ratio < 0.6) {
    // short-long = iamb
    return "iamb";
  }
  if (ratio > 1.4) {
    // long-short = trochee
    return "trochee";
  }
  // Roughly equal — spondee
  return "spondee";
}

/**
 * Classify a triple of durations as a poetic foot.
 */
function classifyTripleFoot(
  a: number,
  b: number,
  c: number,
): PoeticFoot {
  const med = median3(a, b, c);
  const avgShort = (Math.min(a, b, c) + med) / 2;
  const longest = Math.max(a, b, c);

  if (longest === a && b < avgShort && c < avgShort) return "dactyl";   // long-short-short
  if (longest === c && a < avgShort && b < avgShort) return "anapest";  // short-short-long
  return "spondee"; // No clear pattern
}

/** Compute the median of three numbers. */
function median3(a: number, b: number, c: number): number {
  return [a, b, c].sort((x, y) => x - y)[1];
}

// ---------------------------------------------------------------------------
// Stanza Detection
// ---------------------------------------------------------------------------

/**
 * Detect stanzas by clustering components with small temporal gaps.
 */
function detectStanzas(components: MotionComponent[]): Stanza[] {
  if (components.length === 0) return [];

  const sorted = [...components].sort((a, b) => a.delayMs - b.delayMs);
  const stanzas: Stanza[] = [];
  let currentGroup: MotionComponent[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = curr.delayMs - (prev.delayMs + prev.durationMs);

    // New stanza if gap > 500ms
    if (gap > 500) {
      stanzas.push(buildStanza(currentGroup, stanzas.length));
      currentGroup = [curr];
    } else {
      currentGroup.push(curr);
    }
  }
  if (currentGroup.length > 0) {
    stanzas.push(buildStanza(currentGroup, stanzas.length));
  }

  return stanzas;
}

/** Build a stanza from a group of components. */
function buildStanza(group: MotionComponent[], index: number): Stanza {
  const start = Math.min(...group.map((c) => c.delayMs));
  const end = Math.max(...group.map((c) => c.delayMs + c.durationMs));
  const footCount = Math.floor(group.length / 2);

  // Check for caesura (gap within the stanza > 300ms)
  let endsWithCaesura = false;
  if (group.length >= 2) {
    const last = group[group.length - 1];
    const secondLast = group[group.length - 2];
    const gap = last.delayMs - (secondLast.delayMs + secondLast.durationMs);
    endsWithCaesura = gap > 300;
  }

  return {
    index,
    componentIds: group.map((c) => c.id),
    startMs: start,
    endMs: end,
    footCount,
    endsWithCaesura,
  };
}

// ---------------------------------------------------------------------------
// Caesura and Enjambment Detection
// ---------------------------------------------------------------------------

/** Detect caesuras (internal pauses). */
function detectCaesuras(components: MotionComponent[]): Array<{ timeMs: number; durationMs: number }> {
  const caesuras: Array<{ timeMs: number; durationMs: number }> = [];
  const sorted = [...components].sort((a, b) => a.delayMs - b.delayMs);

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].delayMs - (sorted[i - 1].delayMs + sorted[i - 1].durationMs);
    if (gap > 200 && gap <= 500) {
      // Internal pause (not a stanza break)
      caesuras.push({
        timeMs: sorted[i - 1].delayMs + sorted[i - 1].durationMs,
        durationMs: gap,
      });
    }
  }
  return caesuras;
}

/** Detect enjambments (motion flowing across stanza boundaries). */
function detectEnjambments(stanzas: Stanza[]): Array<{ fromStanza: number; toStanza: number }> {
  const enjambments: Array<{ fromStanza: number; toStanza: number }> = [];
  for (let i = 1; i < stanzas.length; i++) {
    const gap = stanzas[i].startMs - stanzas[i - 1].endMs;
    // Enjambment: gap is very small (< 100ms) — motion flows across
    if (gap > 0 && gap < 100) {
      enjambments.push({ fromStanza: i - 1, toStanza: i });
    }
  }
  return enjambments;
}

// ---------------------------------------------------------------------------
// Meter and Form Classification
// ---------------------------------------------------------------------------

/** Classify the dominant meter. */
function classifyMeter(feet: FootInstance[]): { meter: string; dominantFoot: PoeticFoot } {
  if (feet.length === 0) {
    return { meter: "free verse", dominantFoot: "pyrrhic" };
  }

  // Count foot types
  const counts = new Map<PoeticFoot, number>();
  for (const f of feet) {
    counts.set(f.foot, (counts.get(f.foot) ?? 0) + 1);
  }

  // Find dominant
  let dominantFoot: PoeticFoot = "iamb";
  let maxCount = 0;
  for (const [foot, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      dominantFoot = foot;
    }
  }

  // Count feet per stanza (average)
  const footNames: Record<PoeticFoot, string> = {
    iamb: "iambic",
    trochee: "trochaic",
    dactyl: "dactylic",
    anapest: "anapestic",
    spondee: "spondaic",
    pyrrhic: "pyrrhic",
  };

  // Estimate feet per line (stanza)
  const stanzasCount = new Set(feet.map((f) => Math.floor(f.index / 5))).size;
  const avgFeetPerStanza = stanzasCount > 0 ? feet.length / stanzasCount : feet.length;

  const meterNumbers: Record<number, string> = {
    1: "monometer",
    2: "dimeter",
    3: "trimeter",
    4: "tetrameter",
    5: "pentameter",
    6: "hexameter",
    7: "heptameter",
    8: "octameter",
  };

  const roundedFeet = Math.max(1, Math.round(avgFeetPerStanza));
  const numberName = meterNumbers[roundedFeet] ?? "polymeter";

  return {
    meter: `${footNames[dominantFoot]} ${numberName}`,
    dominantFoot,
  };
}

/** Classify the poetic form. */
function classifyForm(
  stanzas: Stanza[],
  feet: FootInstance[],
  regularity: number,
): PoeticAnalysis["form"] {
  if (stanzas.length === 0) return "free-verse";

  // Haiku: 3 stanzas with 5-7-5 pattern (approximated by foot counts)
  if (stanzas.length === 3) {
    const counts = stanzas.map((s) => s.footCount);
    if (counts[0] <= 3 && counts[1] <= 4 && counts[2] <= 3) {
      return "haiku";
    }
  }

  // Sonnet: 14 lines (approximated by 14 stanzas or 14 feet)
  if (stanzas.length === 14 || feet.length === 14) {
    return "sonnet";
  }

  // Ballad: 4 stanzas, alternating meter
  if (stanzas.length === 4 && regularity > 0.5) {
    return "ballad";
  }

  // Blank verse: iambic but no rhyme (regularity > 0.6)
  if (regularity > 0.6) {
    return "blank-verse";
  }

  // Structured: high regularity
  if (regularity > 0.7) {
    return "structured";
  }

  return "free-verse";
}

/** Classify the rhythmic tempo. */
function classifyTempo(avgDurationMs: number): PoeticAnalysis["tempo"] {
  if (avgDurationMs < 300) return "presto";
  if (avgDurationMs < 600) return "allegro";
  if (avgDurationMs < 1000) return "moderato";
  if (avgDurationMs < 2000) return "andante";
  if (avgDurationMs < 4000) return "adagio";
  return "largo";
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze the poetic structure of a motion composition.
 */
export function analyzePoetics(spec: MotionSpec): PoeticAnalysis {
  const components = spec.components;
  if (components.length === 0) {
    return {
      feet: [],
      stanzas: [],
      dominantMeter: "empty",
      dominantFoot: "pyrrhic",
      avgFeetPerStanza: 0,
      regularity: 0,
      caesuras: [],
      enjambments: [],
      form: "free-verse",
      tempo: "largo",
      summary: "No components — silent poem.",
    };
  }

  const sorted = [...components].sort((a, b) => a.delayMs - b.delayMs);

  // Detect feet by pairing adjacent components
  const feet: FootInstance[] = [];
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const foot = classifyFoot(sorted[i].durationMs, sorted[i + 1].durationMs);
    feet.push({
      index: feet.length,
      foot,
      componentIds: [sorted[i].id, sorted[i + 1].id],
      durationRatio: sorted[i].durationMs / sorted[i + 1].durationMs,
      startMs: sorted[i].delayMs,
    });
  }

  // Detect stanzas
  const stanzas = detectStanzas(sorted);

  // Detect caesuras and enjambments
  const caesuras = detectCaesuras(sorted);
  const enjambments = detectEnjambments(stanzas);

  // Classify meter
  const { meter, dominantFoot } = classifyMeter(feet);

  // Compute regularity: how consistent the foot patterns are
  let regularity = 0;
  if (feet.length > 1) {
    const sameTypeCount = feet.filter((f) => f.foot === dominantFoot).length;
    regularity = sameTypeCount / feet.length;
  }

  // Average feet per stanza
  const avgFeetPerStanza = stanzas.length > 0 ? feet.length / stanzas.length : feet.length;

  // Average duration for tempo
  const avgDuration = sorted.reduce((sum, c) => sum + c.durationMs, 0) / sorted.length;
  const tempo = classifyTempo(avgDuration);

  // Classify form
  const form = classifyForm(stanzas, feet, regularity);

  const summary = `Poetics: ${meter}, ${stanzas.length} stanza(s), ${feet.length} foot/feet, ` +
    `regularity ${(regularity * 100).toFixed(0)}%, form=${form}, tempo=${tempo}, ` +
    `${caesuras.length} caesura(s), ${enjambments.length} enjambment(s)`;

  return {
    feet,
    stanzas,
    dominantMeter: meter,
    dominantFoot,
    avgFeetPerStanza,
    regularity,
    caesuras,
    enjambments,
    form,
    tempo,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a poetic analysis as a human-readable report. */
export function formatPoeticsReport(analysis: PoeticAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Poetics Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  lines.push("## Meter");
  lines.push(`- Dominant meter: ${analysis.dominantMeter}`);
  lines.push(`- Dominant foot: ${analysis.dominantFoot}`);
  lines.push(`- Regularity: ${(analysis.regularity * 100).toFixed(0)}%`);
  lines.push(`- Tempo: ${analysis.tempo}`);
  lines.push("");

  lines.push("## Stanzas");
  for (const s of analysis.stanzas) {
    lines.push(
      `- Stanza ${s.index + 1}: ${s.componentIds.length} component(s), ${s.footCount} foot/feet` +
      (s.endsWithCaesura ? " (ends with caesura)" : ""),
    );
  }
  lines.push("");

  if (analysis.caesuras.length > 0) {
    lines.push("## Caesuras");
    for (const c of analysis.caesuras) {
      lines.push(`- Pause at ${c.timeMs}ms (${c.durationMs}ms)`);
    }
    lines.push("");
  }

  if (analysis.enjambments.length > 0) {
    lines.push("## Enjambments");
    for (const e of analysis.enjambments) {
      lines.push(`- Stanza ${e.fromStanza + 1} → ${e.toStanza + 1}`);
    }
    lines.push("");
  }

  lines.push("## Form");
  lines.push(`- Classified form: ${analysis.form}`);

  return lines.join("\n");
}
