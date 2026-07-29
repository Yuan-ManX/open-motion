/**
 * Motion Testing Framework — automated quality assurance for motion designs.
 *
 * Provides a structured testing system that validates motion specs across six
 * categories: accessibility, performance, visual correctness, design principles,
 * timing, and consistency. Each category contains multiple test suites that
 * produce weighted scores and actionable recommendations.
 *
 * The framework is rule-based — no LLM round-trip required. It inspects the
 * MotionSpec directly and produces a TestReport with per-suite results, an
 * overall score, and a prioritized list of top issues.
 *
 * Scoring: each check contributes a weight based on severity.
 *   - passed check           → weight 1.0
 *   - failed "error" check    → weight 0.0
 *   - failed "warning" check  → weight 0.5
 *   - failed "info" check     → weight 0.5
 * A suite's score is the average weight across all its checks, scaled to 0-100.
 * A suite passes if it has no failed "error" checks.
 */

import type { Easing, MotionComponent, MotionSpec } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TestCategory =
  | "accessibility"
  | "performance"
  | "visual"
  | "principles"
  | "timing"
  | "consistency";

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  run: (spec: MotionSpec) => TestResult;
}

export interface TestCheck {
  name: string;
  passed: boolean;
  severity: "info" | "warning" | "error";
  message: string;
  componentId?: string;
}

export interface TestResult {
  suiteId: string;
  suiteName: string;
  category: TestCategory;
  passed: boolean;
  score: number; // 0-100
  checks: TestCheck[];
  summary: string;
  recommendations: string[];
}

export interface TestReport {
  totalSuites: number;
  passedSuites: number;
  overallScore: number;
  results: TestResult[];
  topIssues: TestCheck[];
  summary: string;
}

export interface TestSuiteInfo {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Properties that are GPU-accelerated (composited on the GPU). */
const GPU_PROPERTIES = new Set([
  "translateX", "translateY", "translateZ",
  "scale", "scaleX", "scaleY",
  "rotate", "rotateX", "rotateY", "rotateZ",
  "skewX", "skewY",
  "opacity",
]);

/** Properties that trigger layout reflow (expensive). */
const LAYOUT_PROPERTIES = new Set([
  "width", "height",
]);

/** Properties that involve color changes. */
const COLOR_PROPERTIES = new Set([
  "color", "backgroundColor",
]);

/** Style keys that carry color values. */
const STYLE_COLOR_KEYS = [
  "color", "backgroundColor", "borderColor",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
  "outlineColor", "fill", "stroke",
];

/** Style keys that carry spacing values. */
const SPACING_STYLE_KEYS = [
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "gap", "top", "left", "right", "bottom",
];

const MAX_DURATION_MS = 5000;
const MIN_DURATION_MS = 200;
const MAX_SIMULTANEOUS = 10;
const MAX_KEYFRAMES = 20;
const FLASH_THRESHOLD_HZ = 3;
const WCAG_AA_CONTRAST = 4.5;
const WCAG_AA_LARGE_CONTRAST = 3.0;

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/** Weight assigned to a check based on its pass state and severity. */
function checkWeight(check: TestCheck): number {
  if (check.passed) return 1;
  if (check.severity === "error") return 0;
  return 0.5; // warning and info
}

/** Compute a 0-100 score from a list of checks. */
function computeScore(checks: TestCheck[]): number {
  if (checks.length === 0) return 100;
  const total = checks.reduce((sum, c) => sum + checkWeight(c), 0);
  return Math.round((total / checks.length) * 100);
}

/** A suite passes when it has no failed error-severity checks. */
function computePassed(checks: TestCheck[]): boolean {
  return !checks.some((c) => !c.passed && c.severity === "error");
}

/** Build actionable recommendations from failed checks. */
function buildRecommendations(checks: TestCheck[]): string[] {
  const failed = checks.filter((c) => !c.passed);
  if (failed.length === 0) return ["No issues found — all checks passed."];
  return failed.map((c) => {
    const verb = c.severity === "error" ? "Fix" : c.severity === "warning" ? "Review" : "Note";
    return `${verb}: ${c.message}`;
  });
}

/** Build a one-line summary for a test result. */
function buildSummary(suiteName: string, checks: TestCheck[]): string {
  const passedCount = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const errors = checks.filter((c) => !c.passed && c.severity === "error").length;
  const warnings = checks.filter((c) => !c.passed && c.severity === "warning").length;
  const score = computeScore(checks);
  const status = computePassed(checks) ? "PASSED" : "FAILED";
  return `${suiteName}: ${status} (score ${score}/100). ${passedCount}/${total} checks passed — ${errors} error(s), ${warnings} warning(s).`;
}

/** Assemble a complete TestResult from suite metadata and checks. */
function buildResult(
  suiteId: string,
  suiteName: string,
  category: TestCategory,
  checks: TestCheck[],
): TestResult {
  return {
    suiteId,
    suiteName,
    category,
    passed: computePassed(checks),
    score: computeScore(checks),
    checks,
    summary: buildSummary(suiteName, checks),
    recommendations: buildRecommendations(checks),
  };
}

// ---------------------------------------------------------------------------
// Value and color utilities
// ---------------------------------------------------------------------------

/** Extract a numeric value from a string or number. Returns null if unparseable. */
function num(value: string | number | undefined | null): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const m = String(value).match(/-?\d+\.?\d*/);
  return m ? parseFloat(m[0]) : null;
}

/** Parse a CSS color string into RGB components (0-255 each). */
function parseColor(color: string): { r: number; g: number; b: number } | null {
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) {
      h = h.split("").map((c) => c + c).join("");
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return { r: parseInt(rgb[1]), g: parseInt(rgb[2]), b: parseInt(rgb[3]) };
  }
  return null;
}

/** WCAG relative luminance for an RGB color. */
function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/** WCAG contrast ratio between two CSS color strings. Returns null if unparseable. */
function contrastRatio(c1: string, c2: string): number | null {
  const rgb1 = parseColor(c1);
  const rgb2 = parseColor(c2);
  if (!rgb1 || !rgb2) return null;
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Convert a CSS color string to HSL. Returns null if unparseable. */
function colorToHsl(color: string): { h: number; s: number; l: number } | null {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

/** Extract all color values from a component's style object. */
function extractStyleColors(style: Record<string, string | number>): string[] {
  const colors: string[] = [];
  for (const key of STYLE_COLOR_KEYS) {
    const val = style[key];
    if (typeof val === "string" && parseColor(val)) {
      colors.push(val);
    }
  }
  return colors;
}

// ---------------------------------------------------------------------------
// Easing utilities
// ---------------------------------------------------------------------------

/** A stable string key for comparing easing curves. */
function easingKey(easing: Easing): string {
  if (easing.type === "preset") return `preset:${easing.name}`;
  if (easing.type === "bezier") return `bezier:${easing.p1[0]},${easing.p1[1]},${easing.p2[0]},${easing.p2[1]}`;
  if (easing.type === "spring") return `spring:${easing.stiffness},${easing.damping}`;
  return "unknown";
}

/** Group an easing into a family for consistency comparison. */
function easingFamily(easing: Easing): string {
  if (easing.type === "preset") {
    if (easing.name === "linear") return "linear";
    if (["ease", "ease-in", "ease-out", "ease-in-out"].includes(easing.name)) return "standard";
    if (["ease-in-quad", "ease-out-quad", "ease-in-out-quad", "ease-in-cubic", "ease-out-cubic", "ease-in-out-cubic"].includes(easing.name)) return "quad-cubic";
    if (["bounce", "back", "elastic"].includes(easing.name)) return "overshoot";
    if (["snappy", "smooth", "soft"].includes(easing.name)) return "custom";
    return "other";
  }
  if (easing.type === "spring") return "spring";
  if (easing.type === "bezier") return "bezier";
  return "other";
}

/** Whether an easing produces overshoot (bounce, elastic, back, under-damped spring). */
function hasOvershoot(easing: Easing): boolean {
  if (easing.type === "preset") return ["bounce", "back", "elastic"].includes(easing.name);
  if (easing.type === "spring") {
    const r = easing.damping / (2 * Math.sqrt(easing.stiffness * easing.mass));
    return r < 1;
  }
  if (easing.type === "bezier") return easing.p2[1] > 1 || easing.p1[1] < 0;
  return false;
}

// ---------------------------------------------------------------------------
// Component analysis helpers
// ---------------------------------------------------------------------------

/** Get the set of animated property names from a component's keyframes. */
function animatedPropertyNames(component: MotionComponent): Set<string> {
  const names = new Set<string>();
  for (const kf of component.keyframes) {
    for (const key of Object.keys(kf.properties)) {
      names.add(key);
    }
  }
  return names;
}

/** Whether a component animates a specific property. */
function animatesProperty(component: MotionComponent, name: string): boolean {
  return component.keyframes.some((kf) => name in kf.properties);
}

/** Get numeric values for a property across all keyframes. */
function numericValuesFor(component: MotionComponent, name: string): number[] {
  const values: number[] = [];
  for (const kf of component.keyframes) {
    if (name in kf.properties) {
      const raw = kf.properties[name as keyof typeof kf.properties];
      const n = num(raw);
      if (n !== null) values.push(n);
    }
  }
  return values;
}

/** Whether a component's trigger is user-initiated. */
function isUserInitiated(component: MotionComponent): boolean {
  return component.trigger === "onClick" || component.trigger === "onHover";
}

/** Total animation duration including iterations. */
function totalDuration(component: MotionComponent): number {
  if (component.iterationCount === "infinite") return component.durationMs;
  return component.durationMs * component.iterationCount;
}

/** Compute the maximum number of concurrent animations and the peak time. */
function maxConcurrent(components: MotionComponent[]): { max: number; peakTime: number } {
  if (components.length === 0) return { max: 0, peakTime: 0 };
  const events: { time: number; delta: number }[] = [];
  for (const c of components) {
    const start = c.delayMs;
    const dur = totalDuration(c);
    events.push({ time: start, delta: 1 });
    events.push({ time: start + dur, delta: -1 });
  }
  events.sort((a, b) => a.time - b.time);
  let current = 0;
  let max = 0;
  let peakTime = 0;
  for (const e of events) {
    current += e.delta;
    if (current > max) {
      max = current;
      peakTime = e.time;
    }
  }
  return { max, peakTime };
}

/** Check if will-change hint is present in style. */
function hasWillChange(component: MotionComponent): boolean {
  return "willChange" in component.style || "will-change" in component.style;
}

// ---------------------------------------------------------------------------
// Accessibility test functions
// ---------------------------------------------------------------------------

function testA11yDuration(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  for (const c of spec.components) {
    const exceeds = c.durationMs > MAX_DURATION_MS;
    checks.push({
      name: "Duration within vestibular limit",
      passed: !exceeds,
      severity: exceeds ? "error" : "info",
      message: exceeds
        ? `Component "${c.name}" duration ${c.durationMs}ms exceeds the ${MAX_DURATION_MS}ms vestibular safety limit.`
        : `Component "${c.name}" duration ${c.durationMs}ms is within the safe limit.`,
      componentId: c.id,
    });

    if (c.iterationCount === "infinite") {
      const controlled = isUserInitiated(c);
      checks.push({
        name: "Infinite loop has user control",
        passed: controlled,
        severity: controlled ? "info" : "warning",
        message: controlled
          ? `Component "${c.name}" infinite loop is user-initiated (${c.trigger}).`
          : `Component "${c.name}" has an infinite loop triggered by ${c.trigger}. Users cannot stop the animation.`,
        componentId: c.id,
      });
    }
  }

  const longCount = spec.components.filter((c) => c.durationMs > MAX_DURATION_MS).length;
  checks.push({
    name: "Project vestibular safety",
    passed: longCount === 0,
    severity: longCount > 0 ? "error" : "info",
    message: longCount === 0
      ? "All animations are within vestibular safety limits."
      : `${longCount} animation(s) exceed the ${MAX_DURATION_MS}ms vestibular safety limit.`,
  });

  return checks;
}

function testA11yFlash(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  for (const c of spec.components) {
    const animatesFlash = animatesProperty(c, "opacity") ||
      animatesProperty(c, "color") ||
      animatesProperty(c, "backgroundColor");

    if (!animatesFlash || c.iterationCount !== "infinite") {
      checks.push({
        name: "No flash hazard",
        passed: true,
        severity: "info",
        message: `Component "${c.name}" does not present a flash hazard.`,
        componentId: c.id,
      });
      continue;
    }

    const hz = 1000 / c.durationMs;
    const exceeds = hz > FLASH_THRESHOLD_HZ;

    const styleStr = JSON.stringify(c.style).toLowerCase();
    const isRedFlash = /red|#ff0000|#f00|rgb\(255,\s*0,\s*0\)/.test(styleStr);

    checks.push({
      name: "Flash frequency below threshold",
      passed: !exceeds,
      severity: exceeds ? "error" : "info",
      message: exceeds
        ? `Component "${c.name}" flashes at ${hz.toFixed(1)}Hz, exceeding the ${FLASH_THRESHOLD_HZ}Hz photosensitive threshold.`
        : `Component "${c.name}" flashes at ${hz.toFixed(1)}Hz, below the threshold.`,
      componentId: c.id,
    });

    if (isRedFlash && exceeds) {
      checks.push({
        name: "No red flash above threshold",
        passed: false,
        severity: "error",
        message: `Component "${c.name}" produces a red flash above the threshold — severe seizure risk.`,
        componentId: c.id,
      });
    }
  }

  return checks;
}

function testA11yContrast(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  for (const c of spec.components) {
    const textColor = c.style["color"];
    const bgColor = c.style["backgroundColor"];

    if (typeof textColor === "string" && typeof bgColor === "string") {
      const ratio = contrastRatio(textColor, bgColor);
      if (ratio !== null) {
        const meets = ratio >= WCAG_AA_CONTRAST;
        checks.push({
          name: "Text-background contrast meets WCAG AA",
          passed: meets,
          severity: meets ? "info" : "error",
          message: meets
            ? `Component "${c.name}" has contrast ratio ${ratio.toFixed(1)}:1 (passes WCAG AA).`
            : `Component "${c.name}" has contrast ratio ${ratio.toFixed(1)}:1 — below WCAG AA (${WCAG_AA_CONTRAST}:1).`,
          componentId: c.id,
        });
      }
    }

    const animatesColor = animatesProperty(c, "color");
    const animatesBg = animatesProperty(c, "backgroundColor");
    if (animatesColor || animatesBg) {
      checks.push({
        name: "Animated color maintains readability",
        passed: false,
        severity: "warning",
        message: `Component "${c.name}" animates ${animatesColor ? "text color" : ""}${animatesColor && animatesBg ? " and " : ""}${animatesBg ? "background color" : ""}. Verify contrast remains sufficient throughout the animation.`,
        componentId: c.id,
      });
    }
  }

  return checks;
}

function testA11yMotionReduction(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  const infiniteLoops = spec.components.filter((c) => c.iterationCount === "infinite");
  for (const c of infiniteLoops) {
    const controlled = isUserInitiated(c);
    checks.push({
      name: "Infinite animation is user-controllable",
      passed: controlled,
      severity: controlled ? "info" : "warning",
      message: controlled
        ? `Component "${c.name}" infinite loop can be controlled by the user.`
        : `Component "${c.name}" infinite loop cannot be paused by the user. Add a user-initiated trigger or a pause control.`,
      componentId: c.id,
    });
  }

  const largeMovement = spec.components.filter((c) => {
    const tx = numericValuesFor(c, "translateX");
    const ty = numericValuesFor(c, "translateY");
    const rot = numericValuesFor(c, "rotate");
    return (tx.some((v) => Math.abs(v) > 200) || ty.some((v) => Math.abs(v) > 200) ||
      rot.some((v) => Math.abs(v) > 180));
  });

  for (const c of largeMovement) {
    checks.push({
      name: "Large movement has reduced-motion alternative",
      passed: false,
      severity: "warning",
      message: `Component "${c.name}" has large movement that may trigger vestibular discomfort. Provide a reduced-motion fallback.`,
      componentId: c.id,
    });
  }

  if (spec.components.length > 0) {
    const allControlled = infiniteLoops.every(isUserInitiated);
    checks.push({
      name: "Motion can be safely reduced",
      passed: allControlled,
      severity: allControlled ? "info" : "warning",
      message: allControlled
        ? "All infinite animations are user-controllable and can be reduced."
        : "Some animations cannot be reduced. Ensure a prefers-reduced-motion media query is handled.",
    });
  }

  return checks;
}

// ---------------------------------------------------------------------------
// Performance test functions
// ---------------------------------------------------------------------------

function testPerfSimultaneous(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  const { max, peakTime } = maxConcurrent(spec.components);
  const exceeds = max > MAX_SIMULTANEOUS;
  checks.push({
    name: "Simultaneous animation count within limit",
    passed: !exceeds,
    severity: exceeds ? "error" : "info",
    message: exceeds
      ? `${max} animations run concurrently at ${peakTime}ms — exceeds the limit of ${MAX_SIMULTANEOUS}.`
      : `Peak concurrency is ${max} animation(s) at ${peakTime}ms — within the limit.`,
  });

  for (const c of spec.components) {
    const props = animatedPropertyNames(c);
    const expensive = [...props].filter((p) => LAYOUT_PROPERTIES.has(p));
    if (expensive.length > 0 && c.iterationCount === "infinite") {
      checks.push({
        name: "No infinite layout-triggering animation",
        passed: false,
        severity: "error",
        message: `Component "${c.name}" infinitely animates layout properties (${expensive.join(", ")}). This causes continuous reflow.`,
        componentId: c.id,
      });
    }
  }

  return checks;
}

function testPerfPropertyUsage(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  for (const c of spec.components) {
    const props = animatedPropertyNames(c);
    if (props.size === 0) continue;

    const gpuProps = [...props].filter((p) => GPU_PROPERTIES.has(p));
    const layoutProps = [...props].filter((p) => LAYOUT_PROPERTIES.has(p));

    if (layoutProps.length > 0) {
      checks.push({
        name: "Avoid layout-triggering properties",
        passed: false,
        severity: "warning",
        message: `Component "${c.name}" animates layout properties (${layoutProps.join(", ")}). Use transform-based properties instead for GPU acceleration.`,
        componentId: c.id,
      });
    } else {
      checks.push({
        name: "Uses GPU-accelerated properties",
        passed: true,
        severity: "info",
        message: `Component "${c.name}" uses GPU-friendly properties (${gpuProps.join(", ")}).`,
        componentId: c.id,
      });
    }

    if (props.size > 0 && !hasWillChange(c)) {
      checks.push({
        name: "Has will-change hint",
        passed: false,
        severity: "info",
        message: `Component "${c.name}" is missing a will-change hint. Adding it promotes the element to a compositor layer.`,
        componentId: c.id,
      });
    }
  }

  return checks;
}

function testPerfKeyframeDensity(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  for (const c of spec.components) {
    const count = c.keyframes.length;
    const exceeds = count > MAX_KEYFRAMES;
    checks.push({
      name: "Keyframe count within limit",
      passed: !exceeds,
      severity: exceeds ? "warning" : "info",
      message: exceeds
        ? `Component "${c.name}" has ${count} keyframes — exceeds the limit of ${MAX_KEYFRAMES}. Simplify the animation.`
        : `Component "${c.name}" has ${count} keyframe(s).`,
      componentId: c.id,
    });
  }

  if (spec.components.length > 0) {
    const avg = spec.components.reduce((s, c) => s + c.keyframes.length, 0) / spec.components.length;
    const highAvg = avg > 10;
    checks.push({
      name: "Average keyframe density",
      passed: !highAvg,
      severity: highAvg ? "warning" : "info",
      message: highAvg
        ? `Average keyframe density is ${avg.toFixed(1)} per component — consider simplifying.`
        : `Average keyframe density is ${avg.toFixed(1)} per component.`,
    });
  }

  return checks;
}

function testPerfComplexity(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  let totalComplexity = 0;
  for (const c of spec.components) {
    let complexity = 0;
    const props = animatedPropertyNames(c);

    complexity += c.keyframes.length * 2;
    complexity += props.size * 3;
    if (c.iterationCount === "infinite") complexity += 15;
    if (c.durationMs < 300) complexity += 5;

    totalComplexity += complexity;

    if (complexity > 50) {
      checks.push({
        name: "Component complexity acceptable",
        passed: false,
        severity: "warning",
        message: `Component "${c.name}" has a complexity score of ${complexity} — high. Reduce keyframes, properties, or simplify.`,
        componentId: c.id,
      });
    } else {
      checks.push({
        name: "Component complexity acceptable",
        passed: true,
        severity: "info",
        message: `Component "${c.name}" complexity score is ${complexity}.`,
        componentId: c.id,
      });
    }
  }

  const avgComplexity = spec.components.length > 0 ? totalComplexity / spec.components.length : 0;
  const highProject = avgComplexity > 30;
  checks.push({
    name: "Project complexity score",
    passed: !highProject,
    severity: highProject ? "warning" : "info",
    message: highProject
      ? `Project average complexity is ${avgComplexity.toFixed(1)} — consider reducing animation complexity.`
      : `Project average complexity is ${avgComplexity.toFixed(1)}.`,
  });

  return checks;
}

// ---------------------------------------------------------------------------
// Visual test functions
// ---------------------------------------------------------------------------

function testVisualColorHarmony(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  const allColors: string[] = [];
  for (const c of spec.components) {
    allColors.push(...extractStyleColors(c.style));
  }
  const uniqueColors = [...new Set(allColors)];

  if (uniqueColors.length === 0) {
    checks.push({
      name: "Color palette defined",
      passed: true,
      severity: "info",
      message: "No explicit colors found in styles — colors may be inherited.",
    });
    return checks;
  }

  const tooMany = uniqueColors.length > 8;
  checks.push({
    name: "Color palette is focused",
    passed: !tooMany,
    severity: tooMany ? "warning" : "info",
    message: tooMany
      ? `${uniqueColors.length} distinct colors detected — consider limiting the palette to 5-7 colors.`
      : `${uniqueColors.length} distinct colors in the palette.`,
  });

  const hslColors = uniqueColors.map(colorToHsl).filter((h): h is { h: number; s: number; l: number } => h !== null);
  if (hslColors.length >= 2) {
    const hues = hslColors.map((c) => c.h);
    const hueSpread = Math.max(...hues) - Math.min(...hues);
    const saturated = hslColors.filter((c) => c.s > 20);
    const wideSpread = saturated.length >= 3 && hueSpread > 240;

    checks.push({
      name: "Color hue distribution is harmonious",
      passed: !wideSpread,
      severity: wideSpread ? "warning" : "info",
      message: wideSpread
        ? `Hue spread is ${hueSpread.toFixed(0)}° across ${saturated.length} saturated colors — consider a more focused palette.`
        : `Hue spread is ${hueSpread.toFixed(0)}° — colors are harmonious.`,
    });
  }

  return checks;
}

function testVisualSpacing(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  const spacingValues: number[] = [];
  for (const c of spec.components) {
    for (const key of SPACING_STYLE_KEYS) {
      const val = c.style[key];
      const n = num(typeof val === "string" || typeof val === "number" ? val : null);
      if (n !== null && n > 0) {
        spacingValues.push(n);
      }
    }
  }

  if (spacingValues.length === 0) {
    checks.push({
      name: "Spacing values defined",
      passed: true,
      severity: "info",
      message: "No explicit spacing values found in styles.",
    });
    return checks;
  }

  const onScale = spacingValues.filter((v) => v % 4 === 0 || v % 8 === 0);
  const ratio = onScale.length / spacingValues.length;
  const consistent = ratio >= 0.7;
  checks.push({
    name: "Spacing follows a consistent scale",
    passed: consistent,
    severity: consistent ? "info" : "warning",
    message: consistent
      ? `${onScale.length}/${spacingValues.length} spacing values follow a 4px or 8px scale.`
      : `Only ${onScale.length}/${spacingValues.length} spacing values follow a 4px or 8px scale. Align to a spacing system.`,
  });

  const unique = new Set(spacingValues.map((v) => Math.round(v)));
  const tooVaried = unique.size > 12;
  checks.push({
    name: "Spacing variety is controlled",
    passed: !tooVaried,
    severity: tooVaried ? "warning" : "info",
    message: tooVaried
      ? `${unique.size} distinct spacing values — reduce to a smaller set of tokens.`
      : `${unique.size} distinct spacing values.`,
  });

  return checks;
}

function testVisualZOrder(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  const zIndexMap = new Map<number, string[]>();
  for (const c of spec.components) {
    const z = c.style["zIndex"];
    const zNum = num(typeof z === "string" || typeof z === "number" ? z : null);
    if (zNum !== null) {
      const existing = zIndexMap.get(zNum) ?? [];
      existing.push(c.name);
      zIndexMap.set(zNum, existing);
    }
  }

  for (const [z, names] of zIndexMap) {
    if (names.length > 1) {
      checks.push({
        name: "No conflicting z-index values",
        passed: false,
        severity: "warning",
        message: `${names.length} components share z-index ${z}: ${names.join(", ")}. This may cause stacking ambiguity.`,
      });
    }
  }

  if (zIndexMap.size === 0) {
    checks.push({
      name: "Z-index values defined",
      passed: true,
      severity: "info",
      message: "No z-index values set — stacking is determined by DOM order.",
    });
  } else {
    const maxZ = Math.max(...zIndexMap.keys());
    const extremeZ = maxZ > 9999;
    checks.push({
      name: "Z-index values are reasonable",
      passed: !extremeZ,
      severity: extremeZ ? "warning" : "info",
      message: extremeZ
        ? `Maximum z-index is ${maxZ} — use smaller values to avoid escalation.`
        : `Z-index range is 0 to ${maxZ}.`,
    });
  }

  return checks;
}

function testVisualOverlap(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  const timeWindows = spec.components.map((c) => ({
    component: c,
    start: c.delayMs,
    end: c.delayMs + totalDuration(c),
  }));

  for (let i = 0; i < timeWindows.length; i++) {
    for (let j = i + 1; j < timeWindows.length; j++) {
      const a = timeWindows[i];
      const b = timeWindows[j];
      const overlaps = a.start < b.end && b.start < a.end;
      if (!overlaps) continue;

      const propsA = animatedPropertyNames(a.component);
      const propsB = animatedPropertyNames(b.component);
      const shared = [...propsA].filter((p) => propsB.has(p));

      if (shared.length > 0) {
        checks.push({
          name: "No concurrent same-property overlap",
          passed: false,
          severity: "warning",
          message: `Components "${a.component.name}" and "${b.component.name}" animate the same properties (${shared.join(", ")}) during overlapping time windows. This may cause visual conflict.`,
        });
      }
    }
  }

  const { max } = maxConcurrent(spec.components);
  const heavyOverlap = max > 5;
  checks.push({
    name: "Temporal overlap is controlled",
    passed: !heavyOverlap,
    severity: heavyOverlap ? "warning" : "info",
    message: heavyOverlap
      ? `${max} animations overlap at peak — consider staggering to reduce visual clutter.`
      : `Peak overlap is ${max} animation(s).`,
  });

  if (checks.length === 0) {
    checks.push({
      name: "No visual overlap detected",
      passed: true,
      severity: "info",
      message: "No overlapping animations with shared properties detected.",
    });
  }

  return checks;
}

// ---------------------------------------------------------------------------
// Principles test functions
// ---------------------------------------------------------------------------

function testPrincipleSquashStretch(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  for (const c of spec.components) {
    const animatesScale = animatesProperty(c, "scale") ||
      animatesProperty(c, "scaleX") ||
      animatesProperty(c, "scaleY");
    const hasMovement = animatesProperty(c, "translateX") ||
      animatesProperty(c, "translateY") ||
      animatesProperty(c, "translateZ");

    if (hasMovement && !animatesScale) {
      checks.push({
        name: "Squash & stretch applied on movement",
        passed: false,
        severity: "info",
        message: `Component "${c.name}" has movement without squash & stretch. Adding scale deformation conveys weight and impact.`,
        componentId: c.id,
      });
    } else if (animatesScale) {
      const scaleXVals = numericValuesFor(c, "scaleX");
      const scaleYVals = numericValuesFor(c, "scaleY");
      const hasOpposing = scaleXVals.length > 0 && scaleYVals.length > 0 &&
        scaleXVals.some((v) => v > 1) && scaleYVals.some((v) => v < 1);

      checks.push({
        name: "Squash & stretch uses opposing axes",
        passed: hasOpposing,
        severity: hasOpposing ? "info" : "info",
        message: hasOpposing
          ? `Component "${c.name}" applies opposing scaleX/scaleY for natural squash & stretch.`
          : `Component "${c.name}" animates scale but could use opposing axes (scaleX up, scaleY down) for a stronger effect.`,
        componentId: c.id,
      });
    } else {
      checks.push({
        name: "Squash & stretch applicable",
        passed: true,
        severity: "info",
        message: `Component "${c.name}" has no movement — squash & stretch not applicable.`,
        componentId: c.id,
      });
    }
  }

  return checks;
}

function testPrincipleAnticipation(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  for (const c of spec.components) {
    if (c.keyframes.length < 2) {
      checks.push({
        name: "Anticipation present before main action",
        passed: true,
        severity: "info",
        message: `Component "${c.name}" has too few keyframes for anticipation analysis.`,
        componentId: c.id,
      });
      continue;
    }

    const sorted = [...c.keyframes].sort((a, b) => a.offset - b.offset);
    const firstProps = sorted[0].properties;
    const secondProps = sorted[1].properties;

    let hasAnticipation = false;
    for (const key of Object.keys(firstProps)) {
      const v0 = num(firstProps[key as keyof typeof firstProps]);
      const v1 = num(secondProps[key as keyof typeof secondProps]);
      if (v0 !== null && v1 !== null) {
        const movement = v1 - v0;
        if (Math.abs(movement) > 0) hasAnticipation = true;
      }
    }

    const hasDelay = c.delayMs > 0;
    const passed = hasAnticipation || hasDelay;

    checks.push({
      name: "Anticipation present before main action",
      passed,
      severity: passed ? "info" : "info",
      message: passed
        ? `Component "${c.name}" shows signs of anticipation (${hasDelay ? "delay" : "preparatory movement"}).`
        : `Component "${c.name}" lacks anticipation. Add a small opposing movement before the main action.`,
      componentId: c.id,
    });
  }

  return checks;
}

function testPrincipleFollowThrough(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  for (const c of spec.components) {
    const overshoot = hasOvershoot(c.easing);
    const hasSettling = c.keyframes.length >= 3 &&
      c.keyframes.some((kf) => {
        const props = kf.properties;
        return Object.keys(props).some((key) => {
          const vals = numericValuesFor(c, key);
          return vals.length >= 2 && vals.some((v) => v < 0);
        });
      });

    const passed = overshoot || hasSettling;
    checks.push({
      name: "Follow-through present after main action",
      passed,
      severity: "info",
      message: passed
        ? `Component "${c.name}" has follow-through (${overshoot ? "overshoot easing" : "settling keyframes"}).`
        : `Component "${c.name}" lacks follow-through. Use an easing with overshoot (back, elastic) or add settling keyframes.`,
      componentId: c.id,
    });
  }

  return checks;
}

function testPrincipleArcs(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  for (const c of spec.components) {
    const hasX = animatesProperty(c, "translateX");
    const hasY = animatesProperty(c, "translateY");
    const hasZ = animatesProperty(c, "translateZ");
    const multiAxis = (hasX && hasY) || (hasX && hasZ) || (hasY && hasZ);

    if (hasX || hasY) {
      checks.push({
        name: "Motion follows natural arcs",
        passed: multiAxis,
        severity: "info",
        message: multiAxis
          ? `Component "${c.name}" moves along multiple axes — motion follows a natural arc.`
          : `Component "${c.name}" moves along a single axis. Add a perpendicular component for a curved path.`,
        componentId: c.id,
      });
    } else {
      checks.push({
        name: "Arc principle applicable",
        passed: true,
        severity: "info",
        message: `Component "${c.name}" has no translational movement — arcs not applicable.`,
        componentId: c.id,
      });
    }
  }

  return checks;
}

// ---------------------------------------------------------------------------
// Timing test functions
// ---------------------------------------------------------------------------

function testTimingDurationRange(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  for (const c of spec.components) {
    const tooShort = c.durationMs < MIN_DURATION_MS;
    const tooLong = c.durationMs > MAX_DURATION_MS;

    if (tooShort) {
      checks.push({
        name: "Duration within reasonable range",
        passed: false,
        severity: "warning",
        message: `Component "${c.name}" duration ${c.durationMs}ms is below ${MIN_DURATION_MS}ms — too fast to perceive comfortably.`,
        componentId: c.id,
      });
    } else if (tooLong) {
      checks.push({
        name: "Duration within reasonable range",
        passed: false,
        severity: "error",
        message: `Component "${c.name}" duration ${c.durationMs}ms exceeds ${MAX_DURATION_MS}ms — too slow for engagement.`,
        componentId: c.id,
      });
    } else {
      checks.push({
        name: "Duration within reasonable range",
        passed: true,
        severity: "info",
        message: `Component "${c.name}" duration ${c.durationMs}ms is within the ${MIN_DURATION_MS}-${MAX_DURATION_MS}ms range.`,
        componentId: c.id,
      });
    }
  }

  return checks;
}

function testTimingStagger(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  const delays = spec.components
    .filter((c) => c.delayMs > 0)
    .map((c) => c.delayMs)
    .sort((a, b) => a - b);

  if (delays.length < 2) {
    checks.push({
      name: "Stagger pattern present",
      passed: true,
      severity: "info",
      message: delays.length === 0
        ? "No staggered delays detected."
        : "Only one component has a delay — no stagger pattern to evaluate.",
    });
    return checks;
  }

  const intervals: number[] = [];
  for (let i = 1; i < delays.length; i++) {
    intervals.push(delays[i] - delays[i - 1]);
  }

  const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const variance = intervals.reduce((s, v) => s + Math.pow(v - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const inconsistent = avgInterval > 0 && stdDev / avgInterval > 0.5;

  checks.push({
    name: "Stagger intervals are consistent",
    passed: !inconsistent,
    severity: inconsistent ? "warning" : "info",
    message: inconsistent
      ? `Stagger intervals vary by ${stdDev.toFixed(0)}ms (avg ${avgInterval.toFixed(0)}ms). Align intervals for a consistent rhythm.`
      : `Stagger intervals are consistent (avg ${avgInterval.toFixed(0)}ms).`,
  });

  return checks;
}

function testTimingPacing(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  if (spec.components.length === 0) {
    checks.push({
      name: "Pacing is balanced",
      passed: true,
      severity: "info",
      message: "No components to evaluate pacing.",
    });
    return checks;
  }

  const durations = spec.components.map((c) => c.durationMs);
  const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
  const variance = durations.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  const highVariance = avg > 0 && stdDev / avg > 1.0;

  checks.push({
    name: "Duration variance is balanced",
    passed: !highVariance,
    severity: highVariance ? "warning" : "info",
    message: highVariance
      ? `Duration variance is high (std dev ${stdDev.toFixed(0)}ms, avg ${avg.toFixed(0)}ms). Group similar animations with similar durations.`
      : `Duration variance is reasonable (std dev ${stdDev.toFixed(0)}ms, avg ${avg.toFixed(0)}ms).`,
  });

  const sameStart = spec.components.filter((c) => c.delayMs === 0).length;
  const allAtOnce = sameStart > spec.components.length * 0.7 && spec.components.length > 3;
  checks.push({
    name: "Pacing distributes animations over time",
    passed: !allAtOnce,
    severity: allAtOnce ? "warning" : "info",
    message: allAtOnce
      ? `${sameStart}/${spec.components.length} components start at time 0 — stagger delays for better pacing.`
      : `Animations are distributed over time (${sameStart} start at 0).`,
  });

  return checks;
}

// ---------------------------------------------------------------------------
// Consistency test functions
// ---------------------------------------------------------------------------

function testConsistencyEasing(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  const families = new Map<string, string[]>();
  for (const c of spec.components) {
    const family = easingFamily(c.easing);
    const existing = families.get(family) ?? [];
    existing.push(c.name);
    families.set(family, existing);
  }

  if (families.size === 0) {
    checks.push({
      name: "Easing consistency",
      passed: true,
      severity: "info",
      message: "No components to evaluate easing consistency.",
    });
    return checks;
  }

  const inconsistent = families.size > 3;
  checks.push({
    name: "Easing families are consistent",
    passed: !inconsistent,
    severity: inconsistent ? "warning" : "info",
    message: inconsistent
      ? `${families.size} different easing families used: ${[...families.keys()].join(", ")}. Limit to 2-3 families for consistency.`
      : `${families.size} easing families used: ${[...families.keys()].join(", ")}.`,
  });

  const sceneGroups = new Map<string | null, MotionComponent[]>();
  for (const c of spec.components) {
    const group = sceneGroups.get(c.sceneId) ?? [];
    group.push(c);
    sceneGroups.set(c.sceneId, group);
  }

  for (const [sceneId, components] of sceneGroups) {
    if (components.length < 2) continue;
    const sceneKeys = new Set(components.map((c) => easingKey(c.easing)));
    const mixed = sceneKeys.size > 2;
    checks.push({
      name: "Easing consistent within scene",
      passed: !mixed,
      severity: mixed ? "warning" : "info",
      message: mixed
        ? `Scene "${sceneId ?? "default"}" uses ${sceneKeys.size} different easing curves. Align for visual consistency.`
        : `Scene "${sceneId ?? "default"}" uses consistent easing.`,
    });
  }

  return checks;
}

function testConsistencyColorPalette(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  const allColors: string[] = [];
  for (const c of spec.components) {
    allColors.push(...extractStyleColors(c.style));
    for (const kf of c.keyframes) {
      for (const key of Object.keys(kf.properties)) {
        if (COLOR_PROPERTIES.has(key)) {
          const val = kf.properties[key as keyof typeof kf.properties];
          if (typeof val === "string" && parseColor(val)) {
            allColors.push(val);
          }
        }
      }
    }
  }

  const unique = [...new Set(allColors)];

  if (unique.length === 0) {
    checks.push({
      name: "Color palette consistency",
      passed: true,
      severity: "info",
      message: "No explicit colors found — palette consistency cannot be evaluated.",
    });
    return checks;
  }

  const tooMany = unique.length > 10;
  checks.push({
    name: "Color palette is limited",
    passed: !tooMany,
    severity: tooMany ? "warning" : "info",
    message: tooMany
      ? `${unique.length} distinct colors across components and keyframes. Define a shared color token set.`
      : `${unique.length} distinct colors in use.`,
  });

  const hslColors = unique.map(colorToHsl).filter((h): h is { h: number; s: number; l: number } => h !== null);
  if (hslColors.length >= 2) {
    const lightnessValues = hslColors.map((c) => c.l);
    const lightnessSpread = Math.max(...lightnessValues) - Math.min(...lightnessValues);
    const narrow = lightnessSpread < 20 && hslColors.length > 3;
    checks.push({
      name: "Color lightness has sufficient range",
      passed: !narrow,
      severity: narrow ? "warning" : "info",
      message: narrow
        ? `Color lightness range is only ${lightnessSpread.toFixed(0)}% — add contrast between palette colors.`
        : `Color lightness range is ${lightnessSpread.toFixed(0)}%.`,
    });
  }

  return checks;
}

function testConsistencyTiming(spec: MotionSpec): TestCheck[] {
  const checks: TestCheck[] = [];

  if (spec.components.length === 0) {
    checks.push({
      name: "Timing consistency",
      passed: true,
      severity: "info",
      message: "No components to evaluate timing consistency.",
    });
    return checks;
  }

  const durations = spec.components.map((c) => c.durationMs);
  const uniqueDurations = [...new Set(durations)];

  const standardized = uniqueDurations.length <= Math.max(3, Math.ceil(spec.components.length / 3));
  checks.push({
    name: "Duration values follow a limited set",
    passed: standardized,
    severity: standardized ? "info" : "warning",
    message: standardized
      ? `${uniqueDurations.length} distinct duration values — timing is standardized.`
      : `${uniqueDurations.length} distinct duration values across ${spec.components.length} components. Consolidate to a timing scale (e.g., 200, 400, 800ms).`,
  });

  const templateGroups = new Map<string | null, MotionComponent[]>();
  for (const c of spec.components) {
    const group = templateGroups.get(c.templateId) ?? [];
    group.push(c);
    templateGroups.set(c.templateId, group);
  }

  for (const [templateId, components] of templateGroups) {
    if (components.length < 2) continue;
    const groupDurations = new Set(components.map((c) => c.durationMs));
    const consistent = groupDurations.size === 1;
    checks.push({
      name: "Timing consistent within template group",
      passed: consistent,
      severity: consistent ? "info" : "warning",
      message: consistent
        ? `Template "${templateId ?? "none"}" uses a consistent duration (${[...groupDurations][0]}ms).`
        : `Template "${templateId ?? "none"}" uses ${groupDurations.size} different durations. Align for consistency.`,
    });
  }

  return checks;
}

// ---------------------------------------------------------------------------
// Suite registry
// ---------------------------------------------------------------------------

/** Factory that binds a test function to suite metadata. */
function createSuite(
  id: string,
  name: string,
  description: string,
  category: TestCategory,
  testFn: (spec: MotionSpec) => TestCheck[],
): TestSuite {
  return {
    id,
    name,
    description,
    category,
    run: (spec: MotionSpec): TestResult => buildResult(id, name, category, testFn(spec)),
  };
}

const TEST_SUITES: TestSuite[] = [
  // Accessibility
  createSuite(
    "a11y-duration-check",
    "Duration Safety Check",
    "Verify animations don't exceed 5000ms for vestibular safety.",
    "accessibility",
    testA11yDuration,
  ),
  createSuite(
    "a11y-flash-check",
    "Flash Hazard Check",
    "Check for rapid color changes that could trigger photosensitive seizures (no more than 3 flashes per second).",
    "accessibility",
    testA11yFlash,
  ),
  createSuite(
    "a11y-contrast-check",
    "Contrast Readability Check",
    "Verify text remains readable during animation.",
    "accessibility",
    testA11yContrast,
  ),
  createSuite(
    "a11y-motion-reduction",
    "Motion Reduction Safety",
    "Check if motion can be safely reduced for vestibular-sensitive users.",
    "accessibility",
    testA11yMotionReduction,
  ),

  // Performance
  createSuite(
    "perf-simultaneous-animations",
    "Simultaneous Animations Check",
    "Check for too many simultaneous animations (max 10).",
    "performance",
    testPerfSimultaneous,
  ),
  createSuite(
    "perf-property-usage",
    "Property Usage Check",
    "Verify GPU-accelerated properties (transform, opacity) are preferred.",
    "performance",
    testPerfPropertyUsage,
  ),
  createSuite(
    "perf-keyframe-density",
    "Keyframe Density Check",
    "Check keyframe density isn't too high (max 20 keyframes per component).",
    "performance",
    testPerfKeyframeDensity,
  ),
  createSuite(
    "perf-complexity-score",
    "Complexity Score Check",
    "Calculate overall complexity score.",
    "performance",
    testPerfComplexity,
  ),

  // Visual
  createSuite(
    "visual-color-harmony",
    "Color Harmony Check",
    "Check color combinations for harmony.",
    "visual",
    testVisualColorHarmony,
  ),
  createSuite(
    "visual-spacing-consistency",
    "Spacing Consistency Check",
    "Verify consistent spacing patterns.",
    "visual",
    testVisualSpacing,
  ),
  createSuite(
    "visual-z-order",
    "Z-Order Check",
    "Check for potential z-order issues.",
    "visual",
    testVisualZOrder,
  ),
  createSuite(
    "visual-overlap-detection",
    "Overlap Detection Check",
    "Detect unintended overlaps.",
    "visual",
    testVisualOverlap,
  ),

  // Principles
  createSuite(
    "principle-squash-stretch",
    "Squash & Stretch Principle",
    "Check if squash & stretch is applied where appropriate.",
    "principles",
    testPrincipleSquashStretch,
  ),
  createSuite(
    "principle-anticipation",
    "Anticipation Principle",
    "Verify anticipation is present before main actions.",
    "principles",
    testPrincipleAnticipation,
  ),
  createSuite(
    "principle-follow-through",
    "Follow-Through Principle",
    "Check for follow-through after main actions.",
    "principles",
    testPrincipleFollowThrough,
  ),
  createSuite(
    "principle-arcs",
    "Arcs Principle",
    "Verify motion follows natural arcs where applicable.",
    "principles",
    testPrincipleArcs,
  ),

  // Timing
  createSuite(
    "timing-duration-range",
    "Duration Range Check",
    "Check durations are within reasonable ranges (200ms-5000ms).",
    "timing",
    testTimingDurationRange,
  ),
  createSuite(
    "timing-stagger-consistency",
    "Stagger Consistency Check",
    "Verify stagger intervals are consistent.",
    "timing",
    testTimingStagger,
  ),
  createSuite(
    "timing-pacing",
    "Pacing Check",
    "Check overall pacing feels natural.",
    "timing",
    testTimingPacing,
  ),

  // Consistency
  createSuite(
    "consistency-easing",
    "Easing Consistency Check",
    "Check if easing curves are consistent across related components.",
    "consistency",
    testConsistencyEasing,
  ),
  createSuite(
    "consistency-color-palette",
    "Color Palette Consistency Check",
    "Verify a consistent color palette.",
    "consistency",
    testConsistencyColorPalette,
  ),
  createSuite(
    "consistency-timing",
    "Timing Consistency Check",
    "Check timing patterns are consistent.",
    "consistency",
    testConsistencyTiming,
  ),
];

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/** Run all test suites and return a comprehensive report. */
export function runAllTests(spec: MotionSpec): TestReport {
  const results = TEST_SUITES.map((suite) => suite.run(spec));
  const passedSuites = results.filter((r) => r.passed).length;
  const overallScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 100;

  const topIssues = results
    .flatMap((r) => r.checks)
    .filter((c) => !c.passed && c.severity === "error")
    .slice(0, 10);

  const errorCount = topIssues.length;
  const warningCount = results
    .flatMap((r) => r.checks)
    .filter((c) => !c.passed && c.severity === "warning").length;

  const summary = `Overall score: ${overallScore}/100. ${passedSuites}/${results.length} suites passed. ${errorCount} error(s), ${warningCount} warning(s) across all checks.`;

  return {
    totalSuites: results.length,
    passedSuites,
    overallScore,
    results,
    topIssues,
    summary,
  };
}

/** Run only tests in a specific category. */
export function runTestsByCategory(spec: MotionSpec, category: TestCategory): TestResult[] {
  return TEST_SUITES
    .filter((suite) => suite.category === category)
    .map((suite) => suite.run(spec));
}

/** Run a single test suite by its ID. Returns undefined if not found. */
export function runTestSuite(spec: MotionSpec, suiteId: string): TestResult | undefined {
  const suite = TEST_SUITES.find((s) => s.id === suiteId);
  return suite ? suite.run(spec) : undefined;
}

/** List all available test suites. */
export function listTestSuites(): TestSuiteInfo[] {
  return TEST_SUITES.map((suite) => ({
    id: suite.id,
    name: suite.name,
    description: suite.description,
    category: suite.category,
  }));
}

/** Format the report as a human-readable string. */
export function formatTestReport(report: TestReport): string {
  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push("Motion Test Report");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(`Overall Score: ${report.overallScore}/100`);
  lines.push(`Suites Passed: ${report.passedSuites}/${report.totalSuites}`);
  lines.push(report.summary);
  lines.push("");

  const categoryOrder: TestCategory[] = [
    "accessibility", "performance", "visual", "principles", "timing", "consistency",
  ];
  const categoryLabels: Record<TestCategory, string> = {
    accessibility: "Accessibility",
    performance: "Performance",
    visual: "Visual",
    principles: "Principles",
    timing: "Timing",
    consistency: "Consistency",
  };

  for (const category of categoryOrder) {
    const categoryResults = report.results.filter((r) => r.category === category);
    if (categoryResults.length === 0) continue;

    lines.push("-".repeat(60));
    lines.push(`[${categoryLabels[category]}]`);
    lines.push("-".repeat(60));

    for (const result of categoryResults) {
      const status = result.passed ? "PASS" : "FAIL";
      lines.push(`  ${status} | ${result.suiteName} (${result.score}/100)`);
      lines.push(`       ${result.summary}`);

      const failed = result.checks.filter((c) => !c.passed);
      for (const check of failed) {
        const tag = check.severity.toUpperCase();
        lines.push(`       [${tag}] ${check.message}`);
      }

      if (result.recommendations.length > 0 && result.recommendations[0] !== "No issues found — all checks passed.") {
        for (const rec of result.recommendations) {
          lines.push(`       > ${rec}`);
        }
      }
      lines.push("");
    }
  }

  if (report.topIssues.length > 0) {
    lines.push("-".repeat(60));
    lines.push("Top Issues (errors)");
    lines.push("-".repeat(60));
    for (let i = 0; i < report.topIssues.length; i++) {
      const issue = report.topIssues[i];
      lines.push(`${i + 1}. [${issue.severity.toUpperCase()}] ${issue.name}`);
      lines.push(`   ${issue.message}`);
      if (issue.componentId) {
        lines.push(`   Component: ${issue.componentId}`);
      }
    }
  }

  lines.push("");
  lines.push("=".repeat(60));
  return lines.join("\n");
}
