/**
 * Automatic Reflection Loop — post-turn self-assessment pipeline.
 *
 * Runs automatically after each successful agent turn: critique the resulting
 * spec, compute a quality score, and auto-apply concrete high-confidence
 * remediation patches. Different from the inline selfCorrectMotion (which
 * targets intent-verification gaps), this loop uses the structural critique
 * dimensions (accessibility, performance, aesthetic, consistency) to polish
 * the output independently of the original user prompt.
 *
 * The pipeline is bounded to at most two passes per turn and will never loop
 * infinitely — a pass-through flag (`appliedPasses`) breaks the chain when
 * diminishing returns kick in (<2 score delta between passes).
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";
import { critiqueMotion, formatCritiqueReport, type CritiqueReport, type Finding, type CritiqueDimension } from "./motionCritique.js";
import { autoFixAccessibility, type AutoFixOptions } from "./motionAutoFix.js";
import { recordFailure } from "./memory/failureMemory.js";
import { recordLineage } from "./motionLineage.js";

export interface ReflectionPatch {
  componentId: string;
  patch: Partial<MotionComponent>;
  reason: string;
  dimension: CritiqueDimension;
  confidence: number; // 0-1
}

export interface ReflectionPass {
  passNumber: number;
  scoreBefore: number;
  scoreAfter: number;
  patches: ReflectionPatch[];
  report: CritiqueReport;
}

export interface ReflectionResult {
  passes: ReflectionPass[];
  finalScore: number;
  scoreDelta: number;
  totalPatches: number;
  summary: string;
  warnings: string[];
}

// A patch is high-confidence when the critique finding severity is `critical`
// or `warning` AND the remediation is a simple numeric tweak (no heuristic
// trade-offs that could worsen other dimensions).
const HIGH_CONF_SEVERITIES = new Set<"critical" | "warning">(["critical", "warning"]);

/**
 * Derive concrete, safe-to-apply patches from a critique report.
 * Only returns patches with ≥0.7 confidence (simple numeric remediations).
 */
export function patchesFromCritique(report: CritiqueReport): ReflectionPatch[] {
  const patches: ReflectionPatch[] = [];

  for (const finding of report.findings) {
    if (!finding.componentId) continue;
    if (!HIGH_CONF_SEVERITIES.has(finding.severity as "critical" | "warning")) continue;

    const lower = finding.message.toLowerCase();
    const cid = finding.componentId;

    // --- Performance: long duration → clamp to 1500ms max
    if (finding.dimension === "performance" && lower.includes("duration") && lower.match(/1[5-9]\d{2,}|[2-9]\d{3,}/)) {
      patches.push({
        componentId: cid,
        patch: { durationMs: 1500 },
        reason: finding.message,
        dimension: "performance",
        confidence: 0.9,
      });
      continue;
    }

    // --- Performance: infinite iterations → cap at 5 loops (WCAG-friendly)
    if (finding.dimension === "performance" && lower.includes("infinite") && lower.includes("iteration")) {
      patches.push({
        componentId: cid,
        patch: { iterationCount: 5 },
        reason: finding.message,
        dimension: "accessibility",
        confidence: 0.85,
      });
      continue;
    }

    // --- Accessibility: vestibular risk → add prefers-reduced-motion friendly easing
    if (finding.dimension === "accessibility" && (lower.includes("vestibular") || lower.includes("reduced motion"))) {
      patches.push({
        componentId: cid,
        patch: { iterationCount: 1 },
        reason: finding.message,
        dimension: "accessibility",
        confidence: 0.8,
      });
      continue;
    }

    // --- Consistency: inconsistent duration → normalize to 800ms median
    if (finding.dimension === "consistency" && lower.includes("duration") && lower.includes("inconsistent")) {
      patches.push({
        componentId: cid,
        patch: { durationMs: 800 },
        reason: finding.message,
        dimension: "consistency",
        confidence: 0.7,
      });
      continue;
    }

    // --- Aesthetic: linear easing → apply smooth default
    if (finding.dimension === "aesthetic" && (lower.includes("linear") || lower.includes("easing")) && lower.includes("harsh")) {
      patches.push({
        componentId: cid,
        patch: { easing: { type: "preset", name: "ease-out-cubic" } },
        reason: finding.message,
        dimension: "aesthetic",
        confidence: 0.75,
      });
      continue;
    }
  }

  // De-duplicate: only apply the highest-confidence patch per component+dimension
  const seen = new Map<string, ReflectionPatch>();
  for (const p of patches) {
    const key = `${p.componentId}-${p.dimension}`;
    const prev = seen.get(key);
    if (!prev || p.confidence > prev.confidence) seen.set(key, p);
  }
  return Array.from(seen.values());
}

/**
 * Apply patches to the spec in a pure-functional manner (mutates a clone).
 * Returns the new spec + the list of components actually changed so the
 * caller can notify event listeners.
 */
export function applyPatchesToSpec(
  spec: MotionSpec,
  patches: ReflectionPatch[],
): { spec: MotionSpec; changedIds: string[] } {
  const changedIds: string[] = [];
  const patchMap = new Map<string, ReflectionPatch[]>();
  for (const p of patches) {
    const arr = patchMap.get(p.componentId) ?? [];
    arr.push(p);
    patchMap.set(p.componentId, arr);
  }
  const newComponents = spec.components.map((c) => {
    const patchList = patchMap.get(c.id);
    if (!patchList) return c;
    let merged: Partial<MotionComponent> = {};
    for (const p of patchList) merged = { ...merged, ...p.patch };
    changedIds.push(c.id);
    return { ...c, ...merged };
  });
  return {
    spec: { ...spec, components: newComponents },
    changedIds,
  };
}

// Diminishing returns: if a pass improves the overall score by less than this
// threshold, we stop rather than chasing marginal deltas.
const DELTA_THRESHOLD = 2;
const MAX_PASSES = 2;

/**
 * Run the automatic post-turn reflection loop.
 *
 * @param spec The freshly-mutated spec after tool execution completed.
 * @param userMessage The original user prompt (for memory attribution).
 * @param projectId Project id for lineage/failure recording.
 * @param mutator Callback that persists patches (so the caller controls DB writes).
 * @returns The loop result with per-pass scores and a human-readable summary.
 */
export async function runReflectionLoop(
  spec: MotionSpec,
  userMessage: string,
  projectId: string,
  mutator: (patch: ReflectionPatch) => Promise<void>,
): Promise<ReflectionResult> {
  const passes: ReflectionPass[] = [];
  const warnings: string[] = [];
  let workingSpec = spec;
  let previousScore = -1;

  for (let i = 0; i < MAX_PASSES; i++) {
    const report = critiqueMotion(workingSpec);
    const scoreBefore = report.overallScore;
    const rawPatches = patchesFromCritique(report);

    // Also run the structural accessibility autofix for a second pass
    let a11yPatches: ReflectionPatch[] = [];
    try {
      const a11y = autoFixAccessibility(workingSpec.components, { prefersReducedMotion: false, maxAnimation: 5 } as AutoFixOptions);
      // Build a lookup of fixed components by id so we can derive concrete
      // MotionComponent patches directly from the remediated final values.
      const fixedById = new Map(a11y.fixedComponents.map((c) => [c.id, c]));
      for (const fix of a11y.result.fixes) {
        const fixedComp = fixedById.get(fix.componentId);
        // Derive a best-effort patch from the (field,after) pair. For any
        // field we don't know how to parse, fall back to an empty patch
        // (the structural changes in fixedComponents are already valid).
        let derivedPatch: Partial<MotionComponent> = {};
        switch (fix.field) {
          case "durationMs":
            derivedPatch = { durationMs: parseInt(fix.after, 10) || undefined };
            break;
          case "delayMs":
            derivedPatch = { delayMs: parseInt(fix.after, 10) || undefined };
            break;
          case "iterationCount": {
            const n = parseInt(fix.after, 10);
            derivedPatch = { iterationCount: Number.isNaN(n) ? 1 : n };
            break;
          }
          case "easing":
            try {
              derivedPatch = { easing: JSON.parse(fix.after) };
            } catch {
              // leave empty if JSON parse fails
            }
            break;
          default:
            // Keyframe-level or other granular fields: if we have the
            // fixed component, lift the whole keyframes/style so the
            // final visual state matches what autoFixAccessibility built.
            if (fixedComp && fix.field.startsWith("keyframe")) {
              derivedPatch = { keyframes: fixedComp.keyframes, style: fixedComp.style };
            }
        }
        const reasonText = `${fix.category}: ${fix.issue} → ${fix.fix}`;
        a11yPatches.push({
          componentId: fix.componentId,
          patch: derivedPatch,
          reason: reasonText,
          dimension: "accessibility",
          confidence: 0.8,
        });
      }
    } catch (e) {
      warnings.push(`accessibility autofix skipped: ${e instanceof Error ? e.message : String(e)}`);
    }

    const allPatches = [...rawPatches, ...a11yPatches];

    // Apply patches to both the working spec (for the next pass) and the real DB.
    const { spec: nextSpec, changedIds } = applyPatchesToSpec(workingSpec, allPatches);

    if (changedIds.length === 0) {
      passes.push({ passNumber: i + 1, scoreBefore, scoreAfter: scoreBefore, patches: [], report });
      break;
    }

    for (const p of allPatches) {
      try {
        await mutator(p);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Failure memory signature: tool = reflectionLoop, summary = dimension, suggestion = reason
        recordFailure("reflectionLoop", p.dimension, p.reason ?? msg, projectId);
      }
    }

    // Record lineage for each modified component so the user can trace
    // exactly which edits came from the reflection loop vs user actions.
    for (const cid of changedIds) {
      try {
        const params = {
          pass: i + 1,
          reasons: allPatches.filter((x) => x.componentId === cid).map((x) => x.reason),
        };
        recordLineage(projectId, cid, `reflection-loop-pass-${i + 1}`, "variation", [], params);
      } catch { /* lineage best-effort only */ }
    }

    const reportAfter = critiqueMotion(nextSpec);
    const scoreAfter = reportAfter.overallScore;
    passes.push({ passNumber: i + 1, scoreBefore, scoreAfter, patches: allPatches, report });

    workingSpec = nextSpec;

    // Termination: diminishing returns
    if (previousScore !== -1 && Math.abs(scoreAfter - previousScore) < DELTA_THRESHOLD) break;
    previousScore = scoreAfter;
  }

  const finalScore = passes.length > 0 ? passes[passes.length - 1].scoreAfter : critiqueMotion(workingSpec).overallScore;
  const initialScore = passes.length > 0 ? passes[0].scoreBefore : finalScore;
  const totalPatches = passes.reduce((n, p) => n + p.patches.length, 0);

  const summary = [
    `Quality score: ${initialScore} → ${finalScore} (${finalScore >= initialScore ? "+" : ""}${finalScore - initialScore})`,
    totalPatches > 0 ? `${totalPatches} automatic ${totalPatches === 1 ? "remediation" : "remediations"} applied across ${passes.length} ${passes.length === 1 ? "pass" : "passes"}.` : "No remediations needed.",
  ].join(" ");

  return { passes, finalScore, scoreDelta: finalScore - initialScore, totalPatches, summary, warnings };
}

/**
 * Format the reflection result for display in the chat scratchpad / memory.
 */
export function formatReflectionReport(result: ReflectionResult): string {
  const lines: string[] = [];
  lines.push(`[Reflection Loop] ${result.summary}`);
  for (const p of result.passes) {
    if (p.patches.length === 0) continue;
    lines.push(`  Pass ${p.passNumber} (${p.scoreBefore}→${p.scoreAfter}): ${p.patches.length} patch${p.patches.length === 1 ? "" : "es"}`);
    for (const patch of p.patches) {
      lines.push(`    • [${patch.dimension}] ${patch.componentId}: ${patch.reason} (conf ${patch.confidence.toFixed(2)})`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push(`  Warnings: ${result.warnings.join("; ")}`);
  }
  return lines.join("\n");
}
