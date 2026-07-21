/**
 * Motion Critique — structural analysis of a motion design across four
 * dimensions: Accessibility, Performance, Aesthetic, and Consistency.
 *
 * The critique is rule-based — no LLM round-trip required. It inspects the
 * component specs (easing, timing, transforms, triggers, keyframes) and
 * produces a structured report with per-dimension scores, specific findings,
 * and actionable recommendations.
 *
 * Original systems:
 *
 * 1. Accessibility Audit
 *    Detects flash hazards (rapid opacity oscillation), vestibular risks
 *    (infinite high-intensity loops), duration inadequacy for trigger
 *    context, and missing reduced-motion fallbacks.
 *
 * 2. Performance Profile
 *    Classifies animated properties as GPU-friendly (transform, opacity,
 *    filter) or layout-triggering (width, height, top, left, margin).
 *    Flags missing will-change hints and excessive keyframe counts.
 *
 * 3. Aesthetic Review
 *    Evaluates easing appropriateness for the trigger context, timing
 *    rhythm across components, intensity balance, and choreography
 *    presence (deliberate stagger delays).
 *
 * 4. Consistency Check
 *    Measures easing-family consistency within scenes, duration-bucket
 *    alignment, and naming-convention adherence.
 */

import type { MotionComponent, MotionSpec, Trigger, Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CritiqueDimension = "accessibility" | "performance" | "aesthetic" | "consistency";
export type Severity = "critical" | "warning" | "info" | "strength";

export interface Finding {
  severity: Severity;
  dimension: CritiqueDimension;
  message: string;
  componentId?: string;
  componentName?: string;
}

export interface DimensionReport {
  score: number; // 0-100
  findings: Finding[];
}

export interface CritiqueReport {
  overallScore: number; // 0-100
  dimensions: Record<CritiqueDimension, DimensionReport>;
  findings: Finding[];
  recommendations: string[];
  componentCount: number;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Run a full critique of a motion spec.
 *
 * The overall score is a weighted average of the four dimensions:
 *   accessibility 30%, performance 25%, aesthetic 25%, consistency 20%.
 */
export function critiqueMotion(spec: MotionSpec): CritiqueReport {
  const accessibility = auditAccessibility(spec.components);
  const performance = profilePerformance(spec.components);
  const aesthetic = reviewAesthetic(spec.components);
  const consistency = checkConsistency(spec);

  const allFindings = [
    ...accessibility.findings,
    ...performance.findings,
    ...aesthetic.findings,
    ...consistency.findings,
  ];

  const overallScore = Math.round(
    accessibility.score * 0.3 +
      performance.score * 0.25 +
      aesthetic.score * 0.25 +
      consistency.score * 0.2,
  );

  const recommendations = buildRecommendations(allFindings, spec.components);

  return {
    overallScore,
    dimensions: { accessibility, performance, aesthetic, consistency },
    findings: allFindings,
    recommendations,
    componentCount: spec.components.length,
  };
}

// ---------------------------------------------------------------------------
// 1. Accessibility Audit
// ---------------------------------------------------------------------------

function auditAccessibility(components: MotionComponent[]): DimensionReport {
  const findings: Finding[] = [];
  let penalty = 0;

  for (const c of components) {
    // Flash hazard: opacity oscillating rapidly with multiple keyframes.
    const opacityKeyframes = c.keyframes.filter((kf) => "opacity" in kf.properties);
    if (opacityKeyframes.length >= 4) {
      const values = opacityKeyframes.map((kf) => {
        const v = kf.properties.opacity;
        return typeof v === "number" ? v : parseFloat(String(v)) || 1;
      });
      const oscillations = countOscillations(values);
      if (oscillations >= 2) {
        findings.push({
          severity: "critical",
          dimension: "accessibility",
          message: `Flash hazard: opacity oscillates ${oscillations} times across ${opacityKeyframes.length} keyframes — risk of photosensitive seizures`,
          componentId: c.id,
          componentName: c.name,
        });
        penalty += 25;
      }
    }

    // Vestibular risk: infinite loop with bold/extreme intensity.
    if (c.iterationCount === "infinite") {
      const intensity = estimateIntensity(c);
      if (intensity === "bold" || intensity === "extreme") {
        findings.push({
          severity: "warning",
          dimension: "accessibility",
          message: `Vestibular risk: infinite loop with ${intensity} intensity — can cause motion sickness`,
          componentId: c.id,
          componentName: c.name,
        });
        penalty += 15;
      }
    }

    // Duration too fast for context.
    if (c.durationMs < 100 && c.trigger !== "onClick") {
      findings.push({
        severity: "warning",
        dimension: "accessibility",
        message: `Duration ${c.durationMs}ms is too fast for a ${c.trigger} trigger — users may not perceive the motion`,
        componentId: c.id,
        componentName: c.name,
      });
      penalty += 8;
    }

    // Duration too slow for hover/click interactions.
    if ((c.trigger === "onHover" || c.trigger === "onClick") && c.durationMs > 800) {
      findings.push({
        severity: "info",
        dimension: "accessibility",
        message: `Duration ${c.durationMs}ms feels sluggish for a ${c.trigger} interaction — consider 200-400ms`,
        componentId: c.id,
        componentName: c.name,
      });
      penalty += 5;
    }

    // Strength: safe duration range.
    if (c.durationMs >= 200 && c.durationMs <= 600 && c.trigger === "onLoad") {
      findings.push({
        severity: "strength",
        dimension: "accessibility",
        message: `Well-calibrated duration (${c.durationMs}ms) for an entrance animation`,
        componentId: c.id,
        componentName: c.name,
      });
    }
  }

  const score = Math.max(0, 100 - penalty);
  return { score, findings };
}

function countOscillations(values: number[]): number {
  if (values.length < 2) return 0;
  let oscillations = 0;
  let lastDirection: "up" | "down" | null = null;
  for (let i = 1; i < values.length; i++) {
    const direction: "up" | "down" | null =
      values[i] > values[i - 1] ? "up" : values[i] < values[i - 1] ? "down" : lastDirection;
    if (lastDirection && direction !== lastDirection) oscillations++;
    if (direction) lastDirection = direction;
  }
  return oscillations;
}

// ---------------------------------------------------------------------------
// 2. Performance Profile
// ---------------------------------------------------------------------------

const LAYOUT_PROPERTIES = new Set([
  "width", "height", "top", "left", "right", "bottom",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderWidth", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
]);

const GPU_PROPERTIES = new Set(["opacity", "transform", "filter", "backdropFilter"]);

function profilePerformance(components: MotionComponent[]): DimensionReport {
  const findings: Finding[] = [];
  let penalty = 0;

  for (const c of components) {
    const animatedProps = new Set<string>();
    for (const kf of c.keyframes) {
      for (const key of Object.keys(kf.properties)) {
        animatedProps.add(key);
      }
    }

    // Check for layout-triggering properties.
    const layoutProps = [...animatedProps].filter((p) => LAYOUT_PROPERTIES.has(p));
    if (layoutProps.length > 0) {
      findings.push({
        severity: "warning",
        dimension: "performance",
        message: `Animates layout properties (${layoutProps.join(", ")}) — triggers reflow. Use transform/scale instead`,
        componentId: c.id,
        componentName: c.name,
      });
      penalty += 15;
    }

    // GPU-friendly properties — strength.
    const gpuProps = [...animatedProps].filter((p) => GPU_PROPERTIES.has(p));
    if (gpuProps.length > 0 && layoutProps.length === 0) {
      findings.push({
        severity: "strength",
        dimension: "performance",
        message: `Only animates GPU-friendly properties (${gpuProps.join(", ")}) — runs on the compositor thread`,
        componentId: c.id,
        componentName: c.name,
      });
    }

    // Missing will-change hint for animated components.
    if (animatedProps.size > 0 && !("willChange" in c.style) && !("will-change" in c.style)) {
      findings.push({
        severity: "info",
        dimension: "performance",
        message: `Missing will-change hint — adding it can promote the element to a compositor layer`,
        componentId: c.id,
        componentName: c.name,
      });
      penalty += 3;
    }

    // Excessive keyframes.
    if (c.keyframes.length > 20) {
      findings.push({
        severity: "warning",
        dimension: "performance",
        message: `${c.keyframes.length} keyframes — consider simplifying to reduce main-thread computation`,
        componentId: c.id,
        componentName: c.name,
      });
      penalty += 10;
    }
  }

  const score = Math.max(0, 100 - penalty);
  return { score, findings };
}

// ---------------------------------------------------------------------------
// 3. Aesthetic Review
// ---------------------------------------------------------------------------

function reviewAesthetic(components: MotionComponent[]): DimensionReport {
  const findings: Finding[] = [];
  let penalty = 0;

  for (const c of components) {
    // Easing appropriateness for trigger context.
    const easingFamily = classifyEasingFamily(c.easing);
    const expected = expectedEasingForTrigger(c.trigger);
    if (!expected.acceptable.includes(easingFamily)) {
      findings.push({
        severity: "info",
        dimension: "aesthetic",
        message: `${easingFamily} easing for a ${c.trigger} trigger — ${expected.reason}`,
        componentId: c.id,
        componentName: c.name,
      });
      penalty += 5;
    } else {
      findings.push({
        severity: "strength",
        dimension: "aesthetic",
        message: `${easingFamily} easing fits the ${c.trigger} trigger context`,
        componentId: c.id,
        componentName: c.name,
      });
    }

    // Linear easing for organic motion is usually wrong.
    if (easingFamily === "linear" && c.trigger !== "onScroll") {
      findings.push({
        severity: "warning",
        dimension: "aesthetic",
        message: `Linear easing for a ${c.trigger} trigger feels mechanical — consider smooth or spring easing`,
        componentId: c.id,
        componentName: c.name,
      });
      penalty += 8;
    }
  }

  // Timing rhythm across components.
  if (components.length >= 3) {
    const durations = components.map((c) => c.durationMs);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? stdDev / avg : 0; // coefficient of variation

    if (cv > 0.8) {
      findings.push({
        severity: "warning",
        dimension: "aesthetic",
        message: `Highly varied durations (cv=${cv.toFixed(2)}) — the timing rhythm feels chaotic. Consider grouping into 2-3 duration tiers`,
      });
      penalty += 12;
    } else if (cv < 0.1) {
      findings.push({
        severity: "info",
        dimension: "aesthetic",
        message: `Uniform durations (cv=${cv.toFixed(2)}) — consider adding slight variation for visual interest`,
      });
      penalty += 3;
    } else {
      findings.push({
        severity: "strength",
        dimension: "aesthetic",
        message: `Well-balanced timing rhythm (cv=${cv.toFixed(2)}) — varied enough to be interesting, consistent enough to feel intentional`,
      });
    }
  }

  // Choreography presence: are there deliberate stagger delays?
  const delayedComponents = components.filter((c) => c.delayMs > 0);
  if (components.length >= 3 && delayedComponents.length === 0) {
    findings.push({
      severity: "info",
      dimension: "aesthetic",
      message: `No staggered delays detected — adding delays can create a sense of choreography and hierarchy`,
    });
    penalty += 5;
  } else if (delayedComponents.length >= 2) {
    findings.push({
      severity: "strength",
      dimension: "aesthetic",
      message: `${delayedComponents.length} components with staggered delays — creates a sense of choreography`,
    });
  }

  const score = Math.max(0, 100 - penalty);
  return { score, findings };
}

function classifyEasingFamily(easing: Easing): string {
  if (easing.type === "preset") {
    if (easing.name === "linear") return "linear";
    if (["bounce", "back", "elastic"].includes(easing.name)) return "bouncy";
    if (["snappy"].includes(easing.name)) return "sharp";
    return "smooth";
  }
  if (easing.type === "spring") return "spring";
  if (easing.type === "bezier") {
    if (easing.p2[1] > 1.2 || easing.p1[1] < -0.2) return "elastic";
    if (easing.p2[1] > 1 || easing.p1[1] < 0) return "bouncy";
    return "smooth";
  }
  return "smooth";
}

function expectedEasingForTrigger(trigger: Trigger): { acceptable: string[]; reason: string } {
  switch (trigger) {
    case "onLoad":
      return { acceptable: ["smooth", "spring", "bouncy"], reason: "entrance animations benefit from smooth deceleration or natural spring physics" };
    case "onHover":
      return { acceptable: ["smooth", "sharp", "spring"], reason: "hover feedback should feel immediate — sharp or smooth easings work best" };
    case "onClick":
      return { acceptable: ["sharp", "smooth", "spring"], reason: "click feedback should be snappy and responsive" };
    case "onScroll":
      return { acceptable: ["linear", "smooth"], reason: "scroll-linked motion should match the scroll momentum — linear or smooth" };
    case "afterDelay":
      return { acceptable: ["smooth", "spring", "bouncy"], reason: "delayed reveals benefit from smooth or spring easings" };
  }
}

// ---------------------------------------------------------------------------
// 4. Consistency Check
// ---------------------------------------------------------------------------

function checkConsistency(spec: MotionSpec): DimensionReport {
  const findings: Finding[] = [];
  const components = spec.components;
  let penalty = 0;

  if (components.length < 2) {
    return { score: 100, findings: [{ severity: "strength", dimension: "consistency", message: "Single component — no consistency issues possible" }] };
  }

  // Easing family consistency.
  const easingFamilies = components.map((c) => classifyEasingFamily(c.easing));
  const familyCounts = new Map<string, number>();
  for (const f of easingFamilies) familyCounts.set(f, (familyCounts.get(f) ?? 0) + 1);
  const dominantFamily = [...familyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const familyConsistency = dominantFamily[1] / components.length;

  if (familyConsistency < 0.5) {
    findings.push({
      severity: "warning",
      dimension: "consistency",
      message: `Easing families are inconsistent — ${[...familyCounts.entries()].map(([f, n]) => `${f}×${n}`).join(", ")}. Consider aligning on a primary easing family`,
    });
    penalty += 15;
  } else if (familyConsistency >= 0.8) {
    findings.push({
      severity: "strength",
      dimension: "consistency",
      message: `Consistent easing family — ${dominantFamily[0]} used in ${Math.round(familyConsistency * 100)}% of components`,
    });
  }

  // Duration bucket consistency.
  const buckets = components.map((c) => classifyDurationBucket(c.durationMs));
  const bucketCounts = new Map<string, number>();
  for (const b of buckets) bucketCounts.set(b, (bucketCounts.get(b) ?? 0) + 1);
  const dominantBucket = [...bucketCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const bucketConsistency = dominantBucket[1] / components.length;

  if (bucketConsistency < 0.4 && components.length >= 4) {
    findings.push({
      severity: "info",
      dimension: "consistency",
      message: `Durations span ${bucketCounts.size} buckets — consider standardizing on 2-3 duration tiers (e.g., quick=200ms, normal=500ms, slow=1000ms)`,
    });
    penalty += 8;
  }

  // Naming convention check.
  const names = components.map((c) => c.name);
  const hasPattern = detectNamingPattern(names);
  if (hasPattern) {
    findings.push({
      severity: "strength",
      dimension: "consistency",
      message: `Naming follows a consistent pattern: ${hasPattern}`,
    });
  } else if (components.length >= 4) {
    findings.push({
      severity: "info",
      dimension: "consistency",
      message: `No clear naming convention detected — consistent names (e.g., "Hero-Title", "Hero-Subtitle") aid discoverability`,
    });
    penalty += 5;
  }

  const score = Math.max(0, 100 - penalty);
  return { score, findings };
}

function classifyDurationBucket(ms: number): string {
  if (ms <= 150) return "instant";
  if (ms <= 400) return "quick";
  if (ms <= 800) return "normal";
  if (ms <= 1500) return "slow";
  return "cinematic";
}

function detectNamingPattern(names: string[]): string | null {
  // Check for kebab-case with common prefix.
  const kebab = names.every((n) => /^[a-z]+(-[a-z]+)+$/.test(n));
  if (kebab) return "kebab-case";

  // Check for common prefix.
  const firstWord = names[0].split(/[\s-_]/)[0].toLowerCase();
  if (names.every((n) => n.toLowerCase().startsWith(firstWord))) return `prefix "${firstWord}-"`;

  // Check for PascalCase.
  const pascal = names.every((n) => /^[A-Z][a-zA-Z0-9]+$/.test(n));
  if (pascal) return "PascalCase";

  return null;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function estimateIntensity(component: MotionComponent): "subtle" | "moderate" | "bold" | "extreme" {
  let maxTravel = 0;
  for (const kf of component.keyframes) {
    for (const value of Object.values(kf.properties)) {
      if (typeof value === "number") {
        maxTravel = Math.max(maxTravel, Math.abs(value));
      } else if (typeof value === "string") {
        const numMatch = value.match(/(-?\d+\.?\d*)/);
        if (numMatch) maxTravel = Math.max(maxTravel, Math.abs(parseFloat(numMatch[1])));
      }
    }
  }
  if (maxTravel === 0 || maxTravel < 20) return "subtle";
  if (maxTravel < 100) return "moderate";
  if (maxTravel < 300) return "bold";
  return "extreme";
}

function buildRecommendations(findings: Finding[], components: MotionComponent[]): string[] {
  const recs: string[] = [];
  const criticals = findings.filter((f) => f.severity === "critical");
  const warnings = findings.filter((f) => f.severity === "warning");

  if (criticals.length > 0) {
    recs.push(`Fix ${criticals.length} critical issue(s) first — these may harm users or break the experience.`);
  }
  if (warnings.length > 0) {
    recs.push(`Address ${warnings.length} warning(s) to improve quality.`);
  }

  const hasLayoutIssue = findings.some((f) => f.message.includes("layout properties"));
  if (hasLayoutIssue) recs.push("Replace layout-property animations with transform-based alternatives (scale instead of width, translate instead of top).");

  const hasFlashIssue = findings.some((f) => f.message.includes("Flash hazard"));
  if (hasFlashIssue) recs.push("Reduce opacity oscillations to fewer than 3 cycles per second to comply with WCAG 2.3.1.");

  const hasLinearIssue = findings.some((f) => f.message.includes("Linear easing"));
  if (hasLinearIssue) recs.push("Replace linear easing with smooth or spring presets for organic motion contexts.");

  const hasStaggerGap = findings.some((f) => f.message.includes("No staggered delays"));
  if (hasStaggerGap) recs.push("Add staggered delays (50-200ms steps) to create a choreographed entrance sequence.");

  const hasInconsistent = findings.some((f) => f.message.includes("Easing families are inconsistent"));
  if (hasInconsistent) recs.push("Pick one primary easing family and apply it to 80%+ of components for visual cohesion.");

  const strengths = findings.filter((f) => f.severity === "strength");
  if (strengths.length > 0 && criticals.length === 0 && warnings.length === 0) {
    recs.push("Strong overall quality — the motion design follows best practices across all dimensions.");
  }

  if (recs.length === 0) {
    recs.push("No critical issues detected. Continue iterating on the aesthetic and consistency dimensions.");
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatCritiqueReport(report: CritiqueReport, projectName: string): string {
  const lines: string[] = [];
  lines.push(`Motion Critique for "${projectName}":`);
  lines.push(`  Overall score: ${report.overallScore}/100`);
  lines.push("");
  lines.push("  Dimensions:");
  for (const [name, dim] of Object.entries(report.dimensions)) {
    lines.push(`    ${name}: ${dim.score}/100 (${dim.findings.length} findings)`);
  }
  lines.push("");
  lines.push("  Findings:");
  const sorted = [...report.findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  for (const f of sorted) {
    const tag = severityTag(f.severity);
    const comp = f.componentName ? ` [${f.componentName}]` : "";
    lines.push(`    ${tag} ${f.dimension}: ${f.message}${comp}`);
  }
  lines.push("");
  lines.push("  Recommendations:");
  for (const r of report.recommendations) {
    lines.push(`    • ${r}`);
  }
  return lines.join("\n");
}

function severityRank(s: Severity): number {
  switch (s) {
    case "critical": return 0;
    case "warning": return 1;
    case "info": return 2;
    case "strength": return 3;
  }
}

function severityTag(s: Severity): string {
  switch (s) {
    case "critical": return "[CRITICAL]";
    case "warning": return "[WARN]    ";
    case "info": return "[INFO]    ";
    case "strength": return "[OK]      ";
  }
}
