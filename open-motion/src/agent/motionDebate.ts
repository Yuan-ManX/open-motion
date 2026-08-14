/**
 * Design Debate Engine — adversarial multi-perspective jury for motion design.
 *
 * The collaboration engine produces component contributions; the debate engine
 * decides which contributions are worth keeping. Three fixed "judge" personas
 * evaluate every proposal from orthogonal angles: Accessibility Judge,
 * Brand-Consistency Judge, and Performance Judge. A synthesis judge then
 * resolves conflicts between the three and produces a ranked verdict with
 * concrete suggested modifications.
 *
 * This is stronger than a single critique pass because the judges disagree
 * explicitly — the resolution logic weights the disagreement severity so
 * trade-offs are surfaced to the user instead of silently averaged away.
 */

import type { MotionComponent, MotionSpec, Keyframe } from "@openmotion/shared";
import type { CollaborationResult } from "./motionCollaboration.js";
import { deriveSignature } from "./semanticMotionMemory.js";

/** Individual module contribution shape used internally for judging. */
export interface Contribution {
  moduleId: string;
  moduleName: string;
  contribution: string;
  confidence: number;
  contributionId?: string;
  componentDraft?: Partial<MotionComponent>;
  componentId?: string;
  id?: string;
}

export type JudgeId = "accessibility" | "brand" | "performance";
export type Verdict = "approve" | "revise" | "reject";

export interface JudgeOpinion {
  judge: JudgeId;
  name: string;
  verdict: Verdict;
  /** 0-100 score from this judge's specific perspective */
  score: number;
  concerns: string[];
  strengths: string[];
  /** Specific, patchable modifications the judge wants */
  requestedPatches: Array<{ componentId?: string; field: string; suggested: unknown; reason: string }>;
}

export interface DebateResolution {
  verdict: Verdict;
  /** Weighted overall score (0-100) */
  aggregateScore: number;
  /** Per-judge weightings for transparency */
  judgeWeights: Record<JudgeId, number>;
  biggestDisagreement: string | null;
  approvedContributionIds: string[];
  rejectReason?: string;
  revisionTasks: Array<{ contributionId: string; reason: string; patch: Partial<MotionComponent> }>;
}

export interface DebateReport {
  opinions: Record<JudgeId, JudgeOpinion>;
  resolution: DebateResolution;
  summary: string;
}

// Judge weight configuration. Brand is weakest by default — accessibility and
// performance dominate because users will actually *leave* if the product
// is unusable / janky, but a slightly-off brand look can be iterated on.
const DEFAULT_WEIGHTS: Record<JudgeId, number> = {
  accessibility: 0.4,
  performance: 0.35,
  brand: 0.25,
};

// ---------------------------------------------------------------------------
// Individual judge evaluations
// ---------------------------------------------------------------------------

function accessibilityJudge(spec: MotionSpec, contributions: Contribution[]): JudgeOpinion {
  const concerns: string[] = [];
  const strengths: string[] = [];
  const patches: JudgeOpinion["requestedPatches"] = [];
  let score = 80;

  for (const c of contributions) {
    const draft = c.componentDraft;
    const name = draft?.name ?? c.componentId ?? "component";

    // Infinite iteration → vestibular risk
    if (draft && (draft.iterationCount === "infinite" || Number(draft.iterationCount) > 6)) {
      concerns.push(`${name}: infinite looping risks vestibular distress`);
      patches.push({ componentId: c.componentId, field: "iterationCount", suggested: 3, reason: "WCAG prefers-reduced-motion" });
      score -= 8;
    }

    // Very short or very long animations risk user disorientation
    if (draft?.durationMs != null) {
      if (draft.durationMs > 3000) {
        concerns.push(`${name}: ${draft.durationMs}ms duration exceeds typical attention span`);
        patches.push({ componentId: c.componentId, field: "durationMs", suggested: 1500, reason: "keep < 1500ms for responsive feel" });
        score -= 5;
      }
      if (draft.durationMs < 120 && draft.iterationCount !== "infinite") {
        concerns.push(`${name}: ${draft.durationMs}ms flash risks photosensitive triggers`);
        score -= 6;
      }
    }

    // Translate-only easing with a soft curve → accessible
    const sig = draft && "keyframes" in draft ? deriveSignature(draft as unknown as MotionComponent) : null;
    if (sig?.easingFamily === "ease-out" || sig?.easingFamily === "ease-in-out") {
      strengths.push(`${name}: ${sig.easingFamily} easing is perceptually smooth`);
      score += 2;
    }
    if (sig?.propertyKind === "opacity" || sig?.propertyKind === "translate") {
      strengths.push(`${name}: transforms + opacity are GPU-friendly`);
      score += 1;
    }
  }

  // The project-level: if no components have a11y issues, that's a strength
  if (concerns.length === 0) strengths.push("All contributions pass baseline accessibility review");

  return {
    judge: "accessibility",
    name: "Accessibility Judge (WCAG-aligned)",
    verdict: score >= 70 ? (score >= 85 ? "approve" : "revise") : "reject",
    score: Math.max(0, Math.min(100, score)),
    concerns,
    strengths,
    requestedPatches: patches,
  };
}

function performanceJudge(spec: MotionSpec, contributions: Contribution[]): JudgeOpinion {
  const concerns: string[] = [];
  const strengths: string[] = [];
  const patches: JudgeOpinion["requestedPatches"] = [];
  let score = 80;

  for (const c of contributions) {
    const draft = c.componentDraft;
    const name = draft?.name ?? c.componentId ?? "component";

    // Count keyframes and transforms complexity
    const kfs = (draft?.keyframes ?? []) as unknown[];
    if (kfs.length > 12) {
      concerns.push(`${name}: ${kfs.length} keyframes may cause main-thread work`);
      score -= 6;
    }

    // Check for non-compositable properties (anything besides transform + opacity)
    if (draft?.keyframes) {
      const props = new Set<string>();
      for (const kf of draft.keyframes as Array<Keyframe>) {
        for (const k of Object.keys(kf.properties as Record<string, unknown>)) props.add(k);
      }
      const expensive = [...props].filter(
        (p) => !p.startsWith("translate") && !p.startsWith("scale") && !p.startsWith("rotate") && p !== "opacity",
      );
      if (expensive.length > 0) {
        concerns.push(`${name}: animates ${expensive.join(",")} (triggers layout/paint)`);
        patches.push({ componentId: c.componentId, field: "style/properties", suggested: "prefer transform + opacity", reason: "GPU compositing" });
        score -= 5 * expensive.length;
      } else {
        strengths.push(`${name}: all animated properties are GPU-compositable`);
        score += 2;
      }
    }

    // Expensive easings (spring with low damping, elastic)
    const sig = draft && "keyframes" in draft ? deriveSignature(draft as unknown as MotionComponent) : null;
    if (sig?.easingFamily === "spring" || sig?.easingFamily === "elastic") {
      concerns.push(`${name}: ${sig.easingFamily} easing triggers many composite frames`);
      score -= 3;
    }
  }

  return {
    judge: "performance",
    name: "Performance Judge (60fps-first)",
    verdict: score >= 70 ? (score >= 85 ? "approve" : "revise") : "reject",
    score: Math.max(0, Math.min(100, score)),
    concerns,
    strengths,
    requestedPatches: patches,
  };
}

function brandJudge(spec: MotionSpec, contributions: Contribution[]): JudgeOpinion {
  const concerns: string[] = [];
  const strengths: string[] = [];
  const patches: JudgeOpinion["requestedPatches"] = [];
  let score = 75;

  // Brand consistency: compute the median easing/duration for existing components
  const existing = spec.components;
  const existingEasings = existing.map((c) => deriveSignature(c).easingFamily);
  const existingBuckets = existing.map((c) => deriveSignature(c).durationBucket);
  const dominantEasing = mostCommon(existingEasings) ?? "ease-out";
  const dominantBucket = mostCommon(existingBuckets) ?? "standard";

  for (const c of contributions) {
    const draft = c.componentDraft;
    const name = draft?.name ?? c.componentId ?? "component";
    const sig = draft && "keyframes" in draft ? deriveSignature(draft as unknown as MotionComponent) : null;

    if (sig) {
      if (sig.easingFamily !== dominantEasing) {
        concerns.push(`${name}: ${sig.easingFamily} easing diverges from project ${dominantEasing} norm`);
        patches.push({ componentId: c.componentId, field: "easing", suggested: dominantEasing, reason: "brand consistency" });
        score -= 5;
      } else {
        strengths.push(`${name}: easing family matches project ${dominantEasing} baseline`);
        score += 2;
      }
      if (sig.durationBucket !== dominantBucket && Math.abs(DURATION_IDX[sig.durationBucket] - DURATION_IDX[dominantBucket]) > 1) {
        concerns.push(`${name}: ${sig.durationBucket} pacing is off-brand (project uses ${dominantBucket})`);
        score -= 4;
      }
    }

    // Name pattern sanity: should not be a raw UUID / untitled
    if (!draft?.name || draft.name.length < 3 || /^comp-|^untitled|^new-layer/i.test(draft.name)) {
      concerns.push(`${name}: generic name hinders later discovery`);
      patches.push({ componentId: c.componentId, field: "name", suggested: `Contribution from ${c.moduleId}`, reason: "traceability" });
      score -= 2;
    }
  }

  return {
    judge: "brand",
    name: "Brand Consistency Judge",
    verdict: score >= 65 ? (score >= 80 ? "approve" : "revise") : "reject",
    score: Math.max(0, Math.min(100, score)),
    concerns,
    strengths,
    requestedPatches: patches,
  };
}

const DURATION_IDX: Record<string, number> = { micro: 0, short: 1, standard: 2, long: 3, epic: 4 };
function mostCommon<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = -1;
  for (const [v, n] of counts) if (n > bestCount) { best = v; bestCount = n; }
  return best;
}

// ---------------------------------------------------------------------------
// Resolution logic
// ---------------------------------------------------------------------------

function resolveDebate(opinions: Record<JudgeId, JudgeOpinion>, weights: Record<JudgeId, number>, contributions: Contribution[]): DebateResolution {
  // Weighted score
  const aggregate = Math.round(
    opinions.accessibility.score * weights.accessibility +
      opinions.performance.score * weights.performance +
      opinions.brand.score * weights.brand,
  );

  // Find the biggest inter-judge score gap (disagreement signal)
  const pairs: Array<[JudgeId, JudgeId]> = [["accessibility", "performance"], ["accessibility", "brand"], ["performance", "brand"]];
  let maxGap = 0;
  let biggestDisagreement: string | null = null;
  for (const [a, b] of pairs) {
    const gap = Math.abs(opinions[a].score - opinions[b].score);
    if (gap > maxGap) {
      maxGap = gap;
      biggestDisagreement = gap >= 18 ? `${opinions[a].judge} (${opinions[a].score}) vs ${opinions[b].judge} (${opinions[b].score})` : null;
    }
  }

  // Verdict: accessibility-reject → overall reject; 2+ revise → revise; else approve
  let verdict: Verdict = "approve";
  let rejectReason: string | undefined;
  const approved: string[] = [];
  const revisions: DebateResolution["revisionTasks"] = [];

  if (opinions.accessibility.verdict === "reject") {
    verdict = "reject";
    rejectReason = opinions.accessibility.concerns[0] ?? "Failed accessibility review";
  } else if (opinions.performance.verdict === "reject") {
    verdict = "revise";
    // Still allow contributions but apply performance patches
  }

  if (verdict === "approve") {
    const reviseCount = (Object.values(opinions) as JudgeOpinion[]).filter((o) => o.verdict === "revise").length;
    if (reviseCount >= 2) verdict = "revise";
  }

  // Helper: stable identifier for any contribution.
  const contribKey = (c: Contribution): string =>
    c.id ?? c.contributionId ?? `${c.moduleId}-${c.moduleName}`;

  // Collect concrete patch tasks from judges that asked for revisions
  const contribByCompId = new Map(contributions.map((c) => [c.componentId ?? contribKey(c), c]));
  for (const judgeId of Object.keys(opinions) as JudgeId[]) {
    for (const patch of opinions[judgeId].requestedPatches) {
      const cid = patch.componentId;
      if (!cid) continue;
      const c = contribByCompId.get(cid);
      if (!c) continue;
      if (verdict === "reject" && judgeId === "accessibility") continue; // skip — whole thing rejected
      const pc: Partial<MotionComponent> = { [patch.field]: patch.suggested } as Partial<MotionComponent>;
      revisions.push({ contributionId: contribKey(c), reason: `${judgeId}: ${patch.reason}`, patch: pc });
    }
  }

  // Approved = contributions that have no remaining per-judge "reject"-level concerns
  const rejectKeys = new Set<string>();
  for (const judgeId of Object.keys(opinions) as JudgeId[]) {
    if (opinions[judgeId].verdict === "reject") {
      for (const concern of opinions[judgeId].concerns) {
        const m = /^([^:]+):/.exec(concern);
        if (m) for (const c of contributions) {
          if ((c.componentDraft?.name ?? c.componentId ?? "") === m[1]) {
            rejectKeys.add(contribKey(c));
          }
        }
      }
    }
  }
  for (const c of contributions) {
    const key = contribKey(c);
    if (!rejectKeys.has(key)) approved.push(key);
  }

  return {
    verdict,
    aggregateScore: aggregate,
    judgeWeights: weights,
    biggestDisagreement,
    approvedContributionIds: approved,
    rejectReason,
    revisionTasks: revisions,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Run the three-judge design debate over a collaboration result.
 * Returns a structured report with an approve / revise / reject verdict and
 * concrete revision tasks that the orchestrator can apply directly as
 * component patches.
 */
export function runDesignDebate(spec: MotionSpec, collaboration: CollaborationResult, weightsOverride?: Partial<Record<JudgeId, number>>): DebateReport {
  const weights = { ...DEFAULT_WEIGHTS, ...(weightsOverride ?? {}) };
  const contributions = collaboration.contributions;

  const opinions = {
    accessibility: accessibilityJudge(spec, contributions),
    performance: performanceJudge(spec, contributions),
    brand: brandJudge(spec, contributions),
  } as Record<JudgeId, JudgeOpinion>;

  const resolution = resolveDebate(opinions, weights, contributions);

  const totalPatches = Object.values(opinions).reduce((n, o) => n + o.requestedPatches.length, 0);
  const summaryParts = [
    `Debate verdict: ${resolution.verdict.toUpperCase()} (score ${resolution.aggregateScore}/100)`,
    `${contributions.length} contribution${contributions.length === 1 ? "" : "s"} — ${resolution.approvedContributionIds.length} approved`,
  ];
  if (totalPatches > 0) summaryParts.push(`${totalPatches} suggested ${totalPatches === 1 ? "modification" : "modifications"}`);
  if (resolution.biggestDisagreement) summaryParts.push(`Disagreement: ${resolution.biggestDisagreement}`);
  if (resolution.rejectReason) summaryParts.push(`Rejected: ${resolution.rejectReason}`);

  return { opinions, resolution, summary: summaryParts.join(". ") };
}

/** Format a debate report for the chat scratchpad. */
export function formatDebateReport(report: DebateReport): string {
  const lines: string[] = [];
  lines.push(`[Design Debate] ${report.summary}`);
  for (const j of Object.values(report.opinions) as JudgeOpinion[]) {
    lines.push(`  • ${j.name}: ${j.verdict} (${j.score}/100)`);
    for (const s of j.strengths) lines.push(`    ✓ ${s}`);
    for (const c of j.concerns) lines.push(`    ! ${c}`);
  }
  if (report.resolution.revisionTasks.length > 0) {
    lines.push(`  Revision tasks (${report.resolution.revisionTasks.length}):`);
    for (const t of report.resolution.revisionTasks) {
      lines.push(`    - ${t.reason}`);
    }
  }
  return lines.join("\n");
}
