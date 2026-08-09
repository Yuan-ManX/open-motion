/**
 * Motion Prophecy Engine — forecasts motion design directions.
 */

import type { MotionSpec, MotionComponent, Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A named region of motion design space. */
export interface DesignEra {
  id: string;
  label: string;
  /** Traits that define this era, scored 0..1. */
  traits: DesignTraits;
  /** Human-readable description. */
  description: string;
}

export interface DesignTraits {
  /** Density of simultaneous motion elements. */
  density: number;
  /** Energy / speed of motion. */
  energy: number;
  /** Complexity of easing curves. */
  easingComplexity: number;
  /** Use of color and visual richness. */
  richness: number;
  /** Rhythmic structure (0 = freeform, 1 = tightly rhythmic). */
  rhythmicity: number;
  /** Use of narrative / storytelling structure. */
  narrativity: number;
  /** Use of organic vs mechanical motion. */
  organicity: number;
}

/** A forecasted direction the composition may evolve toward. */
export interface Prophecy {
  /** Target era id. */
  eraId: string;
  /** Target era label. */
  eraLabel: string;
  /** Probability 0..1 that the composition naturally evolves here. */
  probability: number;
  /** Distance 0..1 from the current state. */
  distance: number;
  /** Why this prophecy was selected. */
  rationale: string;
  /** Concrete suggested actions to move toward this era. */
  suggestions: string[];
}

/** An avant-garde proposal that diverges from the natural trajectory. */
export interface AvantGardeProposal {
  id: string;
  label: string;
  /** Novelty 0..1 — how far from the current trajectory. */
  novelty: number;
  /** Risk 0..1 — how likely to produce an undesirable result. */
  risk: number;
  /** Description of the divergent direction. */
  description: string;
  /** Concrete actions to explore this direction. */
  actions: string[];
}

/** Full prophecy report. */
export interface ProphecyReport {
  /** The current era the composition inhabits. */
  currentEra: DesignEra;
  /** The trajectory vector of recent changes. */
  trajectory: DesignTraits;
  /** Forecasted directions, sorted by probability descending. */
  prophecies: Prophecy[];
  /** Avant-garde proposals, sorted by novelty descending. */
  avantGarde: AvantGardeProposal[];
  /** Overall novelty score 0..1 for the composition. */
  noveltyScore: number;
  /** Summary string. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Era vocabulary
// ---------------------------------------------------------------------------

const ERAS: DesignEra[] = [
  {
    id: "minimalist",
    label: "Minimalist",
    traits: {
      density: 0.2,
      energy: 0.3,
      easingComplexity: 0.2,
      richness: 0.2,
      rhythmicity: 0.3,
      narrativity: 0.2,
      organicity: 0.3,
    },
    description: "Sparse, calm, restrained motion with few elements and gentle easing.",
  },
  {
    id: "expressive",
    label: "Expressive",
    traits: {
      density: 0.6,
      energy: 0.7,
      easingComplexity: 0.6,
      richness: 0.6,
      rhythmicity: 0.5,
      narrativity: 0.5,
      organicity: 0.6,
    },
    description: "Lively motion with varied easing, moderate density, and visible personality.",
  },
  {
    id: "kinetic-opulent",
    label: "Kinetic Opulent",
    traits: {
      density: 0.9,
      energy: 0.9,
      easingComplexity: 0.8,
      richness: 0.9,
      rhythmicity: 0.7,
      narrativity: 0.6,
      organicity: 0.5,
    },
    description: "Dense, high-energy motion with rich visuals and complex choreography.",
  },
  {
    id: "rhythmic",
    label: "Rhythmic",
    traits: {
      density: 0.6,
      energy: 0.7,
      easingComplexity: 0.5,
      richness: 0.5,
      rhythmicity: 0.95,
      narrativity: 0.4,
      organicity: 0.4,
    },
    description: "Tightly synchronized motion locked to a rhythmic grid.",
  },
  {
    id: "narrative",
    label: "Narrative",
    traits: {
      density: 0.5,
      energy: 0.5,
      easingComplexity: 0.5,
      richness: 0.6,
      rhythmicity: 0.4,
      narrativity: 0.95,
      organicity: 0.5,
    },
    description: "Story-driven motion that sequences scenes to tell a tale.",
  },
  {
    id: "organic",
    label: "Organic",
    traits: {
      density: 0.5,
      energy: 0.5,
      easingComplexity: 0.7,
      richness: 0.6,
      rhythmicity: 0.3,
      narrativity: 0.4,
      organicity: 0.95,
    },
    description: "Natural, flowing motion with spring physics and biological pacing.",
  },
  {
    id: "technical",
    label: "Technical",
    traits: {
      density: 0.5,
      energy: 0.6,
      easingComplexity: 0.4,
      richness: 0.3,
      rhythmicity: 0.6,
      narrativity: 0.3,
      organicity: 0.1,
    },
    description: "Precise, mechanical motion with linear or cubic easing.",
  },
  {
    id: "surreal",
    label: "Surreal",
    traits: {
      density: 0.7,
      energy: 0.6,
      easingComplexity: 0.9,
      richness: 0.8,
      rhythmicity: 0.3,
      narrativity: 0.7,
      organicity: 0.7,
    },
    description: "Dreamlike motion with unexpected easing, juxtaposition, and surprise.",
  },
];

// ---------------------------------------------------------------------------
// Trait extraction
// ---------------------------------------------------------------------------

function extractTraits(spec: MotionSpec): DesignTraits {
  const components = spec.components ?? [];
  if (components.length === 0) {
    return {
      density: 0,
      energy: 0,
      easingComplexity: 0,
      richness: 0,
      rhythmicity: 0,
      narrativity: 0,
      organicity: 0,
    };
  }

  // Density: normalized component count.
  const density = Math.min(1, components.length / 10);

  // Energy: inverse of average duration (shorter = more energetic).
  const avgDuration =
    components.reduce((s, c) => s + (c.durationMs ?? 800), 0) / components.length;
  const energy = Math.max(0, Math.min(1, 1 - (avgDuration - 200) / 2000));

  // Easing complexity: variety and non-linearity of easings.
  const easingStrs = new Set<string>();
  let complexCount = 0;
  for (const c of components) {
    const s = serializeEasing(c.easing);
    easingStrs.add(s);
    if (s.includes("elastic") || s.includes("bounce") || s.includes("back") || s.includes("spring")) {
      complexCount++;
    }
  }
  const easingComplexity = Math.min(1, (easingStrs.size / 4) * 0.5 + (complexCount / components.length) * 0.5);

  // Richness: color / visual variety from inline styles.
  const styleKeys = new Set<string>();
  let colorCount = 0;
  for (const c of components) {
    const style = (c as MotionComponent & { style?: Record<string, unknown> }).style ?? {};
    for (const k of Object.keys(style)) styleKeys.add(k);
    if ("background" in style || "backgroundColor" in style || "color" in style) colorCount++;
  }
  const richness = Math.min(1, (styleKeys.size / 8) * 0.6 + (colorCount / components.length) * 0.4);

  // Rhythmicity: presence of BPM or staggered delays.
  const bpm = spec.project?.globalTiming?.bpm;
  const hasStagger = components.some((c, i) => (c.delayMs ?? 0) > 0 && i > 0);
  const rhythmicity = Math.min(
    1,
    (bpm ? 0.5 : 0) + (hasStagger ? 0.3 : 0) + (components.length > 3 ? 0.2 : 0),
  );

  // Narrativity: presence of multiple scenes.
  const sceneCount = spec.project?.scenes?.length ?? 0;
  const narrativity = Math.min(1, sceneCount / 4);

  // Organicity: spring / elastic easing ratio.
  const organicCount = components.filter((c) => {
    const s = serializeEasing(c.easing);
    return s.includes("spring") || s.includes("elastic");
  }).length;
  const organicity = organicCount / components.length;

  return { density, energy, easingComplexity, richness, rhythmicity, narrativity, organicity };
}

function serializeEasing(e: Easing | undefined): string {
  if (!e) return "none";
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Era classification
// ---------------------------------------------------------------------------

function traitDistance(a: DesignTraits, b: DesignTraits): number {
  const keys: Array<keyof DesignTraits> = [
    "density",
    "energy",
    "easingComplexity",
    "richness",
    "rhythmicity",
    "narrativity",
    "organicity",
  ];
  let sum = 0;
  for (const k of keys) {
    sum += (a[k] - b[k]) ** 2;
  }
  return Math.sqrt(sum / keys.length);
}

function classifyEra(traits: DesignTraits): DesignEra {
  let best = ERAS[0];
  let bestDist = Infinity;
  for (const era of ERAS) {
    const d = traitDistance(traits, era.traits);
    if (d < bestDist) {
      bestDist = d;
      best = era;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Prophecy
// ---------------------------------------------------------------------------

function buildProphecies(current: DesignTraits, currentEra: DesignEra): Prophecy[] {
  const prophecies: Prophecy[] = [];
  for (const era of ERAS) {
    if (era.id === currentEra.id) continue;
    const distance = traitDistance(current, era.traits);
    // Probability inversely related to distance.
    const probability = Math.max(0, 1 - distance * 1.8);
    if (probability < 0.05) continue;
    const suggestions = suggestionsBetween(currentEra, era);
    prophecies.push({
      eraId: era.id,
      eraLabel: era.label,
      probability,
      distance,
      rationale: `${era.label} sits ${distance.toFixed(2)} units away in design space.`,
      suggestions,
    });
  }
  return prophecies.sort((a, b) => b.probability - a.probability).slice(0, 4);
}

function suggestionsBetween(from: DesignEra, to: DesignEra): string[] {
  const suggestions: string[] = [];
  if (to.traits.density > from.traits.density + 0.2) {
    suggestions.push(`Add ${Math.round((to.traits.density - from.traits.density) * 10)} more animatable layers`);
  }
  if (to.traits.density < from.traits.density - 0.2) {
    suggestions.push("Remove or merge layers to reduce density");
  }
  if (to.traits.energy > from.traits.energy + 0.2) {
    suggestions.push("Shorten durations and increase tempo");
  }
  if (to.traits.energy < from.traits.energy - 0.2) {
    suggestions.push("Lengthen durations for calmer pacing");
  }
  if (to.traits.easingComplexity > from.traits.easingComplexity + 0.2) {
    suggestions.push("Introduce elastic, back, or spring easings");
  }
  if (to.traits.rhythmicity > from.traits.rhythmicity + 0.2) {
    suggestions.push("Apply a rhythm pattern and stagger delays");
  }
  if (to.traits.narrativity > from.traits.narrativity + 0.2) {
    suggestions.push("Add scenes and plan a narrative arc");
  }
  if (to.traits.organicity > from.traits.organicity + 0.2) {
    suggestions.push("Swap linear easings for spring physics");
  }
  if (suggestions.length === 0) {
    suggestions.push(`Explore ${to.label} directions incrementally`);
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Avant-garde
// ---------------------------------------------------------------------------

function buildAvantGarde(current: DesignTraits, currentEra: DesignEra): AvantGardeProposal[] {
  // Avant-garde proposals deliberately target the eras FURTHEST from the
  // current trajectory — the opposite of natural prophecy.
  const proposals: AvantGardeProposal[] = [];
  for (const era of ERAS) {
    if (era.id === currentEra.id) continue;
    const distance = traitDistance(current, era.traits);
    if (distance < 0.35) continue; // too close to be avant-garde
    const novelty = Math.min(1, distance);
    const risk = Math.min(1, distance * 0.7);
    proposals.push({
      id: `ag-${era.id}`,
      label: `${era.label} divergence`,
      novelty,
      risk,
      description: `Break from ${currentEra.label} toward ${era.label}: ${era.description}`,
      actions: suggestionsBetween(currentEra, era),
    });
  }
  return proposals.sort((a, b) => b.novelty - a.novelty).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Forecast the motion design trajectory of a spec.
 *
 * @param spec The current motion spec to forecast.
 */
export function forecast(spec: MotionSpec): ProphecyReport {
  const trajectory = extractTraits(spec);
  const currentEra = classifyEra(trajectory);
  const prophecies = buildProphecies(trajectory, currentEra);
  const avantGarde = buildAvantGarde(trajectory, currentEra);
  // Novelty score: how far the composition sits from the average era.
  const avgTraits: DesignTraits = {
    density: avg(ERAS.map((e) => e.traits.density)),
    energy: avg(ERAS.map((e) => e.traits.energy)),
    easingComplexity: avg(ERAS.map((e) => e.traits.easingComplexity)),
    richness: avg(ERAS.map((e) => e.traits.richness)),
    rhythmicity: avg(ERAS.map((e) => e.traits.rhythmicity)),
    narrativity: avg(ERAS.map((e) => e.traits.narrativity)),
    organicity: avg(ERAS.map((e) => e.traits.organicity)),
  };
  const noveltyScore = Math.min(1, traitDistance(trajectory, avgTraits));
  const summary = formatProphecySummary(currentEra, prophecies, avantGarde, noveltyScore);
  return { currentEra, trajectory, prophecies, avantGarde, noveltyScore, summary };
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function formatProphecySummary(
  currentEra: DesignEra,
  prophecies: Prophecy[],
  avantGarde: AvantGardeProposal[],
  noveltyScore: number,
): string {
  const lines: string[] = [];
  lines.push(`Prophecy: current era is "${currentEra.label}".`);
  if (prophecies.length > 0) {
    const top = prophecies[0];
    const pct = (top.probability * 100).toFixed(0);
    lines.push(`Likely next: "${top.eraLabel}" at ${pct}% probability.`);
  }
  if (avantGarde.length > 0) {
    lines.push(`Avant-garde: ${avantGarde.length} divergent direction(s) available.`);
  }
  lines.push(`Novelty score: ${(noveltyScore * 100).toFixed(0)}%.`);
  return lines.join(" ");
}

/** Format the full prophecy report as a readable multi-line string. */
export function formatProphecyReport(report: ProphecyReport): string {
  const lines: string[] = [report.summary, "", `Current era: ${report.currentEra.label}`];
  lines.push(`  ${report.currentEra.description}`);
  lines.push("");
  lines.push("Trajectory traits:");
  lines.push(`  density=${report.trajectory.density.toFixed(2)} energy=${report.trajectory.energy.toFixed(2)}`);
  lines.push(`  easingComplexity=${report.trajectory.easingComplexity.toFixed(2)} richness=${report.trajectory.richness.toFixed(2)}`);
  lines.push(`  rhythmicity=${report.trajectory.rhythmicity.toFixed(2)} narrativity=${report.trajectory.narrativity.toFixed(2)}`);
  lines.push(`  organicity=${report.trajectory.organicity.toFixed(2)}`);
  if (report.prophecies.length > 0) {
    lines.push("", "Prophecies:");
    for (const p of report.prophecies) {
      const pct = (p.probability * 100).toFixed(0);
      lines.push(`  • ${p.eraLabel} — ${pct}% (distance ${p.distance.toFixed(2)})`);
      for (const s of p.suggestions) lines.push(`      - ${s}`);
    }
  }
  if (report.avantGarde.length > 0) {
    lines.push("", "Avant-garde proposals:");
    for (const a of report.avantGarde) {
      const npct = (a.novelty * 100).toFixed(0);
      const rpct = (a.risk * 100).toFixed(0);
      lines.push(`  • ${a.label} — novelty ${npct}%, risk ${rpct}%`);
      lines.push(`      ${a.description}`);
      for (const act of a.actions) lines.push(`      - ${act}`);
    }
  }
  return lines.join("\n");
}

/** List all available design eras. */
export function listDesignEras(): DesignEra[] {
  return [...ERAS];
}
