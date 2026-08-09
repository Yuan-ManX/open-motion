import type { MotionSpec, MotionComponent, Easing } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import {
  verifyMotion,
  type VerificationReport,
  type VerificationAssertion,
} from "./motionVerification.js";

/**
 * Verification-driven self-correction engine.
 *
 * Turns each failed verification assertion's stable `kind` into a concrete
 * component patch, applies the patches to a spec copy, and re-verifies so the
 * caller gets a before/after diff proving the gap closed.
 */

/** A single concrete patch produced by the remediation map. */
export interface RemediationApply {
  /** Assertion kind that triggered this fix (e.g. "easing.bouncy"). */
  kind: string;
  /** Human-readable claim that was failing. */
  claim: string;
  /** Target component the patch applies to. */
  componentId: string;
  /** Partial component patch consumed by `patchComponent`. */
  patch: Record<string, unknown>;
  /** Why this patch closes the gap. */
  reason: string;
}

export interface SelfCorrectionReport {
  /** Intent the correction was verified against. */
  intent: string;
  /** Verification result before any fixes were applied. */
  before: VerificationReport;
  /** Verification result after the fixes were applied. */
  after: VerificationReport;
  /** Fixes the engine attempted, in application order. */
  applied: RemediationApply[];
  /** True when the spec went from not-achieved to achieved. */
  fixed: boolean;
  /** True when the achieved ratio strictly improved. */
  improved: boolean;
}

/**
 * A remediation producer: given the failing assertion and the current spec,
 * returns zero or more concrete patches. Returns empty when the producer
 * declines to act (e.g. no component to patch).
 */
type RemediationProducer = (
  assertion: VerificationAssertion,
  spec: MotionSpec,
) => RemediationApply[];

const BOUNCY_EASING: Easing = easingPreset("bounce");
const SMOOTH_EASING: Easing = easingPreset("smooth");
const SNAPPY_EASING: Easing = easingPreset("snappy");

/** Pick the first component, preferring ones that don't already satisfy the gap. */
function pickFirstComponent(spec: MotionSpec, predicate: (c: MotionComponent) => boolean): MotionComponent | null {
  const failing = spec.components.find((c) => !predicate(c));
  return failing ?? spec.components[0] ?? null;
}

const REMEDIATIONS: Record<string, RemediationProducer> = {
  "easing.bouncy": (_a, spec) => {
    const target = pickFirstComponent(spec, (c) => /bounce|elastic|back|spring/i.test(c.easing.type === "preset" ? c.easing.name : c.easing.type));
    if (!target) return [];
    return [{
      kind: "easing.bouncy",
      claim: "At least one component uses a bouncy easing family.",
      componentId: target.id,
      patch: { easing: BOUNCY_EASING },
      reason: "Switched the easing to the bounce preset so a bouncy character is present.",
    }];
  },
  "easing.smooth": (_a, spec) => {
    const target = pickFirstComponent(spec, (c) => /smooth|ease-in-out|ease-out/i.test(c.easing.type === "preset" ? c.easing.name : c.easing.type));
    if (!target) return [];
    return [{
      kind: "easing.smooth",
      claim: "At least one component uses a smooth easing family.",
      componentId: target.id,
      patch: { easing: SMOOTH_EASING },
      reason: "Switched the easing to the smooth preset so a calm character is present.",
    }];
  },
  "easing.snappy": (_a, spec) => {
    const target = pickFirstComponent(spec, (c) => /snappy|ease-in|linear/i.test(c.easing.type === "preset" ? c.easing.name : c.easing.type));
    if (!target) return [];
    return [{
      kind: "easing.snappy",
      claim: "At least one component uses a snappy easing family.",
      componentId: target.id,
      patch: { easing: SNAPPY_EASING },
      reason: "Switched the easing to the snappy preset so a crisp character is present.",
    }];
  },
  "duration.long": (_a, spec) => {
    const target = pickFirstComponent(spec, (c) => c.durationMs >= 800);
    if (!target) return [];
    return [{
      kind: "duration.long",
      claim: "At least one component duration is 800ms or longer.",
      componentId: target.id,
      patch: { durationMs: 800 },
      reason: "Raised the duration to 800ms to satisfy the slower/longer request.",
    }];
  },
  "duration.short": (_a, spec) => {
    const target = pickFirstComponent(spec, (c) => c.durationMs <= 400);
    if (!target) return [];
    return [{
      kind: "duration.short",
      claim: "At least one component duration is 400ms or shorter.",
      componentId: target.id,
      patch: { durationMs: 400 },
      reason: "Lowered the duration to 400ms to satisfy the faster/shorter request.",
    }];
  },
  // Note: loop.infinite and loop.once are intentionally NOT in the auto
  // remediation map. The loop count is ambiguous ("loop 3 times" vs "loop
  // forever") and the verification assertion cannot distinguish them from the
  // message text alone, so auto-applying a loop-count patch risks correcting
  // a non-error. The verification report still surfaces the gap as a hint.
  "color.present": (_a, spec) => {
    const target = pickFirstComponent(spec, (c) => {
      const s = c.style ?? {};
      return typeof s.color === "string" || typeof s.background === "string" || typeof s.backgroundColor === "string";
    });
    if (!target) return [];
    return [{
      kind: "color.present",
      claim: "At least one component carries an explicit color or background.",
      componentId: target.id,
      patch: { style: { ...(target.style ?? {}), background: "#3b82f6" } },
      reason: "Added an explicit background color so a color is present.",
    }];
  },
  "stagger.spread": (_a, spec) => {
    if (spec.components.length < 2) return [];
    const stepMs = 120;
    return spec.components.map((c, i) => ({
      kind: "stagger.spread",
      claim: "Components stagger across at least 2 distinct delay values.",
      componentId: c.id,
      patch: { delayMs: i * stepMs },
      reason: `Set delay to ${i * stepMs}ms so the start times spread into a stagger.`,
    }));
  },
};

/**
 * Apply a list of remediation patches to a structural clone of the spec and
 * return the patched copy. Patches are keyed by componentId; later patches for
 * the same component merge into earlier ones.
 */
function applyPatchesToClone(spec: MotionSpec, applies: RemediationApply[]): MotionSpec {
  const cloned: MotionSpec = {
    ...spec,
    components: spec.components.map((c) => ({
      ...c,
      keyframes: c.keyframes.map((k) => ({ ...k, properties: { ...k.properties } })),
      style: c.style ? { ...c.style } : {},
    })),
    project: { ...spec.project },
  };
  for (const apply of applies) {
    const idx = cloned.components.findIndex((c) => c.id === apply.componentId);
    if (idx < 0) continue;
    const comp = cloned.components[idx];
    for (const [key, value] of Object.entries(apply.patch)) {
      if (key === "style" && typeof value === "object" && value !== null) {
        comp.style = { ...comp.style, ...(value as Record<string, string | number>) };
      } else {
        (comp as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }
  return cloned;
}

/**
 * Run one bounded self-correction pass against the spec.
 *
 * Compiles the intent into assertions via `verifyMotion`, and for each failed
 * required assertion whose `kind` has a registered producer, computes and
 * applies the concrete patch. Then re-verifies so the caller gets a before/
 * after diff. The function never mutates the input spec — it returns the list
 * of patches the caller must apply to the live project.
 */
export function selfCorrectMotion(
  intent: string,
  spec: MotionSpec,
): SelfCorrectionReport {
  const before = verifyMotion(intent, spec);
  if (before.achieved) {
    return { intent, before, after: before, applied: [], fixed: false, improved: false };
  }

  const failedRequired = before.assertions.filter(
    (a) => a.verdict === "fail" && a.severity === "required" && a.kind.length > 0,
  );

  const applied: RemediationApply[] = [];
  const seenKinds = new Set<string>();
  for (const assertion of failedRequired) {
    // Skip duplicate kinds (e.g. multiple trigger assertions) to avoid
    // conflicting patches within a single pass.
    if (seenKinds.has(assertion.kind)) continue;
    seenKinds.add(assertion.kind);
    const producer = REMEDIATIONS[assertion.kind];
    if (!producer) continue;
    const fixes = producer(assertion, spec);
    for (const fix of fixes) {
      // Avoid double-patching the same component for the same kind.
      if (applied.some((a) => a.componentId === fix.componentId && a.kind === fix.kind)) continue;
      applied.push(fix);
    }
  }

  if (applied.length === 0) {
    return { intent, before, after: before, applied: [], fixed: false, improved: false };
  }

  const patched = applyPatchesToClone(spec, applied);
  const after = verifyMotion(intent, patched);

  return {
    intent,
    before,
    after,
    applied,
    fixed: !before.achieved && after.achieved,
    improved: after.achievedRatio > before.achievedRatio,
  };
}

/** Human-readable summary of a self-correction pass. */
export function formatSelfCorrectionReport(report: SelfCorrectionReport): string {
  if (report.applied.length === 0) {
    return report.before.achieved
      ? "Self-correction skipped: the motion already satisfies the stated intent."
      : "Self-correction found no automatable gaps — remaining gaps need an explicit tool call.";
  }
  const beforePct = Math.round(report.before.achievedRatio * 100);
  const afterPct = Math.round(report.after.achievedRatio * 100);
  const headline = report.fixed
    ? "Intent achieved after self-correction."
    : report.improved
      ? `Intent coverage improved (${beforePct}% → ${afterPct}%).`
      : `Applied ${report.applied.length} fix(es) but the intent is still not fully met.`;
  const fixes = report.applied
    .map((a) => `  • ${a.kind} → ${a.componentId}: ${a.reason}`)
    .join("\n");
  return `${headline}\nApplied ${report.applied.length} remediation(s):\n${fixes}`;
}
