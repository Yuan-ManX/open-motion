import type { MotionSpec, MotionComponent, Easing } from "@openmotion/shared";

/**
 * Motion Jury — multi-perspective deliberation engine.
 *
 * An original meta-cognition layer: instead of a single quality score, the
 * spec is put on trial in front of five independent jurors, each applying a
 * distinct evaluative lens (Accessibility, Aesthetics, Performance, Narrative,
 * Restraint). Each juror returns an independent verdict — approve, reject, or
 * abstain — together with the conditions that must hold for the verdict to
 * stand. A weighted vote then aggregates the verdicts into a consensus
 * (approve / reject / hung), an agreement score, the dissenting voices, and a
 * prioritized recommendation list.
 *
 * The jury is deliberately antagonistic: jurisdictions overlap on purpose so
 * that tension between jurors (e.g. Aesthetics wanting more drama while
 * Restraint wants less) surfaces trade-offs a single score would hide. The
 * consensus is only "approve" when a sufficient weighted majority agrees; a
 * single veto from a high-weight juror can flip the outcome to "hung".
 *
 * Rule-based — no LLM round-trip required, so mock mode stays functional.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Verdict = "approve" | "reject" | "abstain";
export type Consensus = "approve" | "reject" | "hung";

/** A single juror's verdict on the spec. */
export interface JurorVerdict {
  /** Juror name, e.g. "Accessibility". */
  juror: string;
  /** The juror's decision. */
  verdict: Verdict;
  /** 0..1 — how confident the juror is in its own verdict. */
  confidence: number;
  /** 0..1 — raw lens score (0 = severe problems, 1 = ideal). */
  score: number;
  /** Vote weight in the aggregate tally. */
  weight: number;
  /** Human-readable explanation of the verdict. */
  reasoning: string;
  /** Conditions that must hold for an "approve" to remain valid. */
  conditions: string[];
  /** Evidence signals the juror observed. */
  signals: string[];
}

/** A dissenting voice against the consensus. */
export interface Dissent {
  juror: string;
  verdict: Verdict;
  reason: string;
}

/** A prioritized recommendation produced by any juror. */
export interface JuryRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  from: string;
  action: string;
  expectedImpact: string;
}

/** The full deliberation result. */
export interface JuryDeliberation {
  /** Component count the jury deliberated over. */
  componentCount: number;
  /** The intent the user stated, if any. */
  intent: string | null;
  /** Each juror's verdict. */
  jurors: JurorVerdict[];
  /** Aggregate consensus. */
  consensus: Consensus;
  /** 0..1 — agreement among jurors (1 = unanimous, 0 = maximally split). */
  agreement: number;
  /** Total weight that voted approve. */
  approveWeight: number;
  /** Total weight that voted reject. */
  rejectWeight: number;
  /** Total weight that abstained. */
  abstainWeight: number;
  /** Voices that disagree with the consensus. */
  dissent: Dissent[];
  /** Prioritized recommendations. */
  recommendations: JuryRecommendation[];
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Shared signal extraction — each juror reuses these but weighs them
// differently according to its own lens.
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

interface SpecSignals {
  componentCount: number;
  infiniteLoopCount: number;
  shortDurationCount: number;
  longDurationCount: number;
  fastFlashCount: number;
  highMagnitudeCount: number;
  lowMagnitudeCount: number;
  bouncyCount: number;
  smoothCount: number;
  linearCount: number;
  snappyCount: number;
  staggeredCount: number;
  has3dCount: number;
  hasShaderCount: number;
  hasColorCount: number;
  hasPathCount: number;
  hasRotateCount: number;
  hasScaleCount: number;
  totalKeyframes: number;
  /** 0..1 — share of components sharing the dominant easing family. */
  easingMonocultureShare: number;
  /** 0..1 — share of components in the dominant timing tier. */
  timingMonocultureShare: number;
}

function magnitudeOf(c: MotionComponent): number {
  let maxMag = 0;
  for (const kf of c.keyframes) {
    for (const prop of ["translateX", "translateY", "rotate", "scale"] as const) {
      const v = kf.properties[prop];
      if (typeof v === "number") maxMag = Math.max(maxMag, Math.abs(v));
      else if (typeof v === "string") {
        const m = v.match(/-?\d+\.?\d*/);
        if (m) maxMag = Math.max(maxMag, Math.abs(parseFloat(m[0])));
      }
    }
  }
  return maxMag;
}

function detectFlashRisk(c: MotionComponent): boolean {
  const opacityKfs = c.keyframes.filter((k) => k.properties.opacity !== undefined);
  if (opacityKfs.length < 3) return false;
  const durationSec = c.durationMs / 1000;
  return durationSec > 0 && opacityKfs.length / durationSec > 3; // >3Hz oscillation
}

function dominantShare(values: string[]): number {
  if (values.length === 0) return 0;
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  const max = Math.max(...Object.values(counts));
  return max / values.length;
}

function extractSignals(spec: MotionSpec): SpecSignals {
  let infiniteLoopCount = 0;
  let shortDurationCount = 0;
  let longDurationCount = 0;
  let fastFlashCount = 0;
  let highMagnitudeCount = 0;
  let lowMagnitudeCount = 0;
  let bouncyCount = 0;
  let smoothCount = 0;
  let linearCount = 0;
  let snappyCount = 0;
  let staggeredCount = 0;
  let has3dCount = 0;
  let hasShaderCount = 0;
  let hasColorCount = 0;
  let hasPathCount = 0;
  let hasRotateCount = 0;
  let hasScaleCount = 0;
  let totalKeyframes = 0;
  const easingFamilies: string[] = [];
  const timingTiers: string[] = [];

  for (const c of spec.components) {
    const profile = profileEasing(c.easing);
    easingFamilies.push(profile.family);
    if (profile.bouncy) bouncyCount++;
    if (profile.smooth) smoothCount++;
    if (profile.linear) linearCount++;
    if (profile.snappy) snappyCount++;
    if (c.iterationCount === "infinite") infiniteLoopCount++;
    if (c.durationMs < 300) shortDurationCount++;
    if (c.durationMs >= 800) longDurationCount++;
    if (c.durationMs < 300) timingTiers.push("fast");
    else if (c.durationMs <= 800) timingTiers.push("normal");
    else if (c.durationMs <= 1500) timingTiers.push("slow");
    else timingTiers.push("ceremonial");
    if (detectFlashRisk(c)) fastFlashCount++;
    const mag = magnitudeOf(c);
    if (mag >= 100) highMagnitudeCount++;
    if (mag > 0 && mag <= 30) lowMagnitudeCount++;
    if (c.delayMs > 0) staggeredCount++;
    const s = c.style ?? {};
    if (Object.keys(s).some((k) => /perspective|rotateX|rotateY|translateZ/i.test(k))) has3dCount++;
    if (Object.keys(s).some((k) => /shader|filter/i.test(k)) || (c.templateId ?? "").startsWith("tpl-shader")) hasShaderCount++;
    if (typeof s.color === "string" || typeof s.background === "string" || typeof s.backgroundColor === "string") hasColorCount++;
    const props = new Set<string>();
    for (const kf of c.keyframes) for (const k of Object.keys(kf.properties)) props.add(k);
    if (props.has("translateX") && props.has("translateY") && c.keyframes.length >= 3) hasPathCount++;
    if (props.has("rotate")) hasRotateCount++;
    if (props.has("scale")) hasScaleCount++;
    totalKeyframes += c.keyframes.length;
  }

  return {
    componentCount: spec.components.length,
    infiniteLoopCount,
    shortDurationCount,
    longDurationCount,
    fastFlashCount,
    highMagnitudeCount,
    lowMagnitudeCount,
    bouncyCount,
    smoothCount,
    linearCount,
    snappyCount,
    staggeredCount,
    has3dCount,
    hasShaderCount,
    hasColorCount,
    hasPathCount,
    hasRotateCount,
    hasScaleCount,
    totalKeyframes,
    easingMonocultureShare: dominantShare(easingFamilies),
    timingMonocultureShare: dominantShare(timingTiers),
  };
}

// ---------------------------------------------------------------------------
// Jurors — each applies its own lens to the shared signals.
// ---------------------------------------------------------------------------

interface JurorContext {
  spec: MotionSpec;
  signals: SpecSignals;
  intent: string | null;
}

type Juror = (ctx: JurorContext) => JurorVerdict;

function verdictFromScore(score: number, threshold = 0.6): Verdict {
  if (score >= threshold) return "approve";
  if (score <= 0.4) return "reject";
  return "abstain";
}

function confidenceFromScore(score: number): number {
  // Confidence is highest at the extremes, lowest in the abstain band.
  const distance = Math.abs(score - 0.5);
  return Math.round((0.5 + distance) * 100) / 100;
}

const accessibilityJuror: Juror = ({ signals, spec }) => {
  const conditions: string[] = [];
  const recSignals: string[] = [];
  let score = 1;
  let veto = false;

  if (signals.fastFlashCount > 0) {
    score -= 0.5 * signals.fastFlashCount;
    veto = true;
    recSignals.push(`${signals.fastFlashCount} flash-risk component(s) (>3Hz opacity)`);
    conditions.push("Remove or slow all opacity oscillations below 3Hz.");
  }
  // Vestibular load: too many infinite loops compete for attention.
  const infiniteShare = signals.componentCount > 0 ? signals.infiniteLoopCount / signals.componentCount : 0;
  if (infiniteShare > 0.5) {
    score -= 0.25;
    recSignals.push(`${Math.round(infiniteShare * 100)}% infinite-loop share`);
    conditions.push("Limit infinite loops to 1–2 ambient elements.");
  }
  // Sub-300ms motion is hard to perceive, especially for users who need more time.
  const fastShare = signals.componentCount > 0 ? signals.shortDurationCount / signals.componentCount : 0;
  if (fastShare > 0.5) {
    score -= 0.2;
    recSignals.push(`${Math.round(fastShare * 100)}% sub-300ms share`);
    conditions.push("Raise the shortest durations above 300ms.");
  }
  // Magnitude check: extreme transforms are disorienting.
  const extremeShare = signals.componentCount > 0 ? signals.highMagnitudeCount / signals.componentCount : 0;
  if (extremeShare > 0.5) {
    score -= 0.15;
    recSignals.push(`${Math.round(extremeShare * 100)}% extreme-magnitude share`);
    conditions.push("Reduce the largest transform magnitudes.");
  }
  // Empty spec is trivially accessible.
  if (signals.componentCount === 0) score = 1;
  score = Math.max(0, Math.min(1, score));
  const verdict: Verdict = veto ? "reject" : verdictFromScore(score);
  const reasoning = veto
    ? `Accessibility veto: ${signals.fastFlashCount} component(s) exceed the 3Hz flash threshold.`
    : score >= 0.6
      ? `Accessibility lens passes: flash risk absent, vestibular load manageable.`
      : `Accessibility lens flags motion that may exclude sensitive users.`;
  return {
    juror: "Accessibility",
    verdict,
    confidence: confidenceFromScore(score),
    score: Math.round(score * 100) / 100,
    weight: 1.5, // Accessibility carries veto weight.
    reasoning,
    conditions,
    signals: recSignals,
  };
};

const aestheticsJuror: Juror = ({ signals }) => {
  const conditions: string[] = [];
  const recSignals: string[] = [];
  let score = 0.7;

  // Easing monoculture reads as flat / robotic.
  if (signals.easingMonocultureShare >= 0.8) {
    score -= 0.25;
    recSignals.push(`easing monoculture ${Math.round(signals.easingMonocultureShare * 100)}%`);
    conditions.push("Introduce a second easing family to break monoculture.");
  } else if (signals.easingMonocultureShare < 0.6 && signals.componentCount >= 3) {
    score += 0.1;
    recSignals.push("balanced easing distribution");
  }
  // Linear easing as the dominant family feels mechanical.
  if (signals.linearCount > 0 && signals.linearCount / Math.max(1, signals.componentCount) >= 0.5) {
    score -= 0.2;
    recSignals.push("linear-easing dominance");
    conditions.push("Replace linear easing with smooth or ease-out curves.");
  }
  // Timing monoculture flattens rhythm.
  if (signals.timingMonocultureShare >= 0.8 && signals.componentCount >= 3) {
    score -= 0.15;
    recSignals.push("timing monoculture");
    conditions.push("Vary duration tiers to create rhythm.");
  }
  // 3D / shaders add depth when used sparingly, overwhelm when overused.
  const dramaShare = signals.componentCount > 0 ? (signals.has3dCount + signals.hasShaderCount) / signals.componentCount : 0;
  if (dramaShare > 0.5) {
    score -= 0.15;
    recSignals.push("overused 3D/shader drama");
    conditions.push("Reserve 3D and shaders for focal moments.");
  } else if (dramaShare > 0 && dramaShare <= 0.3) {
    score += 0.1;
    recSignals.push("judicious 3D/shader use");
  }
  // Color presence lifts perceived craft.
  if (signals.hasColorCount > 0) score += 0.05;
  score = Math.max(0, Math.min(1, score));
  return {
    juror: "Aesthetics",
    verdict: verdictFromScore(score),
    confidence: confidenceFromScore(score),
    score: Math.round(score * 100) / 100,
    weight: 1.0,
    reasoning: score >= 0.6
      ? "Aesthetic lens reads the composition as crafted and balanced."
      : "Aesthetic lens reads the composition as monotone or overworked.",
    conditions,
    signals: recSignals,
  };
};

const performanceJuror: Juror = ({ signals }) => {
  const conditions: string[] = [];
  const recSignals: string[] = [];
  let score = 1;

  // Component count budget — rough heuristic.
  if (signals.componentCount > 30) {
    score -= 0.3;
    recSignals.push(`${signals.componentCount} components (heavy)`);
    conditions.push("Reduce concurrent component count below 30.");
  } else if (signals.componentCount > 15) {
    score -= 0.15;
    recSignals.push(`${signals.componentCount} components (moderate)`);
  }
  // Keyframe density per component.
  const avgKfs = signals.componentCount > 0 ? signals.totalKeyframes / signals.componentCount : 0;
  if (avgKfs > 12) {
    score -= 0.2;
    recSignals.push(`${avgKfs.toFixed(1)} avg keyframes (dense)`);
    conditions.push("Simplify keyframe-heavy components.");
  }
  // Infinite loops run forever — each one is a permanent cost.
  if (signals.infiniteLoopCount > 4) {
    score -= 0.25;
    recSignals.push(`${signals.infiniteLoopCount} infinite loops`);
    conditions.push("Cap infinite loops at 3–4 ambient elements.");
  } else if (signals.infiniteLoopCount > 0) {
    score -= 0.05 * signals.infiniteLoopCount;
  }
  // Shaders are the most expensive effect type.
  if (signals.hasShaderCount > 2) {
    score -= 0.2;
    recSignals.push(`${signals.hasShaderCount} shader components`);
    conditions.push("Limit concurrent shaders to 1–2.");
  }
  // 3D transforms trigger compositing layers.
  if (signals.has3dCount > 5) {
    score -= 0.15;
    recSignals.push(`${signals.has3dCount} 3D-transform components`);
    conditions.push("Reduce concurrent 3D transforms.");
  }
  score = Math.max(0, Math.min(1, score));
  return {
    juror: "Performance",
    verdict: verdictFromScore(score),
    confidence: confidenceFromScore(score),
    score: Math.round(score * 100) / 100,
    weight: 1.0,
    reasoning: score >= 0.6
      ? "Performance lens predicts smooth playback within budget."
      : "Performance lens predicts frame-budget pressure under load.",
    conditions,
    signals: recSignals,
  };
};

const narrativeJuror: Juror = ({ signals, intent }) => {
  const conditions: string[] = [];
  const recSignals: string[] = [];
  let score = 0.5;

  // Staggered delays are the skeleton of a sequence.
  if (signals.staggeredCount >= 2) {
    score += 0.2;
    recSignals.push(`${signals.staggeredCount} staggered entrances`);
  } else {
    conditions.push("Add staggered delays to sequence entrances into a narrative.");
  }
  // Duration variety creates acts.
  const hasVariety = signals.shortDurationCount > 0 && signals.longDurationCount > 0;
  if (hasVariety) {
    score += 0.15;
    recSignals.push("mixed duration tiers (acts)");
  } else {
    conditions.push("Mix short and long durations to delineate acts.");
  }
  // Motion paths imply directed movement (story beats).
  if (signals.hasPathCount > 0) {
    score += 0.1;
    recSignals.push(`${signals.hasPathCount} motion-path component(s)`);
  }
  // An intent stated but no narrative scaffolding is a missed opportunity.
  if (intent && intent.trim().length > 0) {
    score += 0.05;
    recSignals.push("intent stated");
  } else {
    conditions.push("State an intent so the narrative has a destination.");
  }
  // Single-component scenes cannot carry a narrative.
  if (signals.componentCount <= 1) {
    score -= 0.15;
    recSignals.push("single-component scene");
    conditions.push("Add at least one more component to establish a sequence.");
  }
  score = Math.max(0, Math.min(1, score));
  return {
    juror: "Narrative",
    verdict: verdictFromScore(score),
    confidence: confidenceFromScore(score),
    score: Math.round(score * 100) / 100,
    weight: 0.8,
    reasoning: score >= 0.6
      ? "Narrative lens detects a structured sequence with clear beats."
      : "Narrative lens finds the sequence underdeveloped or flat.",
    conditions,
    signals: recSignals,
  };
};

const restraintJuror: Juror = ({ signals }) => {
  const conditions: string[] = [];
  const recSignals: string[] = [];
  let score = 1;

  // Density is the primary restraint signal.
  if (signals.componentCount > 12) {
    score -= 0.25;
    recSignals.push(`${signals.componentCount} components (dense)`);
    conditions.push("Cut the lowest-value components to reduce density.");
  } else if (signals.componentCount > 6) {
    score -= 0.1;
    recSignals.push(`${signals.componentCount} components (moderate)`);
  }
  // Over-strong magnitudes read as shouting.
  if (signals.highMagnitudeCount > 2) {
    score -= 0.2;
    recSignals.push(`${signals.highMagnitudeCount} high-magnitude component(s)`);
    conditions.push("Pull back the largest magnitudes to create headroom.");
  }
  // Too many infinite loops create ambient noise.
  if (signals.infiniteLoopCount > 2) {
    score -= 0.15;
    recSignals.push(`${signals.infiniteLoopCount} infinite loops`);
    conditions.push("Convert excess infinite loops to single-play.");
  }
  // Bouncy easings are loud — more than a few is exhausting.
  if (signals.bouncyCount > 3) {
    score -= 0.15;
    recSignals.push(`${signals.bouncyCount} bouncy components`);
    conditions.push("Reserve bounce for 1–3 focal components.");
  }
  // Presence of subtle motion signals good restraint.
  if (signals.lowMagnitudeCount > 0) {
    score += 0.1;
    recSignals.push(`${signals.lowMagnitudeCount} subtle component(s)`);
  }
  score = Math.max(0, Math.min(1, score));
  return {
    juror: "Restraint",
    verdict: verdictFromScore(score),
    confidence: confidenceFromScore(score),
    score: Math.round(score * 100) / 100,
    weight: 1.0,
    reasoning: score >= 0.6
      ? "Restraint lens sees disciplined, focused motion."
      : "Restraint lens sees too many loud elements competing.",
    conditions,
    signals: recSignals,
  };
};

const JURORS: Juror[] = [
  accessibilityJuror,
  aestheticsJuror,
  performanceJuror,
  narrativeJuror,
  restraintJuror,
];

// ---------------------------------------------------------------------------
// Aggregation — weighted vote + agreement + dissent + recommendations
// ---------------------------------------------------------------------------

function aggregateVerdicts(jurors: JurorVerdict[]): {
  consensus: Consensus;
  agreement: number;
  approveWeight: number;
  rejectWeight: number;
  abstainWeight: number;
} {
  const approveWeight = jurors.filter((j) => j.verdict === "approve").reduce((s, j) => s + j.weight, 0);
  const rejectWeight = jurors.filter((j) => j.verdict === "reject").reduce((s, j) => s + j.weight, 0);
  const abstainWeight = jurors.filter((j) => j.verdict === "abstain").reduce((s, j) => s + j.weight, 0);
  const totalWeight = approveWeight + rejectWeight + abstainWeight;

  // Consensus requires a clear majority (>60% of non-abstain weight).
  const decisive = approveWeight + rejectWeight;
  let consensus: Consensus;
  if (decisive === 0) {
    consensus = "hung";
  } else if (approveWeight / decisive > 0.6) {
    consensus = "approve";
  } else if (rejectWeight / decisive > 0.6) {
    consensus = "reject";
  } else {
    consensus = "hung";
  }

  // Agreement: 1 - normalized spread between approve and reject.
  const agreement = totalWeight > 0
    ? Math.round((1 - Math.abs(approveWeight - rejectWeight) / totalWeight) * 100) / 100
    : 0;

  return { consensus, agreement, approveWeight, rejectWeight, abstainWeight };
}

function collectDissent(jurors: JurorVerdict[], consensus: Consensus): Dissent[] {
  const dissent: Dissent[] = [];
  for (const j of jurors) {
    if (j.verdict === "abstain") continue;
    if (
      (consensus === "approve" && j.verdict === "reject") ||
      (consensus === "reject" && j.verdict === "approve")
    ) {
      dissent.push({
        juror: j.juror,
        verdict: j.verdict,
        reason: j.reasoning,
      });
    }
  }
  return dissent;
}

function buildRecommendations(jurors: JurorVerdict[]): JuryRecommendation[] {
  const recs: JuryRecommendation[] = [];
  for (const j of jurors) {
    if (j.verdict === "approve") continue;
    const priority: JuryRecommendation["priority"] =
      j.verdict === "reject" && j.weight >= 1.5
        ? "critical"
        : j.verdict === "reject"
          ? "high"
          : "medium";
    for (const cond of j.conditions) {
      recs.push({
        priority,
        from: j.juror,
        action: cond,
        expectedImpact: j.verdict === "reject"
          ? "Unblocks the juror's veto."
          : "Converts the juror's abstention into approval.",
      });
    }
  }
  // Critical first, then high, medium, low. Stable within priority.
  const order: Record<JuryRecommendation["priority"], number> = {
    critical: 0, high: 1, medium: 2, low: 3,
  };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);
  return recs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Deliberate over a project spec from five independent perspectives. */
export function deliberateMotion(spec: MotionSpec, intent?: string | null): JuryDeliberation {
  const signals = extractSignals(spec);
  const ctx: JurorContext = { spec, signals, intent: intent ?? null };

  if (signals.componentCount === 0) {
    return {
      componentCount: 0,
      intent: intent ?? null,
      jurors: [],
      consensus: "hung",
      agreement: 0,
      approveWeight: 0,
      rejectWeight: 0,
      abstainWeight: 0,
      dissent: [],
      recommendations: [],
      summary: "Empty project — the jury has nothing to deliberate.",
    };
  }

  const jurors = JURORS.map((j) => j(ctx));
  const { consensus, agreement, approveWeight, rejectWeight, abstainWeight } = aggregateVerdicts(jurors);
  const dissent = collectDissent(jurors, consensus);
  const recommendations = buildRecommendations(jurors);

  const approveCount = jurors.filter((j) => j.verdict === "approve").length;
  const rejectCount = jurors.filter((j) => j.verdict === "reject").length;
  const abstainCount = jurors.filter((j) => j.verdict === "abstain").length;
  const summary = `Jury of 5 deliberated over ${signals.componentCount} component(s): ${approveCount} approve, ${rejectCount} reject, ${abstainCount} abstain → consensus ${consensus.toUpperCase()} (agreement ${agreement}). ${recommendations.length} recommendation(s).`;

  return {
    componentCount: signals.componentCount,
    intent: intent ?? null,
    jurors,
    consensus,
    agreement,
    approveWeight: Math.round(approveWeight * 100) / 100,
    rejectWeight: Math.round(rejectWeight * 100) / 100,
    abstainWeight: Math.round(abstainWeight * 100) / 100,
    dissent,
    recommendations,
    summary,
  };
}

/** Format a jury deliberation as a human-readable report. */
export function formatJuryReport(report: JuryDeliberation): string {
  const lines: string[] = [];
  lines.push("=== Motion Jury Deliberation ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  if (report.intent) lines.push(`Intent: ${report.intent}`);
  lines.push("");
  if (report.jurors.length > 0) {
    lines.push("--- Juror Verdicts ---");
    for (const j of report.jurors) {
      const mark = j.verdict === "approve" ? "[+]" : j.verdict === "reject" ? "[X]" : "[?]";
      lines.push(`${mark} ${j.juror.padEnd(14)} verdict=${j.verdict} score=${j.score} conf=${j.confidence} weight=${j.weight}`);
      lines.push(`    ${j.reasoning}`);
      if (j.signals.length > 0) lines.push(`    signals: ${j.signals.join(", ")}`);
      if (j.conditions.length > 0) {
        for (const c of j.conditions) lines.push(`    condition: ${c}`);
      }
    }
    lines.push("");
  }
  lines.push("--- Tally ---");
  lines.push(`consensus: ${report.consensus.toUpperCase()}`);
  lines.push(`agreement: ${report.agreement}`);
  lines.push(`weights:   approve=${report.approveWeight} reject=${report.rejectWeight} abstain=${report.abstainWeight}`);
  lines.push("");
  if (report.dissent.length > 0) {
    lines.push("--- Dissent ---");
    for (const d of report.dissent) {
      lines.push(`• ${d.juror} (${d.verdict}): ${d.reason}`);
    }
    lines.push("");
  }
  if (report.recommendations.length > 0) {
    lines.push("--- Recommendations ---");
    for (const r of report.recommendations) {
      lines.push(`[${r.priority.toUpperCase()}] from ${r.from}: ${r.action}`);
      lines.push(`    impact: ${r.expectedImpact}`);
    }
    lines.push("");
  }
  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
