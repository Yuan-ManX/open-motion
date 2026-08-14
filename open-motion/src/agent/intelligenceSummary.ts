/**
 * Intelligence Summary — aggregates all analysis engines into a single
 * comprehensive dashboard report. Designed for one-call retrieval by the
 * frontend Health/Intel panel and the Agent's own self-assessment loop.
 */

import type { MotionSpec } from "@openmotion/shared";
import { analyzeMotion } from "../motion/analysis.js";
import { analyzeRestraint } from "../motion/restraint.js";
import { analyzeMood } from "../motion/moodEngine.js";
import { analyzeCohesion } from "./motionCohesion.js";
import { analyzeBudget } from "./motionBudget.js";
import { analyzeGenome } from "./motionGenome.js";
import { analyzeNarrative } from "./motionNarrative.js";
import { analyzeTopology } from "./motionTopology.js";
import { analyzeEntropy } from "./motionEntropy.js";
import { analyzePhysics } from "./motionPhysics.js";
import { detectModules, listCollaborationModules } from "./motionCollaboration.js";
import { suggestProactive } from "./proactiveEngine.js";

export interface IntelligenceScoreCard {
  label: string;
  score: number;
  max: number;
  status: "excellent" | "good" | "fair" | "poor";
  detail: string;
}

export interface IntelligenceSummary {
  /** ISO timestamp of when the report was generated. */
  generatedAt: string;
  /** Overall project health score (0-100). */
  overallScore: number;
  /** Letter grade derived from overallScore. */
  grade: string;
  /** Individual score cards for each analysis dimension. */
  scorecards: IntelligenceScoreCard[];
  /** Aggregated warnings from all engines. */
  warnings: string[];
  /** Aggregated recommendations from all engines. */
  recommendations: string[];
  /** Motion DNA distribution across components. */
  dnaDistribution: Record<string, number>;
  /** Easing family distribution. */
  easingDistribution: Record<string, number>;
  /** Duration bucket distribution. */
  durationBuckets: { fast: number; normal: number; slow: number };
  /** Collaboration modules that would activate for this spec. */
  collaborationReadiness: {
    totalModules: number;
    activatedModules: string[];
    moduleNames: string[];
  };
  /** Proactive suggestions for the current spec state. */
  proactiveSuggestions: ReturnType<typeof suggestProactive>;
  /** Component count and property variety. */
  stats: {
    componentCount: number;
    propertyCount: number;
    easingVariety: number;
    loopCount: number;
    totalDurationMs: number;
    averageDurationMs: number;
  };
  /** Narrative arc summary if available. */
  narrative: {
    hasArc: boolean;
    beatCount: number;
    tensionCurve: string;
  };
  /** Physics simulation summary. */
  physics: {
    simulated: boolean;
    forcesDetected: string[];
    energyLevel: string;
  };
  /** Entropy and information density. */
  entropy: {
    overallEntropy: number;
    densityWindows: number;
    mutualInformationPairs: number;
  };
}

function statusFromScore(score: number, max: number): IntelligenceScoreCard["status"] {
  const ratio = score / max;
  if (ratio >= 0.8) return "excellent";
  if (ratio >= 0.6) return "good";
  if (ratio >= 0.4) return "fair";
  return "poor";
}

function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Generate a comprehensive intelligence summary for a motion spec.
 * Aggregates quality, restraint, mood, cohesion, budget, genome, narrative,
 * topology, entropy, and physics analyses into one report.
 */
export function generateIntelligenceSummary(spec: MotionSpec): IntelligenceSummary {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const scorecards: IntelligenceScoreCard[] = [];

  // --- Quality Analysis ---
  const quality = analyzeMotion(spec);
  const qualityScore = Math.min(100, quality.score);
  scorecards.push({
    label: "Quality",
    score: qualityScore,
    max: 100,
    status: statusFromScore(qualityScore, 100),
    detail: quality.insights[0]?.message ?? "No quality insights available",
  });
  for (const insight of quality.insights.slice(1)) {
    recommendations.push(insight.message);
  }

  // --- Restraint Analysis ---
  const restraint = analyzeRestraint(spec);
  const restraintScore = Math.max(0, Math.min(100, restraint.score));
  scorecards.push({
    label: "Restraint",
    score: restraintScore,
    max: 100,
    status: statusFromScore(restraintScore, 100),
    detail: restraint.warnings?.[0]?.message ?? "Motion budget is well-balanced",
  });
  if (restraint.warnings) {
    warnings.push(...restraint.warnings.map((w) => w.message));
  }

  // --- Mood Analysis ---
  const mood = analyzeMood(spec);
  const moodScore = Math.round(mood.coherence * 100);
  scorecards.push({
    label: "Mood Clarity",
    score: moodScore,
    max: 100,
    status: statusFromScore(moodScore, 100),
    detail: `Dominant mood: ${mood.dominantMood} (${Math.round(mood.coherence * 100)}% coherence)`,
  });

  // --- Cohesion Analysis ---
  const cohesion = analyzeCohesion(spec);
  const cohesionScore = Math.round(cohesion.cohesionScore);
  scorecards.push({
    label: "Cohesion",
    score: cohesionScore,
    max: 100,
    status: statusFromScore(cohesionScore, 100),
    detail: cohesion.summary,
  });
  for (const rec of cohesion.recommendations) {
    recommendations.push(rec.title);
  }

  // --- Budget Analysis ---
  const budget = analyzeBudget(spec);
  const budgetScore = Math.max(0, Math.round((1 - budget.utilization) * 100));
  scorecards.push({
    label: "Motion Budget",
    score: budgetScore,
    max: 100,
    status: statusFromScore(budgetScore, 100),
    detail: budget.overBudget
      ? `Over budget — utilization ${Math.round(budget.utilization * 100)}%`
      : `${Math.round(budget.utilization * 100)}% budget utilized, ${Math.round(budget.headroom)} headroom`,
  });
  if (budget.overBudget) {
    warnings.push("Motion budget exceeded — consider reducing concurrent animations");
  }

  // --- Genome Analysis ---
  const genome = analyzeGenome(spec);
  const genomeScore = Math.round(genome.diversityScore);
  scorecards.push({
    label: "Genome Diversity",
    score: genomeScore,
    max: 100,
    status: statusFromScore(genomeScore, 100),
    detail: genome.isMonoculture
      ? `Monoculture detected (${genome.familyCount} family) — diversification recommended`
      : `${genome.familyCount} distinct families, diversity ${genome.diversityScore}/100`,
  });
  for (const s of genome.suggestions) {
    recommendations.push(s.recommendation || s.message);
  }

  // --- Narrative Analysis ---
  const narrative = analyzeNarrative(spec);
  const narrativeScore = narrative.complete ? 100 : Math.min(100, narrative.beatsPresent.length * 25);
  scorecards.push({
    label: "Narrative",
    score: narrativeScore,
    max: 100,
    status: statusFromScore(narrativeScore, 100),
    detail: narrative.complete
      ? `Complete arc with ${narrative.beatsPresent.length} beats`
      : `${narrative.beatsPresent.length} beats present, ${narrative.beatsMissing.length} missing`,
  });
  if (narrative.beatsMissing.length > 0) {
    recommendations.push(`Add missing narrative beats: ${narrative.beatsMissing.join(", ")}`);
  }

  // --- Topology Analysis ---
  const topology = analyzeTopology(spec);
  const topologyScore = Math.min(100, Math.round(topology.connectivity * 100));
  scorecards.push({
    label: "Topology",
    score: topologyScore,
    max: 100,
    status: statusFromScore(topologyScore, 100),
    detail: `${topology.edges.length} connections, ${topology.connectedComponents.length} groups, complexity ${topology.complexity}`,
  });

  // --- Entropy Analysis ---
  const entropy = analyzeEntropy(spec);
  const entropyScore = Math.min(100, Math.round(entropy.overallNormalized * 100));
  scorecards.push({
    label: "Information Density",
    score: entropyScore,
    max: 100,
    status: statusFromScore(entropyScore, 100),
    detail: `${entropy.densityWindows.length} density windows, entropy ${entropy.overallEntropyBits.toFixed(2)} bits`,
  });

  // --- Physics Analysis ---
  const physics = analyzePhysics(spec);
  const physicsScore = Math.min(100, Math.round(physics.totalSystemEnergy * 10));
  scorecards.push({
    label: "Physics Energy",
    score: physicsScore,
    max: 100,
    status: statusFromScore(physicsScore, 100),
    detail: `${physics.forces.length} force(s) detected, system energy ${physics.totalSystemEnergy.toFixed(2)}`,
  });

  // --- Compute overall score ---
  const overallScore = Math.round(
    scorecards.reduce((sum, sc) => sum + sc.score, 0) / scorecards.length,
  );

  // --- DNA Distribution ---
  const dnaDistribution: Record<string, number> = {};
  for (const c of spec.components) {
    const fam = c.easing.type === "preset" ? c.easing.name : c.easing.type;
    const upper = fam.toUpperCase();
    dnaDistribution[upper] = (dnaDistribution[upper] ?? 0) + 1;
  }

  // --- Easing Distribution ---
  const easingDistribution: Record<string, number> = {};
  for (const c of spec.components) {
    const fam = c.easing.type === "preset" ? c.easing.name : c.easing.type;
    easingDistribution[fam] = (easingDistribution[fam] ?? 0) + 1;
  }

  // --- Duration Buckets ---
  const durationBuckets = { fast: 0, normal: 0, slow: 0 };
  for (const c of spec.components) {
    if (c.durationMs < 500) durationBuckets.fast++;
    else if (c.durationMs <= 1500) durationBuckets.normal++;
    else durationBuckets.slow++;
  }

  // --- Property Set ---
  const propertySet = new Set<string>();
  for (const c of spec.components) {
    for (const kf of c.keyframes) {
      for (const key of Object.keys(kf.properties)) propertySet.add(key);
    }
  }

  // --- Total Duration ---
  const totalDurationMs = spec.components.reduce(
    (max, c) =>
      Math.max(
        max,
        c.delayMs + c.durationMs * (c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1),
      ),
    0,
  );

  // --- Collaboration Readiness ---
  const collabRequest = `${mood.dominantMood} ${narrative.summary} ${physics.summary}`;
  const activatedModules = detectModules(collabRequest);
  const allModules = listCollaborationModules();

  // --- Proactive Suggestions ---
  const proactiveSuggestions = suggestProactive({
    spec,
    lastTool: null,
    lastToolOk: true,
  });

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    grade: gradeFromScore(overallScore),
    scorecards,
    warnings: [...new Set(warnings)].slice(0, 20),
    recommendations: [...new Set(recommendations)].slice(0, 20),
    dnaDistribution,
    easingDistribution,
    durationBuckets,
    collaborationReadiness: {
      totalModules: allModules.length,
      activatedModules: activatedModules.map((m) => m.id),
      moduleNames: activatedModules.map((m) => m.name),
    },
    proactiveSuggestions,
    stats: {
      componentCount: spec.components.length,
      propertyCount: propertySet.size,
      easingVariety: Object.keys(easingDistribution).length,
      loopCount: spec.components.filter((c) => c.iterationCount === "infinite").length,
      totalDurationMs,
      averageDurationMs:
        spec.components.length > 0
          ? Math.round(spec.components.reduce((s, c) => s + c.durationMs, 0) / spec.components.length)
          : 0,
    },
    narrative: {
      hasArc: narrative.complete,
      beatCount: narrative.beatsPresent.length,
      tensionCurve: narrative.complete ? "complete" : "incomplete",
    },
    physics: {
      simulated: physics.forces.length > 0,
      forcesDetected: physics.forces.map((f) => f.componentName ?? f.componentId),
      energyLevel: physics.totalSystemEnergy > 5 ? "high" : physics.totalSystemEnergy > 1 ? "moderate" : "low",
    },
    entropy: {
      overallEntropy: entropy.overallEntropyBits,
      densityWindows: entropy.densityWindows.length,
      mutualInformationPairs: entropy.mutualInformation.length,
    },
  };
}
