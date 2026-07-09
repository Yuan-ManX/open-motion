import type { Easing, MotionComponent, MotionSpec } from "@openmotion/shared";

export type InsightSeverity = "info" | "warning" | "critical";

export interface Insight {
  severity: InsightSeverity;
  category: string;
  message: string;
}

export interface AnalysisResult {
  insights: Insight[];
  score: number;
  componentCount: number;
}

export interface Suggestion {
  text: string;
  priority: "high" | "medium" | "low";
}

/** Classify an easing into a short family token for conflict detection. */
function easingFamily(easing: Easing | undefined): string {
  if (!easing) return "linear";
  if (easing.type === "preset") {
    const n = easing.name;
    if (/bounce|back|elastic|spring/.test(n)) return "bounce";
    if (/smooth|ease-in-out|ease-out/.test(n)) return "smooth";
    if (/snappy|ease-in/.test(n)) return "snappy";
    return n;
  }
  if (easing.type === "spring") return "bounce";
  if (easing.type === "bezier") return "bezier";
  return "linear";
}

/** Collect the set of animated property names from a component's keyframes. */
function animatedPropertySet(comp: MotionComponent): Set<string> {
  const props = new Set<string>();
  for (const kf of comp.keyframes) {
    for (const key of Object.keys(kf.properties)) props.add(key);
  }
  return props;
}

/**
 * Analyze a motion spec for quality, timing, accessibility, and composition.
 * Returns a scored list of insights the agent or user can act on.
 */
export function analyzeMotion(spec: MotionSpec, componentId?: string): AnalysisResult {
  const components = componentId
    ? spec.components.filter((c) => c.id === componentId)
    : spec.components;

  if (components.length === 0) {
    return {
      insights: [
        {
          severity: "info",
          category: "empty",
          message: "The canvas is empty — add a layer or apply a template to begin.",
        },
      ],
      score: 100,
      componentCount: 0,
    };
  }

  const insights: Insight[] = [];

  // Timing analysis — flag components that are too fast or too slow.
  for (const comp of components) {
    if (comp.durationMs < 300) {
      insights.push({
        severity: "warning",
        category: "timing",
        message: `"${comp.name}" is very fast (${comp.durationMs}ms) — may feel abrupt. Consider 400–800ms for UI motion.`,
      });
    } else if (comp.durationMs > 3000) {
      insights.push({
        severity: "warning",
        category: "timing",
        message: `"${comp.name}" is slow (${comp.durationMs}ms) — may lose user attention. Consider under 2000ms.`,
      });
    }
  }

  // Easing conflict detection — mixed easing families can feel inconsistent.
  if (components.length > 1) {
    const families = new Set(components.map((c) => easingFamily(c.easing)));
    if (families.size > 2) {
      insights.push({
        severity: "info",
        category: "easing",
        message: `Mixed easing families (${Array.from(families).join(", ")}) — consider unifying for visual consistency.`,
      });
    }
  }

  // Restraint budget — too many simultaneous infinite loops compete for attention.
  const loopingComps = components.filter((c) => c.iterationCount === "infinite");
  if (loopingComps.length > 3) {
    insights.push({
      severity: "warning",
      category: "overload",
      message: `${loopingComps.length} components loop forever — the eye cannot rest. Consider reducing loops to 2–3 ambient layers.`,
    });
  }

  // Accessibility — the generated CSS should respect prefers-reduced-motion.
  insights.push({
    severity: "info",
    category: "accessibility",
    message: "Ensure exported CSS includes a @media (prefers-reduced-motion: reduce) fallback for users who disable motion.",
  });

  // Rhythm — uniform durations can feel mechanical.
  if (components.length > 1) {
    const durations = new Set(components.map((c) => c.durationMs));
    if (durations.size === 1) {
      insights.push({
        severity: "info",
        category: "rhythm",
        message: "All layers share the same duration — varying durations creates a more natural rhythm.",
      });
    }
  }

  // Hierarchy — without staggered delays, entrances feel simultaneous.
  if (components.length > 3) {
    const withDelay = components.filter((c) => c.delayMs > 0).length;
    if (withDelay === 0) {
      insights.push({
        severity: "info",
        category: "hierarchy",
        message: "No staggered delays detected — entrance may feel simultaneous. Try 'stagger' for a choreographed reveal.",
      });
    }
  }

  // Score: start at 100, subtract penalties.
  let score = 100;
  for (const insight of insights) {
    if (insight.severity === "critical") score -= 20;
    else if (insight.severity === "warning") score -= 10;
    else score -= 2;
  }
  score = Math.max(0, score);

  return { insights, score, componentCount: components.length };
}

/**
 * Generate context-aware next-step suggestions based on the current project state.
 * Returns 3–5 suggestions ordered by priority.
 */
export function suggestNext(spec: MotionSpec): Suggestion[] {
  const components = spec.components;
  const suggestions: Suggestion[] = [];

  if (components.length === 0) {
    suggestions.push({ text: "Start with a template — try 'Create a bounce animation'", priority: "high" });
    suggestions.push({ text: "Add a fade-in layer for a subtle entrance", priority: "medium" });
    suggestions.push({ text: "Browse templates to find a starting point", priority: "medium" });
    return suggestions;
  }

  if (components.length === 1) {
    suggestions.push({ text: "Add a second layer to create visual depth", priority: "high" });
    suggestions.push({ text: "Try 'stagger' for cascading timing across layers", priority: "medium" });
    suggestions.push({ text: "Describe this motion to see its Motion DNA", priority: "low" });
    return suggestions;
  }

  // Easing variety check.
  const families = new Set(components.map((c) => easingFamily(c.easing)));
  if (families.size === 1 && components.length > 1) {
    suggestions.push({
      text: "All layers use the same easing — try 'make it bouncy' on one layer for contrast",
      priority: "medium",
    });
  }

  // Loop check — suggest ambient motion if none loops.
  const hasLoop = components.some((c) => c.iterationCount === "infinite");
  if (!hasLoop) {
    suggestions.push({
      text: "Add ambient motion — try 'pulse' or 'float' preset for subtle life",
      priority: "medium",
    });
  }

  // Stagger check.
  const withDelay = components.filter((c) => c.delayMs > 0).length;
  if (components.length > 2 && withDelay === 0) {
    suggestions.push({
      text: "Stagger the entrances for a choreographed reveal",
      priority: "high",
    });
  }

  // Category balance — if all are entrance, suggest an exit or emphasis.
  suggestions.push({
    text: "Analyze the motion for quality insights",
    priority: "low",
  });

  // Ensure 3–5 suggestions.
  if (suggestions.length < 3) {
    suggestions.push({ text: "Create a variant of an existing layer to explore alternatives", priority: "low" });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions.slice(0, 5);
}
