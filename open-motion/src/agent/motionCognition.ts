/**
 * Motion Cognition Engine — models the cognitive load a motion composition
 * imposes on the viewer.
 *
 * This original AI-native module applies cognitive psychology principles to
 * motion design. It models working memory demand, attention switching cost,
 * perceptual grouping (Gestalt principles), and processing fluency. The
 * output is a cognitive load score that predicts how mentally taxing the
 * composition is to perceive.
 *
 * Core concepts:
 * - Working Memory: Miller's 7±2 rule — humans track ~7 chunks at once
 * - Attention Switching: each new event costs cognitive resources
 * - Gestalt Grouping: similarity, proximity, continuity, closure
 * - Processing Fluency: familiar patterns are easier to process
 * - Cognitive Load: total mental effort required (intrinsic + extraneous)
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Working memory demand analysis. */
export interface WorkingMemoryDemand {
  /** Number of simultaneous elements the viewer must track. */
  simultaneousElements: number;
  /** Whether the demand exceeds Miller's 7±2 capacity. */
  exceedsCapacity: boolean;
  /** Demand level. */
  level: "low" | "moderate" | "high" | "overload";
  /** Number of chunks (grouped elements). */
  chunkCount: number;
  /** Description. */
  description: string;
}

/** Attention switching analysis. */
export interface AttentionSwitching {
  /** Number of distinct attention events per second. */
  eventsPerSecond: number;
  /** Total attention events. */
  totalEvents: number;
  /** Switching cost 0..1. */
  switchingCost: number;
  /** Level. */
  level: "low" | "moderate" | "high" | "overload";
  /** Description. */
  description: string;
}

/** Perceptual grouping analysis (Gestalt principles). */
export interface PerceptualGrouping {
  /** Number of groups detected by similarity. */
  similarityGroups: number;
  /** Number of groups detected by proximity (temporal). */
  proximityGroups: number;
  /** Number of groups detected by continuity (easing family). */
  continuityGroups: number;
  /** Grouping efficiency 0..1. */
  efficiency: number;
  /** Description. */
  description: string;
}

/** Processing fluency analysis. */
export interface ProcessingFluency {
  /** Fluency score 0..1 (1 = easy to process). */
  fluency: number;
  /** Familiarity score 0..1. */
  familiarity: number;
  /** Complexity score 0..1. */
  complexity: number;
  /** Description. */
  description: string;
}

/** Cognitive load analysis result. */
export interface CognitiveLoadAnalysis {
  /** Working memory demand. */
  workingMemory: WorkingMemoryDemand;
  /** Attention switching analysis. */
  attentionSwitching: AttentionSwitching;
  /** Perceptual grouping. */
  perceptualGrouping: PerceptualGrouping;
  /** Processing fluency. */
  processingFluency: ProcessingFluency;
  /** Overall cognitive load 0..1. */
  overallLoad: number;
  /** Load classification. */
  loadClass: "effortless" | "easy" | "moderate" | "demanding" | "overwhelming";
  /** Estimated sustained attention duration in seconds. */
  sustainedAttentionSec: number;
  /** Recommendations. */
  recommendations: string[];
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Working Memory Demand
// ---------------------------------------------------------------------------

/**
 * Compute working memory demand based on simultaneous elements.
 * Uses Miller's 7±2 rule: humans can hold ~7 chunks in working memory.
 */
export function computeWorkingMemoryDemand(spec: MotionSpec): WorkingMemoryDemand {
  if (spec.components.length === 0) {
    return {
      simultaneousElements: 0,
      exceedsCapacity: false,
      level: "low",
      chunkCount: 0,
      description: "No components — no working memory demand.",
    };
  }

  // Find the maximum number of overlapping components at any point in time
  const events: Array<{ time: number; type: "start" | "end" }> = [];
  for (const c of spec.components) {
    events.push({ time: c.delayMs, type: "start" });
    events.push({ time: c.delayMs + c.durationMs, type: "end" });
  }
  events.sort((a, b) => a.time - b.time || (a.type === "end" ? -1 : 1));

  let current = 0;
  let maxSimultaneous = 0;
  for (const e of events) {
    if (e.type === "start") {
      current++;
      maxSimultaneous = Math.max(maxSimultaneous, current);
    } else {
      current--;
    }
  }

  // Chunk count: group by easing family
  const easingFamilies = new Set<string>();
  for (const c of spec.components) {
    if (c.easing && typeof c.easing === "object") {
      easingFamilies.add(c.easing.type);
    }
  }
  const chunkCount = Math.max(1, easingFamilies.size);

  const exceedsCapacity = maxSimultaneous > 9;
  const level: WorkingMemoryDemand["level"] =
    maxSimultaneous <= 3 ? "low" :
    maxSimultaneous <= 5 ? "moderate" :
    maxSimultaneous <= 9 ? "high" :
    "overload";

  const description = `Peak of ${maxSimultaneous} simultaneous elements (Miller capacity 7±2) ` +
    `grouped into ${chunkCount} chunk(s) — ${level} demand` +
    (exceedsCapacity ? " (EXCEEDS CAPACITY)" : "");

  return {
    simultaneousElements: maxSimultaneous,
    exceedsCapacity,
    level,
    chunkCount,
    description,
  };
}

// ---------------------------------------------------------------------------
// Attention Switching
// ---------------------------------------------------------------------------

/**
 * Compute attention switching cost based on event frequency.
 */
export function computeAttentionSwitching(spec: MotionSpec): AttentionSwitching {
  if (spec.components.length === 0) {
    return {
      eventsPerSecond: 0,
      totalEvents: 0,
      switchingCost: 0,
      level: "low",
      description: "No events — no attention switching.",
    };
  }

  // Collect all start events (each start is an attention switch)
  const startEvents = spec.components
    .map((c) => c.delayMs)
    .sort((a, b) => a - b);

  const totalEvents = startEvents.length;
  const timelineEnd = spec.components.reduce(
    (max, c) => Math.max(max, c.delayMs + c.durationMs),
    0,
  );
  const timelineSec = timelineEnd / 1000;
  const eventsPerSecond = timelineSec > 0 ? totalEvents / timelineSec : 0;

  // Switching cost: high frequency = high cost
  // 0.5 events/sec = comfortable, 2+ events/sec = overload
  const switchingCost = Math.min(1, eventsPerSecond / 2);

  const level: AttentionSwitching["level"] =
    eventsPerSecond < 0.3 ? "low" :
    eventsPerSecond < 0.8 ? "moderate" :
    eventsPerSecond < 1.5 ? "high" :
    "overload";

  const description = `${totalEvents} attention events over ${timelineSec.toFixed(1)}s ` +
    `(${eventsPerSecond.toFixed(2)} events/sec) — ${level} switching cost`;

  return {
    eventsPerSecond,
    totalEvents,
    switchingCost,
    level,
    description,
  };
}

// ---------------------------------------------------------------------------
// Perceptual Grouping (Gestalt)
// ---------------------------------------------------------------------------

/**
 * Analyze perceptual grouping using Gestalt principles.
 */
export function computePerceptualGrouping(spec: MotionSpec): PerceptualGrouping {
  if (spec.components.length === 0) {
    return {
      similarityGroups: 0,
      proximityGroups: 0,
      continuityGroups: 0,
      efficiency: 0,
      description: "No components — no grouping.",
    };
  }

  // Similarity: group by easing family
  const easingGroups = new Map<string, number>();
  for (const c of spec.components) {
    const family = c.easing && typeof c.easing === "object"
      ? (c.easing.type === "preset" ? `preset:${c.easing.name}` : c.easing.type)
      : "none";
    easingGroups.set(family, (easingGroups.get(family) ?? 0) + 1);
  }
  const similarityGroups = easingGroups.size;

  // Proximity: group by temporal clustering
  const delays = spec.components.map((c) => c.delayMs).sort((a, b) => a - b);
  let proximityGroups = 1;
  for (let i = 1; i < delays.length; i++) {
    // New group if gap > 500ms
    if (delays[i] - delays[i - 1] > 500) {
      proximityGroups++;
    }
  }

  // Continuity: group by duration similarity
  const durationGroups = new Map<string, number>();
  for (const c of spec.components) {
    const bucket = c.durationMs < 500 ? "short" :
      c.durationMs < 2000 ? "medium" : "long";
    durationGroups.set(bucket, (durationGroups.get(bucket) ?? 0) + 1);
  }
  const continuityGroups = durationGroups.size;

  // Efficiency: fewer groups with more members = higher efficiency
  const totalComponents = spec.components.length;
  const avgGroupSize = totalComponents / (similarityGroups + proximityGroups + continuityGroups) * 3;
  const efficiency = Math.min(1, avgGroupSize / 3);

  const description = `Similarity: ${similarityGroups} group(s), proximity: ${proximityGroups} group(s), ` +
    `continuity: ${continuityGroups} group(s) — efficiency ${(efficiency * 100).toFixed(0)}%`;

  return {
    similarityGroups,
    proximityGroups,
    continuityGroups,
    efficiency,
    description,
  };
}

// ---------------------------------------------------------------------------
// Processing Fluency
// ---------------------------------------------------------------------------

/**
 * Compute processing fluency — how easy the motion is to perceive.
 */
export function computeProcessingFluency(spec: MotionSpec): ProcessingFluency {
  if (spec.components.length === 0) {
    return {
      fluency: 1,
      familiarity: 1,
      complexity: 0,
      description: "No components — perfect fluency.",
    };
  }

  // Familiarity: common easings (ease, smooth, linear) are familiar
  // Rare easings (elastic, bounce, custom bezier) are unfamiliar
  const familiarEasings = new Set(["ease", "ease-in", "ease-out", "ease-in-out", "smooth", "soft", "linear"]);
  let familiarCount = 0;
  for (const c of spec.components) {
    if (c.easing && typeof c.easing === "object") {
      if (c.easing.type === "preset" && familiarEasings.has(c.easing.name)) {
        familiarCount++;
      } else if (c.easing.type === "spring") {
        // Spring is moderately familiar
        familiarCount += 0.5;
      }
    } else {
      // No easing = default = familiar
      familiarCount++;
    }
  }
  const familiarity = familiarCount / spec.components.length;

  // Complexity: more keyframes, shorter durations, more properties = complex
  let complexityScore = 0;
  for (const c of spec.components) {
    const keyframeCount = c.keyframes?.length ?? 2;
    const durationComplexity = c.durationMs < 500 ? 0.8 : c.durationMs > 3000 ? 0.2 : 0.5;
    const propertyCount = c.keyframes?.[0]?.properties ? Object.keys(c.keyframes[0].properties).length : 1;
    complexityScore += (keyframeCount / 8) * 0.4 + durationComplexity * 0.3 + Math.min(1, propertyCount / 4) * 0.3;
  }
  const complexity = Math.min(1, complexityScore / spec.components.length);

  // Fluency = high familiarity, low complexity
  const fluency = familiarity * 0.6 + (1 - complexity) * 0.4;

  const description = `Fluency ${(fluency * 100).toFixed(0)}% (familiarity ${(familiarity * 100).toFixed(0)}%, ` +
    `complexity ${(complexity * 100).toFixed(0)}%)`;

  return {
    fluency,
    familiarity,
    complexity,
    description,
  };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze the cognitive load of a motion composition.
 */
export function analyzeCognitiveLoad(spec: MotionSpec): CognitiveLoadAnalysis {
  const workingMemory = computeWorkingMemoryDemand(spec);
  const attentionSwitching = computeAttentionSwitching(spec);
  const perceptualGrouping = computePerceptualGrouping(spec);
  const processingFluency = computeProcessingFluency(spec);

  // Overall load: weighted combination
  // - Working memory: 35% (most important)
  // - Attention switching: 25%
  // - Perceptual grouping (inverse): 20%
  // - Processing fluency (inverse): 20%
  const wmLoad = workingMemory.simultaneousElements / 9; // Normalize to Miller capacity
  const asLoad = attentionSwitching.switchingCost;
  const pgLoad = 1 - perceptualGrouping.efficiency;
  const pfLoad = 1 - processingFluency.fluency;

  const overallLoad = Math.min(
    1,
    wmLoad * 0.35 + asLoad * 0.25 + pgLoad * 0.20 + pfLoad * 0.20,
  );

  const loadClass: CognitiveLoadAnalysis["loadClass"] =
    overallLoad < 0.2 ? "effortless" :
    overallLoad < 0.4 ? "easy" :
    overallLoad < 0.6 ? "moderate" :
    overallLoad < 0.8 ? "demanding" :
    "overwhelming";

  // Estimated sustained attention: how long can a viewer maintain focus?
  // Higher load = shorter sustained attention
  const baseAttentionSec = 30; // 30 seconds baseline
  const sustainedAttentionSec = Math.max(2, Math.round(baseAttentionSec * (1 - overallLoad)));

  // Recommendations
  const recommendations: string[] = [];
  if (workingMemory.exceedsCapacity) {
    recommendations.push("Reduce simultaneous components below 9 to stay within working memory capacity");
  }
  if (workingMemory.level === "high" || workingMemory.level === "overload") {
    recommendations.push("Stagger component start times to reduce peak simultaneous elements");
  }
  if (attentionSwitching.level === "high" || attentionSwitching.level === "overload") {
    recommendations.push("Slow down the event rate — group events to reduce attention switching");
  }
  if (perceptualGrouping.efficiency < 0.5) {
    recommendations.push("Unify easing families and timing buckets to improve perceptual grouping");
  }
  if (processingFluency.complexity > 0.7) {
    recommendations.push("Simplify keyframe structure and lengthen short durations to improve fluency");
  }
  if (processingFluency.familiarity < 0.5) {
    recommendations.push("Use more familiar easing presets (ease, smooth, linear) to aid recognition");
  }
  if (recommendations.length === 0) {
    recommendations.push("Cognitive load is well-balanced — no adjustments needed");
  }

  const summary = `Cognitive load ${(overallLoad * 100).toFixed(0)}% (${loadClass}) — ` +
    `WM ${workingMemory.level}, AS ${attentionSwitching.level}, ` +
    `PG ${(perceptualGrouping.efficiency * 100).toFixed(0)}%, PF ${(processingFluency.fluency * 100).toFixed(0)}% — ` +
    `sustained attention ~${sustainedAttentionSec}s`;

  return {
    workingMemory,
    attentionSwitching,
    perceptualGrouping,
    processingFluency,
    overallLoad,
    loadClass,
    sustainedAttentionSec,
    recommendations,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a cognitive load analysis as a human-readable report. */
export function formatCognitionReport(analysis: CognitiveLoadAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Cognitive Load Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  lines.push("## Working Memory Demand");
  lines.push(`- ${analysis.workingMemory.description}`);
  lines.push("");

  lines.push("## Attention Switching");
  lines.push(`- ${analysis.attentionSwitching.description}`);
  lines.push("");

  lines.push("## Perceptual Grouping (Gestalt)");
  lines.push(`- ${analysis.perceptualGrouping.description}`);
  lines.push("");

  lines.push("## Processing Fluency");
  lines.push(`- ${analysis.processingFluency.description}`);
  lines.push("");

  lines.push("## Overall");
  lines.push(`- Load: ${(analysis.overallLoad * 100).toFixed(0)}% (${analysis.loadClass})`);
  lines.push(`- Sustained attention: ~${analysis.sustainedAttentionSec}s`);

  if (analysis.recommendations.length > 0) {
    lines.push("");
    lines.push("## Recommendations");
    for (const rec of analysis.recommendations) {
      lines.push(`- ${rec}`);
    }
  }

  return lines.join("\n");
}
