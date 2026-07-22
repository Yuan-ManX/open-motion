/**
 * Motion Auditor — comprehensive WCAG-style accessibility auditing.
 *
 * This is the seventeenth original AI-native module. Where Auto-Fix remediates
 * issues and Critique scores accessibility qualitatively, the Auditor produces
 * a formal compliance report against established accessibility guidelines.
 * It checks WCAG 2.1 SC 2.3 (Photosensitive Seizures), SC 2.2.2 (Pause, Stop,
 * Hide), cognitive load thresholds, distraction levels, and motion sickness
 * risk — producing a violation matrix with severity, remediation priority,
 * and a project-level compliance certificate.
 *
 * Six core audits:
 * 1. Flash analysis — detects animations that exceed the 3Hz photosensitive
 *    seizure threshold (WCAG 2.3.1) or the general flash threshold.
 * 2. Pause/Stop/Hide — checks whether infinite animations provide a way to
 *    pause, stop, or hide them (WCAG 2.2.2).
 * 3. Distraction scoring — estimates the visual distraction level of each
 *    component and the project as a whole.
 * 4. Cognitive load — estimates the cognitive overhead required to process
 *    the motion, based on complexity, concurrency, and speed.
 * 5. Motion sickness risk — assesses vestibular triggers (large displacements,
 *    rotations, parallax) that may cause discomfort.
 * 6. Compliance certificate — produces a pass/fail/warning verdict for each
 *    criterion and an overall compliance level.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec } from "@openmotion/shared";

/** Severity levels for violations. */
export type Severity = "critical" | "serious" | "moderate" | "minor";

/** A single accessibility violation. */
export interface AccessibilityViolation {
  /** WCAG success criterion. */
  criterion: string;
  /** Component that violates. */
  componentId: string;
  componentName: string;
  severity: Severity;
  /** What the violation is. */
  issue: string;
  /** Why it matters. */
  impact: string;
  /** How to fix it. */
  remediation: string;
  /** Remediation priority (1 = highest). */
  priority: number;
}

/** Flash analysis result. */
export interface FlashAnalysis {
  componentId: string;
  componentName: string;
  /** Estimated flash frequency in Hz. */
  flashHz: number;
  /** Whether it exceeds the 3Hz threshold. */
  exceedsThreshold: boolean;
  /** Whether it exceeds the general flash threshold. */
  exceedsGeneralFlash: boolean;
  /** Whether the flash is red. */
  isRedFlash: boolean;
  risk: "none" | "low" | "moderate" | "high" | "severe";
}

/** Pause/Stop/Hide compliance check. */
export interface PauseStopHideCheck {
  componentId: string;
  componentName: string;
  /** Whether the component has an infinite loop. */
  isInfinite: boolean;
  /** Whether a pause/stop/hide mechanism is detected. */
  hasPauseMechanism: boolean;
  /** Whether the animation lasts more than 5 seconds. */
  exceedsFiveSeconds: boolean;
  compliant: boolean;
  issue: string;
}

/** Distraction score for a component. */
export interface DistractionScore {
  componentId: string;
  componentName: string;
  /** Distraction level 0..100. */
  score: number;
  level: "minimal" | "low" | "moderate" | "high" | "extreme";
  factors: string[];
}

/** Cognitive load assessment. */
export interface CognitiveLoadAssessment {
  /** Overall cognitive load 0..100. */
  overallLoad: number;
  level: "minimal" | "low" | "moderate" | "high" | "overwhelming";
  /** Per-component load contributions. */
  components: { componentId: string; componentName: string; load: number; reason: string }[];
  /** Factors driving the cognitive load. */
  drivingFactors: string[];
}

/** Motion sickness risk assessment. */
export interface MotionSicknessRisk {
  componentId: string;
  componentName: string;
  /** Risk score 0..100. */
  riskScore: number;
  level: "none" | "low" | "moderate" | "high" | "severe";
  triggers: string[];
  recommendation: string;
}

/** A compliance criterion result. */
export interface CriterionResult {
  criterion: string;
  title: string;
  level: "A" | "AA" | "AAA";
  status: "pass" | "warn" | "fail";
  summary: string;
  violationCount: number;
}

/** The complete audit report. */
export interface AuditReport {
  componentCount: number;
  /** Overall compliance level. */
  complianceLevel: "compliant" | "conditionally-compliant" | "non-compliant";
  /** Overall accessibility score 0..100. */
  accessibilityScore: number;
  /** All detected violations. */
  violations: AccessibilityViolation[];
  /** Flash analysis per component. */
  flashAnalysis: FlashAnalysis[];
  /** Pause/Stop/Hide checks. */
  pauseStopHide: PauseStopHideCheck[];
  /** Distraction scores. */
  distraction: DistractionScore[];
  /** Cognitive load assessment. */
  cognitiveLoad: CognitiveLoadAssessment;
  /** Motion sickness risks. */
  motionSickness: MotionSicknessRisk[];
  /** Criterion-by-criterion results. */
  criteria: CriterionResult[];
  /** Whether the project passes the audit. */
  passed: boolean;
  /** Human-readable summary. */
  summary: string;
}

/**
 * Estimate the flash frequency of a component.
 * Components that animate opacity or color in a loop can produce flash-like effects.
 */
function estimateFlashHz(component: MotionComponent): { hz: number; isRedFlash: boolean } {
  if (component.iterationCount !== "infinite") {
    return { hz: 0, isRedFlash: false };
  }

  // Check if opacity is animated (keyframes that toggle visibility)
  const hasOpacityKeyframes = component.keyframes.some((kf) => "opacity" in kf.properties);
  const hasColorKeyframes = component.keyframes.some(
    (kf) => "color" in kf.properties || "backgroundColor" in kf.properties,
  );

  if (!hasOpacityKeyframes && !hasColorKeyframes) {
    return { hz: 0, isRedFlash: false };
  }

  // Estimate frequency from duration (one cycle = one flash pair)
  const hz = 1000 / component.durationMs;

  // Check for red color in style (rough heuristic)
  const style = component.style;
  const colorStr = JSON.stringify(style).toLowerCase();
  const isRedFlash = /red|#ff0000|#f00|rgb\(255,\s*0,\s*0\)/.test(colorStr);

  return { hz, isRedFlash };
}

/**
 * Check whether a component has any pause/stop/hide mechanism.
 * This is a heuristic — we check if the trigger is user-initiated.
 */
function hasPauseMechanism(component: MotionComponent): boolean {
  // User-initiated triggers imply the user can control the animation
  return component.trigger === "onClick" || component.trigger === "onHover";
}

/**
 * Compute the distraction score for a component.
 */
function computeDistraction(component: MotionComponent): DistractionScore {
  let score = 0;
  const factors: string[] = [];

  // Infinite loops are inherently distracting
  if (component.iterationCount === "infinite") {
    score += 30;
    factors.push("infinite-loop");
  }

  // Fast animations are more distracting
  if (component.durationMs < 300) {
    score += 20;
    factors.push("fast-duration");
  }

  // Large displacements are more distracting
  for (const kf of component.keyframes) {
    const props = kf.properties;
    if (typeof props.transform === "string") {
      const translateMatch = props.transform.match(/translate[XYZ]?\(([^)]+)\)/);
      if (translateMatch) {
        const value = parseFloat(translateMatch[1]);
        if (value > 200) {
          score += 15;
          factors.push("large-displacement");
        }
      }
      if (props.transform.includes("rotate") && /rotate\(([^)]+)\)/.test(props.transform)) {
        const match = props.transform.match(/rotate\(([^)]+)\)/);
        if (match) {
          const value = parseFloat(match[1]);
          if (Math.abs(value) > 180) {
            score += 15;
            factors.push("large-rotation");
          }
        }
      }
    }
  }

  // High scale changes are distracting
  for (const kf of component.keyframes) {
    const props = kf.properties;
    if (typeof props.transform === "string" && props.transform.includes("scale")) {
      const match = props.transform.match(/scale\(([^)]+)\)/);
      if (match) {
        const value = parseFloat(match[1]);
        if (value > 2 || value < 0.3) {
          score += 10;
          factors.push("extreme-scale");
        }
      }
    }
  }

  // Color changes in loops are distracting
  if (component.iterationCount === "infinite") {
    const hasColor = component.keyframes.some(
      (kf) => "color" in kf.properties || "backgroundColor" in kf.properties,
    );
    if (hasColor) {
      score += 15;
      factors.push("looping-color-change");
    }
  }

  score = Math.min(100, score);
  const level: DistractionScore["level"] =
    score >= 80 ? "extreme" : score >= 60 ? "high" : score >= 40 ? "moderate" : score >= 20 ? "low" : "minimal";

  return {
    componentId: component.id,
    componentName: component.name,
    score,
    level,
    factors,
  };
}

/**
 * Compute the motion sickness risk for a component.
 */
function computeMotionSickness(component: MotionComponent): MotionSicknessRisk {
  let riskScore = 0;
  const triggers: string[] = [];

  // Large translations (vestibular)
  for (const kf of component.keyframes) {
    const props = kf.properties;
    if (typeof props.transform === "string") {
      const translateMatch = props.transform.match(/translate[XYZ]?\(([^)]+)\)/);
      if (translateMatch) {
        const value = parseFloat(translateMatch[1]);
        if (value > 300) {
          riskScore += 25;
          triggers.push("large-translation");
        } else if (value > 150) {
          riskScore += 15;
          triggers.push("moderate-translation");
        }
      }
      // Rotations
      if (props.transform.includes("rotate")) {
        const match = props.transform.match(/rotate\(([^)]+)\)/);
        if (match) {
          const value = parseFloat(match[1]);
          if (Math.abs(value) > 360) {
            riskScore += 30;
            triggers.push("full-rotation");
          } else if (Math.abs(value) > 90) {
            riskScore += 15;
            triggers.push("large-rotation");
          }
        }
      }
    }
  }

  // 3D transforms (parallax/depth)
  const style = component.style;
  if (style && (style.transform || style.perspective)) {
    const transformStr = String(style.transform || "");
    if (transformStr.includes("translateZ") || transformStr.includes("rotateX") || transformStr.includes("rotateY")) {
      riskScore += 20;
      triggers.push("3d-transform");
    }
  }

  // Infinite loops with movement
  if (component.iterationCount === "infinite" && riskScore > 0) {
    riskScore += 15;
    triggers.push("infinite-loop-with-movement");
  }

  // Fast duration with movement
  if (component.durationMs < 300 && riskScore > 0) {
    riskScore += 10;
    triggers.push("fast-with-movement");
  }

  riskScore = Math.min(100, riskScore);
  const level: MotionSicknessRisk["level"] =
    riskScore >= 80 ? "severe" : riskScore >= 60 ? "high" : riskScore >= 40 ? "moderate" : riskScore >= 20 ? "low" : "none";

  const recommendation = level === "none"
    ? "No vestibular risk detected."
    : level === "low"
      ? "Minor vestibular triggers — monitor user feedback."
      : level === "moderate"
        ? "Provide a reduced-motion alternative for vestibular-sensitive users."
        : level === "high"
          ? "Strongly recommend a reduced-motion mode. Consider reducing displacement and rotation."
          : "Critical vestibular risk — must provide a reduced-motion alternative. Reduce displacement, rotation, and loop duration.";

  return {
    componentId: component.id,
    componentName: component.name,
    riskScore,
    level,
    triggers,
    recommendation,
  };
}

/**
 * Audit a motion spec and produce a compliance report.
 */
export function auditMotion(spec: MotionSpec): AuditReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      componentCount: 0,
      complianceLevel: "compliant",
      accessibilityScore: 100,
      violations: [],
      flashAnalysis: [],
      pauseStopHide: [],
      distraction: [],
      cognitiveLoad: {
        overallLoad: 0,
        level: "minimal",
        components: [],
        drivingFactors: [],
      },
      motionSickness: [],
      criteria: [],
      passed: true,
      summary: "Empty project — no components to audit. Automatically compliant.",
    };
  }

  const violations: AccessibilityViolation[] = [];
  let priorityCounter = 1;

  // 1. Flash analysis
  const flashAnalysis: FlashAnalysis[] = components.map((c) => {
    const { hz, isRedFlash } = estimateFlashHz(c);
    const exceedsThreshold = hz > 3;
    const exceedsGeneralFlash = hz > 3 && isRedFlash;

    let risk: FlashAnalysis["risk"] = "none";
    if (exceedsGeneralFlash) risk = "severe";
    else if (hz > 3) risk = "high";
    else if (hz > 2) risk = "moderate";
    else if (hz > 1) risk = "low";

    if (exceedsThreshold) {
      violations.push({
        criterion: "WCAG 2.3.1",
        componentId: c.id,
        componentName: c.name,
        severity: "critical",
        issue: `Flash frequency ${hz.toFixed(1)}Hz exceeds the 3Hz photosensitive threshold.`,
        impact: "May trigger seizures in photosensitive users.",
        remediation: "Reduce the flash frequency below 3Hz or remove the flashing effect entirely.",
        priority: priorityCounter++,
      });
    }

    return {
      componentId: c.id,
      componentName: c.name,
      flashHz: Math.round(hz * 10) / 10,
      exceedsThreshold,
      exceedsGeneralFlash,
      isRedFlash,
      risk,
    };
  });

  // 2. Pause/Stop/Hide checks
  const pauseStopHide: PauseStopHideCheck[] = components.map((c) => {
    const isInfinite = c.iterationCount === "infinite";
    const hasPause = hasPauseMechanism(c);
    const duration = typeof c.iterationCount === "number"
      ? c.durationMs * c.iterationCount
      : c.durationMs;
    const exceedsFive = duration > 5000;

    const compliant = !isInfinite || hasPause || !exceedsFive;

    if (!compliant) {
      violations.push({
        criterion: "WCAG 2.2.2",
        componentId: c.id,
        componentName: c.name,
        severity: "serious",
        issue: "Infinite animation without a pause, stop, or hide mechanism.",
        impact: "Users cannot pause distracting auto-playing motion.",
        remediation: "Add a control to pause, stop, or hide the animation, or make it user-initiated.",
        priority: priorityCounter++,
      });
    }

    return {
      componentId: c.id,
      componentName: c.name,
      isInfinite,
      hasPauseMechanism: hasPause,
      exceedsFiveSeconds: exceedsFive,
      compliant,
      issue: compliant ? "Compliant" : "Infinite loop without pause mechanism",
    };
  });

  // 3. Distraction scores
  const distraction = components.map(computeDistraction);
  const extremeDistraction = distraction.filter((d) => d.level === "extreme" || d.level === "high");
  for (const d of extremeDistraction) {
    violations.push({
      criterion: "WCAG 2.2.2 (distraction)",
      componentId: d.componentId,
      componentName: d.componentName,
      severity: d.level === "extreme" ? "serious" : "moderate",
      issue: `Distraction level ${d.level} (score ${d.score}). Factors: ${d.factors.join(", ")}.`,
      impact: "May prevent users from focusing on content.",
      remediation: "Reduce animation intensity, shorten duration, or remove infinite loops.",
      priority: priorityCounter++,
    });
  }

  // 4. Cognitive load
  const componentLoads = components.map((c) => {
    let load = 0;
    const reasons: string[] = [];

    if (c.iterationCount === "infinite") { load += 15; reasons.push("infinite-loop"); }
    if (c.durationMs < 300) { load += 10; reasons.push("fast"); }
    if (c.keyframes.length > 4) { load += 10; reasons.push("many-keyframes"); }
    if (c.durationMs > 2000) { load += 5; reasons.push("long-duration"); }

    return {
      componentId: c.id,
      componentName: c.name,
      load,
      reason: reasons.join(", ") || "standard",
    };
  });

  const overallLoad = Math.min(100, componentLoads.reduce((s, c) => s + c.load, 0) / components.length * 2);
  const cognitiveLoadLevel: CognitiveLoadAssessment["level"] =
    overallLoad >= 80 ? "overwhelming" : overallLoad >= 60 ? "high" : overallLoad >= 40 ? "moderate" : overallLoad >= 20 ? "low" : "minimal";

  const drivingFactors: string[] = [];
  if (components.some((c) => c.iterationCount === "infinite")) drivingFactors.push("infinite-loops");
  if (components.some((c) => c.durationMs < 300)) drivingFactors.push("fast-animations");
  if (components.some((c) => c.keyframes.length > 4)) drivingFactors.push("complex-keyframes");
  if (components.length > 15) drivingFactors.push("high-component-count");

  // 5. Motion sickness risks
  const motionSickness = components.map(computeMotionSickness);
  const highRisk = motionSickness.filter((m) => m.level === "high" || m.level === "severe");
  for (const m of highRisk) {
    violations.push({
      criterion: "Vestibular Safety",
      componentId: m.componentId,
      componentName: m.componentName,
      severity: m.level === "severe" ? "critical" : "serious",
      issue: `Motion sickness risk ${m.level} (score ${m.riskScore}). Triggers: ${m.triggers.join(", ")}.`,
      impact: "May cause discomfort, nausea, or dizziness in vestibular-sensitive users.",
      remediation: m.recommendation,
      priority: priorityCounter++,
    });
  }

  // 6. Criterion results
  const criteria: CriterionResult[] = [
    {
      criterion: "WCAG 2.3.1",
      title: "Three Flashes or Below Threshold",
      level: "A",
      status: flashAnalysis.some((f) => f.exceedsThreshold) ? "fail" : "pass",
      summary: flashAnalysis.some((f) => f.exceedsThreshold)
        ? `${flashAnalysis.filter((f) => f.exceedsThreshold).length} component(s) exceed the 3Hz flash threshold.`
        : "No components exceed the photosensitive seizure threshold.",
      violationCount: flashAnalysis.filter((f) => f.exceedsThreshold).length,
    },
    {
      criterion: "WCAG 2.2.2",
      title: "Pause, Stop, Hide",
      level: "A",
      status: pauseStopHide.some((p) => !p.compliant) ? "fail" : "pass",
      summary: pauseStopHide.some((p) => !p.compliant)
        ? `${pauseStopHide.filter((p) => !p.compliant).length} infinite animation(s) lack a pause mechanism.`
        : "All infinite animations have pause mechanisms or are user-initiated.",
      violationCount: pauseStopHide.filter((p) => !p.compliant).length,
    },
    {
      criterion: "Distraction",
      title: "Distraction Level",
      level: "AAA",
      status: extremeDistraction.length > 0 ? "warn" : "pass",
      summary: extremeDistraction.length > 0
        ? `${extremeDistraction.length} component(s) at high or extreme distraction level.`
        : "All components at acceptable distraction levels.",
      violationCount: extremeDistraction.length,
    },
    {
      criterion: "Cognitive Load",
      title: "Cognitive Load",
      level: "AAA",
      status: cognitiveLoadLevel === "overwhelming" || cognitiveLoadLevel === "high" ? "warn" : "pass",
      summary: `Overall cognitive load: ${cognitiveLoadLevel} (${Math.round(overallLoad)}/100).`,
      violationCount: cognitiveLoadLevel === "overwhelming" ? components.length : 0,
    },
    {
      criterion: "Vestibular",
      title: "Vestibular Safety",
      level: "AAA",
      status: highRisk.length > 0 ? "warn" : "pass",
      summary: highRisk.length > 0
        ? `${highRisk.length} component(s) at high or severe motion sickness risk.`
        : "No significant vestibular risks detected.",
      violationCount: highRisk.length,
    },
  ];

  // Compute overall score
  const criticalCount = violations.filter((v) => v.severity === "critical").length;
  const seriousCount = violations.filter((v) => v.severity === "serious").length;
  const moderateCount = violations.filter((v) => v.severity === "moderate").length;
  const minorCount = violations.filter((v) => v.severity === "minor").length;

  let accessibilityScore = 100;
  accessibilityScore -= criticalCount * 20;
  accessibilityScore -= seriousCount * 10;
  accessibilityScore -= moderateCount * 5;
  accessibilityScore -= minorCount * 2;
  accessibilityScore = Math.max(0, accessibilityScore);

  const complianceLevel: AuditReport["complianceLevel"] =
    criticalCount > 0 ? "non-compliant" : seriousCount > 0 ? "conditionally-compliant" : "compliant";

  const passed = criticalCount === 0 && seriousCount === 0;

  const summary = `Accessibility score: ${accessibilityScore}/100. ${complianceLevel}. ${violations.length} violation(s): ${criticalCount} critical, ${seriousCount} serious, ${moderateCount} moderate, ${minorCount} minor. ${criteria.filter((c) => c.status === "pass").length}/${criteria.length} criteria passed.`;

  return {
    componentCount: components.length,
    complianceLevel,
    accessibilityScore,
    violations: violations.sort((a, b) => a.priority - b.priority),
    flashAnalysis,
    pauseStopHide,
    distraction,
    cognitiveLoad: {
      overallLoad: Math.round(overallLoad),
      level: cognitiveLoadLevel,
      components: componentLoads,
      drivingFactors,
    },
    motionSickness,
    criteria,
    passed,
    summary,
  };
}

/**
 * Format the audit report as a human-readable string.
 */
export function formatAuditReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`# Motion Accessibility Audit Report`);
  lines.push("");
  lines.push(`**Score: ${report.accessibilityScore}/100** | ${report.complianceLevel} | ${report.passed ? "PASSED" : "FAILED"}`);
  lines.push(report.summary);
  lines.push("");

  // Criteria summary
  lines.push(`## Criteria Summary`);
  for (const c of report.criteria) {
    const icon = c.status === "pass" ? "PASS" : c.status === "warn" ? "WARN" : "FAIL";
    lines.push(`- ${c.criterion} [${c.level}] ${c.title}: ${icon} — ${c.summary}`);
  }
  lines.push("");

  // Violations
  if (report.violations.length > 0) {
    lines.push(`## Violations (${report.violations.length})`);
    for (const v of report.violations) {
      lines.push(`${v.priority}. [${v.severity.toUpperCase()}] ${v.criterion} — ${v.componentName}`);
      lines.push(`   Issue: ${v.issue}`);
      lines.push(`   Impact: ${v.impact}`);
      lines.push(`   Fix: ${v.remediation}`);
    }
    lines.push("");
  }

  // Flash analysis
  const flashIssues = report.flashAnalysis.filter((f) => f.risk !== "none");
  if (flashIssues.length > 0) {
    lines.push(`## Flash Analysis`);
    for (const f of flashIssues) {
      lines.push(`- ${f.componentName}: ${f.flashHz}Hz (${f.risk})${f.isRedFlash ? " [RED FLASH]" : ""}`);
    }
    lines.push("");
  }

  // Motion sickness
  const sicknessIssues = report.motionSickness.filter((m) => m.level !== "none");
  if (sicknessIssues.length > 0) {
    lines.push(`## Motion Sickness Risk`);
    for (const m of sicknessIssues) {
      lines.push(`- ${m.componentName}: ${m.level} (${m.riskScore}) — ${m.recommendation}`);
    }
  }

  return lines.join("\n");
}
