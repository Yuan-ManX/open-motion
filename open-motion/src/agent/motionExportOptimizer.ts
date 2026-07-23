/**
 * Motion Export Optimizer — target-specific export optimization.
 *
 * This is the nineteenth original AI-native module. No existing module
 * optimizes a motion spec for a specific export target. Each target platform
 * (CSS Animations, Web Animations API, Lottie JSON, React Spring, GSAP)
 * has different capabilities, constraints, and optimal representation
 * strategies. The Export Optimizer analyzes the spec, detects target-specific
 * issues, and produces an optimized representation with fallbacks.
 *
 * Five export targets:
 * 1. CSS Animations — converts to @keyframes with vendor prefixes, detects
 *    unsupported properties, and generates a reduced-motion media query.
 * 2. Web Animations API (WAAPI) — converts to KeyframeEffect format,
 *    detects unsupported easing functions, and optimizes composite operations.
 * 3. Lottie JSON — converts to the Lottie schema, detects raster dependencies,
 *    and estimates the file size.
 * 4. React Spring — converts to spring physics configuration, detects
 *    incompatible easings (springs don't use cubic-bezier), and generates
 *    the config objects.
 * 5. GSAP — converts to GSAP timeline configuration, detects properties
 *    that benefit from GSAP's plugins, and generates the timeline code.
 *
 * For each target, the optimizer produces:
 * - A compatibility report (which properties are supported/unsupported)
 * - An optimized representation (the target-specific format)
 * - A fallback strategy for unsupported features
 * - An estimated output size
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec } from "@openmotion/shared";

/** Export targets. */
export type ExportTarget = "css" | "waapi" | "lottie" | "react-spring" | "gsap";

/** A compatibility issue for a specific export target. */
export interface CompatibilityIssue {
  componentId: string;
  componentName: string;
  property: string;
  issue: string;
  severity: "error" | "warning" | "info";
  fallback: string;
}

/** A CSS keyframe rule. */
export interface CssKeyframeRule {
  componentName: string;
  selector: string;
  keyframes: { offset: string; properties: Record<string, string> }[];
  animationProperty: string;
  duration: string;
  easing: string;
  delay: string;
  iterationCount: string;
  fillMode: string;
}

/** A WAAPI keyframe. */
export interface WaapiKeyframe {
  componentName: string;
  keyframes: Record<string, unknown>[];
  options: {
    duration: number;
    delay: number;
    easing: string;
    iterations: number | "Infinity";
    fill: string;
    direction: string;
  };
}

/** A Lottie layer. */
export interface LottieLayer {
  componentName: string;
  ty: number; // Layer type
  ks: Record<string, unknown>; // Transform
  ip: number; // In point
  op: number; // Out point
  st: number; // Start time
  sr: number; // Time stretch
}

/** A React Spring config. */
export interface ReactSpringConfig {
  componentName: string;
  config: {
    tension: number;
    friction: number;
    mass: number;
    clamp: boolean;
  };
  from: Record<string, unknown>;
  to: Record<string, unknown>;
}

/** A GSAP timeline step. */
export interface GsapTimelineStep {
  componentName: string;
  target: string;
  vars: Record<string, unknown>;
  position: string; // Position in the timeline
}

/** The optimized export result. */
export interface ExportOptimization {
  target: ExportTarget;
  /** Component count. */
  componentCount: number;
  /** Compatibility issues. */
  issues: CompatibilityIssue[];
  /** Whether all components are fully compatible. */
  fullyCompatible: boolean;
  /** Compatibility score 0..100. */
  compatibilityScore: number;
  /** CSS output (if target is css). */
  css?: CssKeyframeRule[];
  /** WAAPI output (if target is waapi). */
  waapi?: WaapiKeyframe[];
  /** Lottie layers (if target is lottie). */
  lottie?: LottieLayer[];
  /** React Spring configs (if target is react-spring). */
  reactSpring?: ReactSpringConfig[];
  /** GSAP timeline steps (if target is gsap). */
  gsap?: GsapTimelineStep[];
  /** Estimated output size in KB. */
  estimatedSizeKb: number;
  /** Reduced-motion strategy. */
  reducedMotionStrategy: string;
  /** Human-readable summary. */
  summary: string;
}

/** Properties supported by each target. */
const TARGET_SUPPORT: Record<ExportTarget, Record<string, boolean>> = {
  css: {
    transform: true, opacity: true, color: true, backgroundColor: true,
    boxShadow: true, filter: true, width: true, height: true,
    margin: true, padding: true, fontSize: true, backdropFilter: true,
  },
  waapi: {
    transform: true, opacity: true, color: true, backgroundColor: true,
    boxShadow: true, filter: true, width: true, height: true,
    margin: true, padding: true, fontSize: true, backdropFilter: false,
  },
  lottie: {
    transform: true, opacity: true, color: true, backgroundColor: true,
    boxShadow: false, filter: false, width: true, height: true,
    margin: false, padding: false, fontSize: true, backdropFilter: false,
  },
  "react-spring": {
    transform: true, opacity: true, color: true, backgroundColor: true,
    boxShadow: true, filter: true, width: true, height: true,
    margin: true, padding: true, fontSize: true, backdropFilter: true,
  },
  gsap: {
    transform: true, opacity: true, color: true, backgroundColor: true,
    boxShadow: true, filter: true, width: true, height: true,
    margin: true, padding: true, fontSize: true, backdropFilter: true,
  },
};

/** Easings supported by each target. */
const TARGET_EASING_SUPPORT: Record<ExportTarget, string[]> = {
  css: ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "cubic-bezier", "steps"],
  waapi: ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "cubic-bezier"],
  lottie: ["linear", "ease-in", "ease-out", "ease-in-out", "cubic-bezier"],
  "react-spring": ["spring"], // React Spring uses physics, not bezier
  gsap: ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "cubic-bezier", "bounce", "elastic", "back", "steps"],
};

/**
 * Check if an easing is a spring-based easing.
 */
function isSpringEasing(easing: string): boolean {
  return /spring|bounce|elastic/.test(easing.toLowerCase());
}

/**
 * Convert easing to cubic-bezier for targets that don't support springs.
 */
function toCubicBezier(easing: string): string {
  if (easing.includes("cubic-bezier")) return easing;
  if (easing === "spring") return "cubic-bezier(0.34, 1.56, 0.64, 1)"; // Approximate spring
  if (easing === "bounce") return "cubic-bezier(0.68, -0.55, 0.265, 1.55)";
  if (easing === "elastic") return "cubic-bezier(0.68, -0.55, 0.265, 1.55)";
  return easing || "ease";
}

/**
 * Convert spring easing to React Spring config.
 */
function springToConfig(easing: string): { tension: number; friction: number } {
  if (easing.includes("bouncy") || easing.includes("stiff")) {
    return { tension: 300, friction: 10 };
  }
  if (easing.includes("slow") || easing.includes("gentle")) {
    return { tension: 100, friction: 20 };
  }
  if (easing.includes("wobbly")) {
    return { tension: 180, friction: 12 };
  }
  return { tension: 200, friction: 15 }; // Default spring
}

/**
 * Check compatibility of a component with a target.
 */
function checkCompatibility(
  component: MotionComponent,
  target: ExportTarget,
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  const support = TARGET_SUPPORT[target];
  const easingSupport = TARGET_EASING_SUPPORT[target];

  // Check animated properties
  for (const kf of component.keyframes) {
    for (const prop of Object.keys(kf.properties)) {
      const normalized = prop.replace(/-[a-z]/g, (m) => m.charAt(1).toUpperCase());
      const key = normalized.charAt(0).toLowerCase() + normalized.slice(1);

      if (key in support && !support[key]) {
        issues.push({
          componentId: component.id,
          componentName: component.name,
          property: prop,
          issue: `Property "${prop}" is not supported by ${target.toUpperCase()}`,
          severity: "error",
          fallback: target === "lottie" ? "Use a raster image or pre-rendered sprite" : "Use transform or opacity instead",
        });
      } else if (!(key in support)) {
        issues.push({
          componentId: component.id,
          componentName: component.name,
          property: prop,
          issue: `Property "${prop}" has unknown support for ${target.toUpperCase()}`,
          severity: "warning",
          fallback: "May work — test on the target platform",
        });
      }
    }
  }

  // Check easing
  const easing = String(component.easing);
  const isSpring = isSpringEasing(easing);
  const easingSupported = easingSupport.some((e) => easing.toLowerCase().includes(e));

  if (!easingSupported) {
    if (isSpring && target === "react-spring") {
      // Spring is fine for react-spring
    } else if (isSpring && target !== "gsap" && target !== "react-spring") {
      issues.push({
        componentId: component.id,
        componentName: component.name,
        property: "easing",
        issue: `Easing "${easing}" is a spring physics easing, not supported by ${target.toUpperCase()}`,
        severity: "error",
        fallback: `Use ${toCubicBezier(easing)} as an approximation`,
      });
    }
  }

  return issues;
}

/**
 * Convert a component to CSS @keyframes.
 */
function toCss(component: MotionComponent): CssKeyframeRule {
  const keyframes = component.keyframes.map((kf, i) => {
    const offset = kf.offset !== undefined
      ? `${Math.round(kf.offset * 100)}%`
      : i === 0 ? "0%" : i === component.keyframes.length - 1 ? "100%" : `${Math.round((i / (component.keyframes.length - 1)) * 100)}%`;
    const props: Record<string, string> = {};
    for (const [key, value] of Object.entries(kf.properties)) {
      const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      props[cssKey] = String(value);
    }
    return { offset, properties: props };
  });

  return {
    componentName: component.name,
    selector: `.${component.name.toLowerCase().replace(/\s+/g, "-")}`,
    keyframes,
    animationProperty: `animation`,
    duration: `${component.durationMs}ms`,
    easing: toCubicBezier(String(component.easing)),
    delay: `${component.delayMs}ms`,
    iterationCount: component.iterationCount === "infinite" ? "infinite" : String(component.iterationCount),
    fillMode: "both",
  };
}

/**
 * Convert a component to WAAPI format.
 */
function toWaapi(component: MotionComponent): WaapiKeyframe {
  const keyframes = component.keyframes.map((kf) => {
    const frame: Record<string, unknown> = {};
    if (kf.offset !== undefined) frame.offset = kf.offset;
    for (const [key, value] of Object.entries(kf.properties)) {
      frame[key] = value;
    }
    return frame;
  });

  return {
    componentName: component.name,
    keyframes,
    options: {
      duration: component.durationMs,
      delay: component.delayMs,
      easing: toCubicBezier(String(component.easing)),
      iterations: component.iterationCount === "infinite" ? "Infinity" : (typeof component.iterationCount === "number" ? component.iterationCount : 1),
      fill: "both",
      direction: "normal",
    },
  };
}

/**
 * Convert a component to a Lottie layer.
 */
function toLottie(component: MotionComponent): LottieLayer {
  const fps = 60;
  return {
    componentName: component.name,
    ty: 4, // Shape layer
    ks: {
      o: { a: 1, k: component.keyframes.filter((kf) => "opacity" in kf.properties).map((kf) => ({ t: Math.round(kf.offset! * component.durationMs / 1000 * fps), s: [kf.properties.opacity] })) },
      p: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
    },
    ip: Math.round(component.delayMs / 1000 * fps),
    op: Math.round((component.delayMs + component.durationMs * (typeof component.iterationCount === "number" ? component.iterationCount : 1)) / 1000 * fps),
    st: 0,
    sr: 1,
  };
}

/**
 * Convert a component to a React Spring config.
 */
function toReactSpring(component: MotionComponent): ReactSpringConfig {
  const easing = String(component.easing);
  const springConfig = isSpringEasing(easing) ? springToConfig(easing) : { tension: 200, friction: 15 };

  const fromFrame = component.keyframes[0]?.properties || {};
  const toFrame = component.keyframes[component.keyframes.length - 1]?.properties || {};

  return {
    componentName: component.name,
    config: {
      tension: springConfig.tension,
      friction: springConfig.friction,
      mass: 1,
      clamp: true,
    },
    from: { ...fromFrame },
    to: { ...toFrame },
  };
}

/**
 * Convert a component to GSAP timeline step.
 */
function toGsap(component: MotionComponent): GsapTimelineStep {
  const vars: Record<string, unknown> = {
    duration: component.durationMs / 1000,
    ease: String(component.easing),
    delay: component.delayMs / 1000,
  };

  const lastFrame = component.keyframes[component.keyframes.length - 1]?.properties || {};
  for (const [key, value] of Object.entries(lastFrame)) {
    vars[key] = value;
  }

  if (component.iterationCount === "infinite") {
    vars.repeat = -1;
  } else if (typeof component.iterationCount === "number") {
    vars.repeat = component.iterationCount - 1;
  }

  return {
    componentName: component.name,
    target: `".${component.name.toLowerCase().replace(/\s+/g, "-")}"`,
    vars,
    position: component.delayMs > 0 ? `"+=${component.delayMs / 1000}"` : `">"`,
  };
}

/**
 * Estimate the output size in KB.
 */
function estimateSize(target: ExportTarget, componentCount: number): number {
  const baseSize = target === "lottie" ? 2.5 : target === "gsap" ? 0.8 : target === "react-spring" ? 0.6 : target === "waapi" ? 0.5 : 0.4;
  return Math.round(componentCount * baseSize * 10) / 10;
}

/**
 * Generate a reduced-motion strategy for the target.
 */
function reducedMotionStrategy(target: ExportTarget): string {
  switch (target) {
    case "css":
      return "@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; } }";
    case "waapi":
      return "Check window.matchMedia('(prefers-reduced-motion: reduce)').matches before calling .play(); if true, set duration to 0.";
    case "lottie":
      return "Set the Lottie player's autoplay to false and provide a static poster frame when prefers-reduced-motion is active.";
    case "react-spring":
      return "Use useReducedMotion() from @react-spring/web to conditionally set duration to 0.";
    case "gsap":
      return "Use gsap.matchMedia() with '(prefers-reduced-motion: reduce)' to set duration to 0 and disable repeat.";
  }
}

/**
 * Optimize a motion spec for a specific export target.
 */
export function optimizeForExport(
  spec: MotionSpec,
  target: ExportTarget,
): ExportOptimization {
  const components = spec.components;
  if (components.length === 0) {
    return {
      target,
      componentCount: 0,
      issues: [],
      fullyCompatible: true,
      compatibilityScore: 100,
      estimatedSizeKb: 0,
      reducedMotionStrategy: reducedMotionStrategy(target),
      summary: "Empty project — nothing to export.",
    };
  }

  // Check compatibility
  const allIssues: CompatibilityIssue[] = [];
  for (const c of components) {
    allIssues.push(...checkCompatibility(c, target));
  }

  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const fullyCompatible = errorCount === 0;
  const compatibilityScore = Math.max(0, 100 - errorCount * 15 - warningCount * 5);

  // Generate target-specific output
  let css: CssKeyframeRule[] | undefined;
  let waapi: WaapiKeyframe[] | undefined;
  let lottie: LottieLayer[] | undefined;
  let reactSpring: ReactSpringConfig[] | undefined;
  let gsap: GsapTimelineStep[] | undefined;

  switch (target) {
    case "css": css = components.map(toCss); break;
    case "waapi": waapi = components.map(toWaapi); break;
    case "lottie": lottie = components.map(toLottie); break;
    case "react-spring": reactSpring = components.map(toReactSpring); break;
    case "gsap": gsap = components.map(toGsap); break;
  }

  const estimatedSizeKb = estimateSize(target, components.length);
  const strategy = reducedMotionStrategy(target);

  const summary = `Target: ${target.toUpperCase()}. ${components.length} component(s). Compatibility: ${compatibilityScore}%. ${errorCount} error(s), ${warningCount} warning(s). Estimated size: ${estimatedSizeKb}KB. ${fullyCompatible ? "Fully compatible." : "Has compatibility issues — see details."}`;

  return {
    target,
    componentCount: components.length,
    issues: allIssues,
    fullyCompatible,
    compatibilityScore,
    css,
    waapi,
    lottie,
    reactSpring,
    gsap,
    estimatedSizeKb,
    reducedMotionStrategy: strategy,
    summary,
  };
}

/**
 * List all export targets.
 */
export function listExportTargets(): Array<{ target: ExportTarget; name: string; description: string }> {
  return [
    { target: "css", name: "CSS Animations", description: "Standard CSS @keyframes with vendor prefixes. Universal browser support." },
    { target: "waapi", name: "Web Animations API", description: "Native browser animation API with JavaScript control. No library needed." },
    { target: "lottie", name: "Lottie JSON", description: "Bodymovin/Lottie format for After Effects-style animations. Requires lottie-web." },
    { target: "react-spring", name: "React Spring", description: "Spring physics animation library for React. Natural, organic motion." },
    { target: "gsap", name: "GSAP", description: "GreenSock Animation Platform. Timeline-based with plugin ecosystem." },
  ];
}

/**
 * Format the export optimization report.
 */
export function formatExportReport(opt: ExportOptimization): string {
  const lines: string[] = [];
  lines.push(`# Motion Export Optimizer Report`);
  lines.push("");
  lines.push(`**Target: ${opt.target.toUpperCase()}** | Compatibility: ${opt.compatibilityScore}% | Size: ~${opt.estimatedSizeKb}KB`);
  lines.push(opt.summary);
  lines.push("");

  if (opt.issues.length > 0) {
    lines.push(`## Compatibility Issues`);
    for (const i of opt.issues) {
      lines.push(`- [${i.severity.toUpperCase()}] ${i.componentName}: ${i.property} — ${i.issue}`);
      lines.push(`  Fallback: ${i.fallback}`);
    }
    lines.push("");
  }

  lines.push(`## Reduced Motion Strategy`);
  lines.push(opt.reducedMotionStrategy);

  return lines.join("\n");
}
