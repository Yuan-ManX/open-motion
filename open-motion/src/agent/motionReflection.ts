import type { MotionSpec, Easing } from "@openmotion/shared";

/**
 * Success-reflection produced after a spec-changing turn that completed
 * without tool failures. Whereas `reflectOnFailures` reacts to errors, this
 * engine evaluates whether the completed spec change actually achieves the
 * user's stated intent and surfaces a positive assessment plus an optional
 * refinement suggestion. Rule-based so mock mode stays fully functional.
 */
export interface SuccessReflection {
  text: string;
  /** Optional next-step refinement. Empty string when no refinement is needed. */
  suggestion: string;
  /** Whether the change appears to satisfy the user's stated intent. */
  achieved: boolean;
}

interface EasingProfile {
  family: string;
  bouncy: boolean;
  smooth: boolean;
  snappy: boolean;
}

function profileEasing(easing: Easing): EasingProfile {
  if (easing.type === "preset") {
    const n = easing.name.toLowerCase();
    return {
      family: easing.name,
      bouncy: /bounce|elastic|back|spring/.test(n),
      smooth: /smooth|ease-in-out|ease-out/.test(n),
      snappy: /snappy|ease-in|linear/.test(n),
    };
  }
  if (easing.type === "spring") return { family: "spring", bouncy: true, smooth: false, snappy: false };
  return { family: "bezier", bouncy: false, smooth: true, snappy: false };
}

function countInfiniteLoops(spec: MotionSpec): number {
  return spec.components.filter((c) => c.iterationCount === "infinite").length;
}

/**
 * Build a success-reflection for a completed spec-changing turn. The engine
 * matches the user's request against observable spec state to confirm the
 * intent was achieved, then offers a targeted refinement when there is a
 * clear next step.
 */
export function reflectOnSuccess(
  userMessage: string,
  spec: MotionSpec,
  successfulTools: string[],
): SuccessReflection {
  const text = userMessage.toLowerCase();
  const checks: string[] = [];
  const refinements: string[] = [];
  let achieved = true;

  // --- Tactile feel: easing should match the requested character. ---
  if (/\b(bouncy|elastic|spring)\b/.test(text)) {
    const matches = spec.components.filter((c) => profileEasing(c.easing).bouncy).length;
    if (matches > 0) {
      checks.push(`${matches} component(s) now use a bouncy easing family.`);
    } else {
      achieved = false;
      refinements.push("No bouncy easing detected yet — try `set_easing` with `bounce` or `elastic`.");
    }
  } else if (/\b(smooth|calm|gentle)\b/.test(text)) {
    const matches = spec.components.filter((c) => profileEasing(c.easing).smooth).length;
    if (matches > 0) {
      checks.push(`${matches} component(s) now use a smooth easing family.`);
    } else {
      achieved = false;
      refinements.push("No smooth easing detected yet — try `set_easing` with `ease-in-out`.");
    }
  } else if (/\b(snappy|quick|fast)\b/.test(text)) {
    const matches = spec.components.filter((c) => profileEasing(c.easing).snappy).length;
    if (matches > 0) {
      checks.push(`${matches} component(s) now use a snappy easing family.`);
    }
  }

  // --- Timing: duration should reflect the requested direction. ---
  if (/\b(slower|longer|calm|gentle)\b/.test(text)) {
    const long = spec.components.filter((c) => c.durationMs >= 800).length;
    if (long > 0) {
      checks.push(`${long} component(s) hold a duration of 800ms or longer.`);
    } else {
      refinements.push("Durations are still short — consider `set_duration` above 800ms for a calmer feel.");
    }
  } else if (/\b(faster|quicker|snappy)\b/.test(text)) {
    const short = spec.components.filter((c) => c.durationMs <= 400).length;
    if (short > 0) {
      checks.push(`${short} component(s) now finish within 400ms.`);
    }
  }

  // --- Loop behavior. ---
  if (/\b(loop|repeat|forever)\b/.test(text)) {
    const loops = countInfiniteLoops(spec);
    if (loops > 0) {
      checks.push(`${loops} component(s) now loop infinitely.`);
    } else {
      achieved = false;
      refinements.push("No infinite loops detected — use `set_loop` with `infinite` to fulfill the loop request.");
    }
  } else if (/\b(once|single|no.*loop|stop.*loop)\b/.test(text)) {
    const loops = countInfiniteLoops(spec);
    if (loops === 0) {
      checks.push("All components now play once — no infinite loops remain.");
    }
  }

  // --- Stagger / choreography: delays should spread across components. ---
  if (/\b(stagger|cascade|choreograph|wave|ripple|sequence)\b/.test(text)) {
    if (spec.components.length >= 2) {
      const delays = spec.components.map((c) => c.delayMs);
      const distinctDelays = new Set(delays).size;
      if (distinctDelays >= 2) {
        checks.push(`Components now stagger across ${distinctDelays} distinct delay values.`);
      } else {
        achieved = false;
        refinements.push("All components share the same delay — apply `apply_choreography` to spread their start times.");
      }
    }
  }

  // --- Color / visual style. ---
  if (/\b(color|red|blue|green|purple|background)\b/.test(text)) {
    const colored = spec.components.filter((c) => {
      const s = c.style ?? {};
      return typeof s.color === "string" || typeof s.background === "string";
    }).length;
    if (colored > 0) {
      checks.push(`${colored} component(s) carry an explicit color or background.`);
    }
  }

  // --- 3D transforms. ---
  if (/\b(3d|perspective|rotateX|rotateY)\b/.test(text)) {
    const has3d = spec.components.some((c) => {
      const s = c.style ?? {};
      return Object.keys(s).some((k) => /perspective|rotateX|rotateY|translateZ/i.test(k));
    });
    if (has3d) {
      checks.push("3D transforms are now present on at least one component.");
    } else {
      achieved = false;
      refinements.push("No 3D transform detected — apply `set_transform` with `perspective` or `rotateX`.");
    }
  }

  // --- Restraint health: flag when the scene crosses comfort thresholds. ---
  const infiniteLoops = countInfiniteLoops(spec);
  if (infiniteLoops >= 4) {
    refinements.push(`${infiniteLoops} components loop infinitely — consider reducing loops to keep the scene calm.`);
  }
  if (spec.components.length > 12) {
    refinements.push(`Scene density is high (${spec.components.length} components) — further additions risk visual overload.`);
  }

  // --- Tool-specific confirmation: when a recipe or preset was applied,
  // the spec should reflect coordinated timing across components. ---
  if (successfulTools.includes("apply_recipe") || successfulTools.includes("apply_preset")) {
    if (spec.components.length >= 2) {
      const families = new Set(spec.components.map((c) => profileEasing(c.easing).family));
      if (families.size === 1) {
        checks.push(`Recipe/preset coordinated ${spec.components.length} components under one easing family.`);
      }
    }
  }

  // --- Compose the reflection text. ---
  const parts: string[] = [];
  if (checks.length > 0) {
    parts.push(`Intent check: ${checks.join(" ")}`);
  } else if (achieved) {
    parts.push(`Spec updated via ${successfulTools.length} successful tool call(s); the change is consistent with the request.`);
  }
  if (!achieved) {
    parts.push("Some aspects of the request are not yet reflected in the spec.");
  }

  return {
    text: parts.join(" "),
    suggestion: refinements[0] ?? "",
    achieved,
  };
}
