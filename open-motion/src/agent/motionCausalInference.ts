import type { MotionSpec, MotionComponent, Easing } from "@openmotion/shared";

/**
 * Causal Inference Engine — counterfactual attribution of perceived qualities.
 *
 * Whereas the verification engine asks "did the spec match the stated intent?",
 * this engine answers the deeper question: "which design decision actually
 * caused the perceived quality to emerge?" It identifies the qualities a
 * composition exhibits (playful, calm, urgent, premium, accessible, ...),
 * then for each quality runs a counterfactual probe — removing one decision
 * at a time from a structural clone and re-measuring the quality — to derive
 * necessity and sufficiency scores for every cause.
 *
 * Core concepts:
 * - Perceived Quality: an emergent property the viewer would name
 *   (playful, calm, urgent, premium, mechanical, organic, ...).
 * - Cause: a concrete design decision on a specific component
 *   (e.g. "bounce easing on card-2", "infinite loop on bg-1").
 * - Necessity: 0..1 — how much the quality would weaken if the cause were
 *   removed. High necessity means the cause is load-bearing.
 * - Sufficiency: 0..1 — how much the cause alone produces the quality, even
 *   without the other supporting decisions.
 * - Counterfactual: a parallel spec with one cause removed; the quality is
 *   re-measured on the parallel to isolate the cause's contribution.
 *
 * Rule-based — no LLM round-trip required, so mock mode stays functional.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A perceived quality detected in the composition. */
export interface PerceivedQuality {
  /** Short canonical name, e.g. "playful", "calm", "premium". */
  quality: string;
  /** 0..1 strength at which the quality is present in the current spec. */
  strength: number;
  /** Whether the quality clears the detection threshold. */
  present: boolean;
  /** Which signal categories contributed to the strength. */
  signals: string[];
}

/** A single counterfactual probe — remove one cause, re-measure a quality. */
export interface CounterfactualProbe {
  /** The cause that was removed. */
  cause: string;
  /** The quality being re-measured. */
  quality: string;
  /** Strength before removal. */
  beforeStrength: number;
  /** Strength after removal (counterfactual). */
  afterStrength: number;
  /** 0..1 — drop in strength attributed to this cause. */
  contribution: number;
}

/** A causal link between a design decision and a perceived quality. */
export interface CausalLink {
  /** Human-readable cause, e.g. "bounce easing on card-2". */
  cause: string;
  /** The perceived quality this cause contributes to. */
  effect: string;
  /** 0..1 confidence that the link is real (not noise). */
  confidence: number;
  /** 0..1 — how necessary the cause is for the quality. */
  necessity: number;
  /** 0..1 — how sufficient the cause is on its own. */
  sufficiency: number;
  /** Short evidence string explaining the attribution. */
  evidence: string;
}

/** A root cause — a single decision that influences multiple qualities. */
export interface RootCause {
  cause: string;
  /** Aggregate influence 0..1 across all affected qualities. */
  influence: number;
  /** Qualities this cause contributes to. */
  affectedQualities: string[];
  /** Number of qualities touched. */
  breadth: number;
}

/** A targeted intervention to shift a quality. */
export interface InterventionSuggestion {
  /** Quality the user might want to strengthen or weaken. */
  targetQuality: string;
  /** "amplify" or "dampen". */
  direction: "amplify" | "dampen";
  /** Concrete action to take. */
  action: string;
  /** Expected strength delta if the action is taken. */
  expectedDelta: number;
  /** Side effect to watch for. */
  risk: string;
}

/** The full causal inference report. */
export interface CausalInferenceReport {
  /** All perceived qualities detected in the spec. */
  qualities: PerceivedQuality[];
  /** Counterfactual probes executed. */
  counterfactuals: CounterfactualProbe[];
  /** Causal links derived from the probes. */
  causalLinks: CausalLink[];
  /** Root causes ranked by aggregate influence. */
  rootCauses: RootCause[];
  /** Suggested interventions to shift qualities. */
  interventions: InterventionSuggestion[];
  /** Component count the analysis ran against. */
  componentCount: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Quality measurement
// ---------------------------------------------------------------------------

interface EasingProfile {
  family: string;
  bouncy: boolean;
  smooth: boolean;
  snappy: boolean;
  linear: boolean;
}

function profileEasing(easing: Easing): EasingProfile {
  if (easing.type === "preset") {
    const n = easing.name.toLowerCase();
    return {
      family: easing.name,
      bouncy: /bounce|elastic|back|spring/.test(n),
      smooth: /smooth|ease-in-out|ease-out|soft/.test(n),
      snappy: /snappy|ease-in/.test(n),
      linear: n === "linear",
    };
  }
  if (easing.type === "spring") {
    return { family: "spring", bouncy: true, smooth: false, snappy: false, linear: false };
  }
  return { family: "bezier", bouncy: false, smooth: true, snappy: false, linear: false };
}

interface ComponentSignals {
  bouncy: boolean;
  smooth: boolean;
  snappy: boolean;
  linear: boolean;
  infiniteLoop: boolean;
  hasColor: boolean;
  has3d: boolean;
  hasPath: boolean;
  hasShader: boolean;
  longDuration: boolean;
  shortDuration: boolean;
  staggered: boolean;
  highMagnitude: boolean;
  lowMagnitude: boolean;
  hasRotate: boolean;
  hasScale: boolean;
}

function componentSignals(c: MotionComponent): ComponentSignals {
  const profile = profileEasing(c.easing);
  const s = c.style ?? {};
  const hasColor =
    typeof s.color === "string" ||
    typeof s.background === "string" ||
    typeof s.backgroundColor === "string";
  const has3d = Object.keys(s).some((k) => /perspective|rotateX|rotateY|translateZ/i.test(k));
  const hasShader = Object.keys(s).some((k) => /shader|filter/i.test(k)) || (c.templateId ?? "").startsWith("tpl-shader");
  const props = new Set<string>();
  let maxMag = 0;
  for (const kf of c.keyframes) {
    for (const k of Object.keys(kf.properties)) props.add(k);
    for (const prop of ["translateX", "translateY", "rotate", "scale"] as const) {
      const v = kf.properties[prop];
      if (typeof v === "number") maxMag = Math.max(maxMag, Math.abs(v));
      else if (typeof v === "string") {
        const m = v.match(/-?\d+\.?\d*/);
        if (m) maxMag = Math.max(maxMag, Math.abs(parseFloat(m[0])));
      }
    }
  }
  const hasPath = props.has("translateX") && props.has("translateY") && c.keyframes.length >= 3;
  return {
    bouncy: profile.bouncy,
    smooth: profile.smooth,
    snappy: profile.snappy,
    linear: profile.linear,
    infiniteLoop: c.iterationCount === "infinite",
    hasColor,
    has3d,
    hasPath,
    hasShader,
    longDuration: c.durationMs >= 800,
    shortDuration: c.durationMs <= 400,
    staggered: c.delayMs > 0,
    highMagnitude: maxMag >= 100,
    lowMagnitude: maxMag > 0 && maxMag <= 30,
    hasRotate: props.has("rotate"),
    hasScale: props.has("scale"),
  };
}

interface QualityDefinition {
  quality: string;
  /** Returns a 0..1 contribution score from a single component. */
  score: (sig: ComponentSignals) => number;
  /** Aggregation: how to combine per-component scores into a 0..1 strength. */
  aggregate: "any" | "majority" | "average" | "all";
  /** Detection threshold for `present`. */
  threshold: number;
}

const QUALITY_DEFINITIONS: QualityDefinition[] = [
  {
    quality: "playful",
    score: (s) => (s.bouncy ? 0.7 : 0) + (s.hasColor ? 0.2 : 0) + (s.infiniteLoop ? 0.1 : 0),
    aggregate: "any",
    threshold: 0.5,
  },
  {
    quality: "calm",
    score: (s) => (s.smooth ? 0.5 : 0) + (s.longDuration ? 0.3 : 0) + (s.lowMagnitude ? 0.2 : 0),
    aggregate: "majority",
    threshold: 0.5,
  },
  {
    quality: "urgent",
    score: (s) => (s.snappy ? 0.5 : 0) + (s.shortDuration ? 0.4 : 0) + (s.highMagnitude ? 0.1 : 0),
    aggregate: "any",
    threshold: 0.5,
  },
  {
    quality: "mechanical",
    score: (s) => (s.linear ? 0.7 : 0) + (s.shortDuration ? 0.2 : 0) + (s.hasRotate ? 0.1 : 0),
    aggregate: "majority",
    threshold: 0.5,
  },
  {
    quality: "organic",
    score: (s) => (s.smooth ? 0.3 : 0) + (s.hasPath ? 0.4 : 0) + (s.infiniteLoop ? 0.3 : 0),
    aggregate: "any",
    threshold: 0.5,
  },
  {
    quality: "premium",
    score: (s) => (s.smooth ? 0.4 : 0) + (s.longDuration ? 0.3 : 0) + (s.has3d ? 0.3 : 0),
    aggregate: "majority",
    threshold: 0.5,
  },
  {
    quality: "energetic",
    score: (s) => (s.highMagnitude ? 0.4 : 0) + (s.shortDuration ? 0.3 : 0) + (s.infiniteLoop ? 0.3 : 0),
    aggregate: "any",
    threshold: 0.5,
  },
  {
    quality: "ambient",
    score: (s) => (s.infiniteLoop ? 0.6 : 0) + (s.lowMagnitude ? 0.3 : 0) + (s.smooth ? 0.1 : 0),
    aggregate: "any",
    threshold: 0.5,
  },
  {
    quality: "dramatic",
    score: (s) => (s.highMagnitude ? 0.4 : 0) + (s.has3d ? 0.3 : 0) + (s.hasShader ? 0.3 : 0),
    aggregate: "any",
    threshold: 0.5,
  },
  {
    quality: "minimal",
    score: (s) => (s.lowMagnitude ? 0.5 : 0) + (s.smooth ? 0.3 : 0) + (!s.infiniteLoop ? 0.2 : 0),
    aggregate: "majority",
    threshold: 0.5,
  },
];

function aggregateScores(scores: number[], mode: QualityDefinition["aggregate"]): number {
  if (scores.length === 0) return 0;
  switch (mode) {
    case "any":
      return Math.max(...scores);
    case "all":
      return Math.min(...scores);
    case "majority": {
      const half = scores.length / 2;
      const passing = scores.filter((s) => s >= 0.5).length;
      if (passing > half) return scores.reduce((a, b) => a + b, 0) / scores.length;
      return Math.max(...scores) * 0.4;
    }
    case "average":
    default:
      return scores.reduce((a, b) => a + b, 0) / scores.length;
  }
}

/** Measure all perceived qualities for a spec. */
function measureQualities(spec: MotionSpec): PerceivedQuality[] {
  if (spec.components.length === 0) return [];
  const perComponent = spec.components.map(componentSignals);
  return QUALITY_DEFINITIONS.map((def) => {
    const scores = perComponent.map(def.score);
    const strength = Math.min(1, aggregateScores(scores, def.aggregate));
    const signals: string[] = [];
    if (def.score({ bouncy: true } as ComponentSignals) > 0) signals.push("bouncy easing");
    if (def.score({ smooth: true } as ComponentSignals) > 0) signals.push("smooth easing");
    if (def.score({ infiniteLoop: true } as ComponentSignals) > 0) signals.push("infinite loop");
    if (def.score({ hasColor: true } as ComponentSignals) > 0) signals.push("explicit color");
    if (def.score({ has3d: true } as ComponentSignals) > 0) signals.push("3D transform");
    if (def.score({ hasPath: true } as ComponentSignals) > 0) signals.push("motion path");
    if (def.score({ hasShader: true } as ComponentSignals) > 0) signals.push("shader effect");
    if (def.score({ longDuration: true } as ComponentSignals) > 0) signals.push("long duration");
    if (def.score({ shortDuration: true } as ComponentSignals) > 0) signals.push("short duration");
    if (def.score({ highMagnitude: true } as ComponentSignals) > 0) signals.push("high magnitude");
    if (def.score({ lowMagnitude: true } as ComponentSignals) > 0) signals.push("low magnitude");
    return {
      quality: def.quality,
      strength: Math.round(strength * 100) / 100,
      present: strength >= def.threshold,
      signals,
    };
  });
}

// ---------------------------------------------------------------------------
// Counterfactual probes
// ---------------------------------------------------------------------------

/** A single cause identified on a single component. */
interface CauseInstance {
  /** Human-readable label. */
  label: string;
  /** Component the cause lives on. */
  componentId: string;
  /** Property to neutralize when probing. */
  patch: Partial<Record<keyof MotionComponent, unknown>>;
}

function discoverCauses(spec: MotionSpec): CauseInstance[] {
  const causes: CauseInstance[] = [];
  for (const c of spec.components) {
    const sig = componentSignals(c);
    if (sig.bouncy) {
      causes.push({
        label: `bounce easing on ${c.name || c.id}`,
        componentId: c.id,
        patch: { easing: { type: "preset", name: "linear" } as Easing },
      });
    }
    if (sig.smooth) {
      causes.push({
        label: `smooth easing on ${c.name || c.id}`,
        componentId: c.id,
        patch: { easing: { type: "preset", name: "linear" } as Easing },
      });
    }
    if (sig.snappy) {
      causes.push({
        label: `snappy easing on ${c.name || c.id}`,
        componentId: c.id,
        patch: { easing: { type: "preset", name: "linear" } as Easing },
      });
    }
    if (sig.infiniteLoop) {
      causes.push({
        label: `infinite loop on ${c.name || c.id}`,
        componentId: c.id,
        patch: { iterationCount: 1 },
      });
    }
    if (sig.longDuration) {
      causes.push({
        label: `long duration on ${c.name || c.id}`,
        componentId: c.id,
        patch: { durationMs: 400 },
      });
    }
    if (sig.shortDuration) {
      causes.push({
        label: `short duration on ${c.name || c.id}`,
        componentId: c.id,
        patch: { durationMs: 800 },
      });
    }
    if (sig.has3d) {
      causes.push({
        label: `3D transform on ${c.name || c.id}`,
        componentId: c.id,
        patch: { style: {} },
      });
    }
    if (sig.hasShader) {
      causes.push({
        label: `shader effect on ${c.name || c.id}`,
        componentId: c.id,
        patch: { style: {} },
      });
    }
    if (sig.hasColor) {
      causes.push({
        label: `explicit color on ${c.name || c.id}`,
        componentId: c.id,
        patch: { style: {} },
      });
    }
  }
  return causes;
}

/** Apply a cause's neutralizing patch to a structural clone of the spec. */
function applyCauseRemoval(spec: MotionSpec, cause: CauseInstance): MotionSpec {
  return {
    ...spec,
    components: spec.components.map((c) => {
      if (c.id !== cause.componentId) return c;
      const next: MotionComponent = {
        ...c,
        keyframes: c.keyframes.map((k) => ({ ...k, properties: { ...k.properties } })),
        style: c.style ? { ...c.style } : {},
      };
      for (const [key, value] of Object.entries(cause.patch)) {
        if (key === "style" && typeof value === "object" && value !== null) {
          next.style = { ...(value as Record<string, string | number>) };
        } else {
          (next as unknown as Record<string, unknown>)[key] = value;
        }
      }
      return next;
    }),
    project: { ...spec.project },
  };
}

/** Find the strength of a single quality in a spec. */
function strengthOf(spec: MotionSpec, quality: string): number {
  const q = measureQualities(spec).find((x) => x.quality === quality);
  return q ? q.strength : 0;
}

/**
 * Run counterfactual probes: for each cause, remove it from a clone and
 * re-measure every present quality. The strength drop isolates the cause's
 * contribution.
 */
function runCounterfactuals(spec: MotionSpec): CounterfactualProbe[] {
  const causes = discoverCauses(spec);
  const presentQualities = measureQualities(spec).filter((q) => q.present);
  const probes: CounterfactualProbe[] = [];
  for (const cause of causes) {
    const counterSpec = applyCauseRemoval(spec, cause);
    for (const q of presentQualities) {
      const after = strengthOf(counterSpec, q.quality);
      const contribution = Math.max(0, q.strength - after);
      // Skip probes with negligible contribution to keep the report focused.
      if (contribution < 0.05) continue;
      probes.push({
        cause: cause.label,
        quality: q.quality,
        beforeStrength: q.strength,
        afterStrength: Math.round(after * 100) / 100,
        contribution: Math.round(contribution * 100) / 100,
      });
    }
  }
  return probes;
}

// ---------------------------------------------------------------------------
// Causal links + root causes
// ---------------------------------------------------------------------------

function buildCausalLinks(spec: MotionSpec, probes: CounterfactualProbe[]): CausalLink[] {
  // Aggregate probes by (cause, quality) — multiple probes for the same pair
  // can occur when a cause is discovered on several components.
  const byPair = new Map<string, CounterfactualProbe[]>();
  for (const p of probes) {
    const key = `${p.cause}||${p.quality}`;
    const arr = byPair.get(key) ?? [];
    arr.push(p);
    byPair.set(key, arr);
  }
  const links: CausalLink[] = [];
  for (const [key, group] of byPair) {
    const [cause, quality] = key.split("||");
    const avgContribution = group.reduce((s, p) => s + p.contribution, 0) / group.length;
    const beforeStrength = group[0].beforeStrength;
    // Necessity: how much the quality drops relative to its current strength.
    const necessity = beforeStrength > 0 ? Math.min(1, avgContribution / beforeStrength) : 0;
    // Sufficiency: how much the cause alone produces the quality. Approximated
    // as the contribution itself (a cause that single-handedly moves the
    // strength by 0.5+ is sufficient).
    const sufficiency = Math.min(1, avgContribution * 2);
    // Confidence: higher when multiple probes agree and the contribution is
    // large relative to noise (0.05 floor).
    const confidence = Math.min(1, (group.length * 0.3) + (avgContribution * 0.7));
    links.push({
      cause,
      effect: quality,
      confidence: Math.round(confidence * 100) / 100,
      necessity: Math.round(necessity * 100) / 100,
      sufficiency: Math.round(sufficiency * 100) / 100,
      evidence: `Removing "${cause}" drops "${quality}" from ${beforeStrength.toFixed(2)} to ${group[0].afterStrength.toFixed(2)} (contribution ${avgContribution.toFixed(2)}).`,
    });
  }
  // Sort by contribution descending.
  links.sort((a, b) => (b.necessity + b.sufficiency) - (a.necessity + a.sufficiency));
  return links;
}

function rankRootCauses(links: CausalLink[]): RootCause[] {
  const byCause = new Map<string, CausalLink[]>();
  for (const link of links) {
    const arr = byCause.get(link.cause) ?? [];
    arr.push(link);
    byCause.set(link.cause, arr);
  }
  const roots: RootCause[] = [];
  for (const [cause, group] of byCause) {
    const affectedQualities = group.map((l) => l.effect);
    const influence = group.reduce((s, l) => s + (l.necessity + l.sufficiency) / 2, 0) / group.length;
    roots.push({
      cause,
      influence: Math.round(influence * 100) / 100,
      affectedQualities,
      breadth: affectedQualities.length,
    });
  }
  roots.sort((a, b) => b.influence - a.influence);
  return roots;
}

// ---------------------------------------------------------------------------
// Interventions
// ---------------------------------------------------------------------------

function suggestInterventions(
  qualities: PerceivedQuality[],
  links: CausalLink[],
): InterventionSuggestion[] {
  const suggestions: InterventionSuggestion[] = [];
  const present = qualities.filter((q) => q.present);
  const absent = qualities.filter((q) => !q.present);

  // Amplify an absent quality by introducing its strongest known cause.
  for (const q of absent.slice(0, 2)) {
    const matchingLinks = links.filter((l) => l.effect === q.quality && l.sufficiency >= 0.4);
    if (matchingLinks.length === 0) continue;
    const best = matchingLinks[0];
    suggestions.push({
      targetQuality: q.quality,
      direction: "amplify",
      action: `Introduce a cause like "${best.cause}" to surface the ${q.quality} quality.`,
      expectedDelta: Math.round(best.sufficiency * 100) / 100,
      risk: `May also amplify ${best.effect} — verify the shift matches the intent.`,
    });
  }

  // Dampen an over-strong quality if it crowds out others.
  const overStrong = present.filter((q) => q.strength >= 0.8);
  for (const q of overStrong.slice(0, 1)) {
    const matchingLinks = links.filter((l) => l.effect === q.quality && l.necessity >= 0.4);
    if (matchingLinks.length === 0) continue;
    const best = matchingLinks[0];
    suggestions.push({
      targetQuality: q.quality,
      direction: "dampen",
      action: `Remove or weaken "${best.cause}" to reduce the ${q.quality} dominance.`,
      expectedDelta: -Math.round(best.necessity * 100) / 100,
      risk: `May weaken ${best.effect} below the detection threshold.`,
    });
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run causal inference on a project spec. */
export function inferCausalLinks(spec: MotionSpec): CausalInferenceReport {
  if (spec.components.length === 0) {
    return {
      qualities: [],
      counterfactuals: [],
      causalLinks: [],
      rootCauses: [],
      interventions: [],
      componentCount: 0,
      summary: "Empty project — no causes to attribute.",
    };
  }
  const qualities = measureQualities(spec);
  const counterfactuals = runCounterfactuals(spec);
  const causalLinks = buildCausalLinks(spec, counterfactuals);
  const rootCauses = rankRootCauses(causalLinks);
  const interventions = suggestInterventions(qualities, causalLinks);
  const presentCount = qualities.filter((q) => q.present).length;
  const topRoot = rootCauses[0];
  const summary = `Detected ${presentCount} perceived qualit${presentCount === 1 ? "y" : "ies"}. ${rootCauses.length} root cause(s) identified${topRoot ? `; strongest is "${topRoot.cause}" (influence ${topRoot.influence})` : ""}. ${interventions.length} intervention(s) suggested.`;
  return {
    qualities,
    counterfactuals,
    causalLinks,
    rootCauses,
    interventions,
    componentCount: spec.components.length,
    summary,
  };
}

/** Format a causal inference report as a human-readable string. */
export function formatCausalReport(report: CausalInferenceReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Causal Inference ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  lines.push("");
  if (report.qualities.length > 0) {
    lines.push("--- Perceived Qualities ---");
    for (const q of report.qualities) {
      const mark = q.present ? "[+]" : "[ ]";
      lines.push(`${mark} ${q.quality.padEnd(12)} ${Math.round(q.strength * 100)}% (${q.signals.slice(0, 3).join(", ") || "no signals"})`);
    }
    lines.push("");
  }
  if (report.causalLinks.length > 0) {
    lines.push("--- Causal Links (top 8) ---");
    for (const l of report.causalLinks.slice(0, 8)) {
      lines.push(`• ${l.cause} → ${l.effect}`);
      lines.push(`    necessity=${l.necessity} sufficiency=${l.sufficiency} confidence=${l.confidence}`);
      lines.push(`    ${l.evidence}`);
    }
    lines.push("");
  }
  if (report.rootCauses.length > 0) {
    lines.push("--- Root Causes (top 5) ---");
    for (const r of report.rootCauses.slice(0, 5)) {
      lines.push(`• ${r.cause} — influence ${r.influence}, breadth ${r.breadth} (${r.affectedQualities.join(", ")})`);
    }
    lines.push("");
  }
  if (report.interventions.length > 0) {
    lines.push("--- Interventions ---");
    for (const i of report.interventions) {
      lines.push(`[${i.direction}] ${i.targetQuality}: ${i.action}`);
      lines.push(`    expected Δ ${i.expectedDelta} · risk: ${i.risk}`);
    }
    lines.push("");
  }
  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
