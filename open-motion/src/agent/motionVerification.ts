import type { MotionSpec, Easing, MotionComponent } from "@openmotion/shared";

/**
 * Structured assertion-based verification engine.
 *
 * Whereas `reflectOnSuccess` produces a single heuristic text snippet, this
 * module compiles the user's request into a list of testable assertions and
 * evaluates each one against the resulting spec. Each assertion carries a
 * claim, a severity, a pass/fail/skip verdict, and an evidence string, so the
 * agent gets a verifiable self-correction signal instead of a vague hunch.
 *
 * The engine is rule-based (no LLM round-trip) so mock mode stays functional.
 * Assertions are derived from the user message vocabulary and the observable
 * spec state — every check references concrete fields so failures point at the
 * exact gap the agent must close.
 *
 * Used in two ways:
 *   1. Inline in the orchestrator success-reflection path to produce a richer
 *      `reflection` event with structured evidence.
 *   2. As the `verify_motion` tool the LLM can call explicitly when it wants
 *      to double-check its work before reporting completion.
 */

export type AssertionSeverity = "required" | "recommended" | "advisory";
export type AssertionVerdict = "pass" | "fail" | "skip";

export interface VerificationAssertion {
  /** Short human-readable claim, e.g. "All components use a bouncy easing family". */
  claim: string;
  severity: AssertionSeverity;
  verdict: AssertionVerdict;
  /** Concrete evidence from the spec explaining the verdict. */
  evidence: string;
  /** Suggested tool to fix a failed assertion. Empty when verdict is pass. */
  remediation: string;
}

export interface VerificationReport {
  /** Original user intent, summarized. */
  intent: string;
  assertions: VerificationAssertion[];
  /** 0..1 fraction of required assertions that passed. */
  achievedRatio: number;
  /** True when every required assertion passed. */
  achieved: boolean;
  /** Aggregated remediation summary, empty when everything passes. */
  summary: string;
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

function animatedProperties(c: MotionComponent): Set<string> {
  const set = new Set<string>();
  for (const kf of c.keyframes) {
    for (const key of Object.keys(kf.properties)) set.add(key);
  }
  return set;
}

function hasStyleKey(c: MotionComponent, pattern: RegExp): boolean {
  const s = c.style ?? {};
  return Object.keys(s).some((k) => pattern.test(k));
}

/**
 * Compile the user message + spec into a list of testable assertions.
 * Each matcher reads the message for intent and the spec for the expected
 * outcome. Assertions are appended in priority order; the engine stops
 * adding once the request vocabulary is exhausted.
 */
function compileAssertions(userMessage: string, spec: MotionSpec): VerificationAssertion[] {
  const text = userMessage.toLowerCase();
  const out: VerificationAssertion[] = [];
  const comps = spec.components;

  // --- Tactile feel: easing family must match the requested character. ---
  if (/\b(bouncy|bounce|elastic|springy)\b/.test(text)) {
    const matches = comps.filter((c) => profileEasing(c.easing).bouncy).length;
    out.push({
      claim: "At least one component uses a bouncy easing family (bounce/elastic/back/spring).",
      severity: "required",
      verdict: matches > 0 ? "pass" : "fail",
      evidence: matches > 0 ? `${matches} component(s) carry a bouncy easing.` : "No bouncy easing detected on any component.",
      remediation: matches > 0 ? "" : "Call set_easing with bounce, elastic, or back — or set_spring for physics-based bounce.",
    });
  } else if (/\b(smooth|calm|gentle|soft)\b/.test(text)) {
    const matches = comps.filter((c) => profileEasing(c.easing).smooth).length;
    out.push({
      claim: "At least one component uses a smooth easing family (smooth/ease-in-out/ease-out).",
      severity: "required",
      verdict: matches > 0 ? "pass" : "fail",
      evidence: matches > 0 ? `${matches} component(s) carry a smooth easing.` : "No smooth easing detected.",
      remediation: matches > 0 ? "" : "Call set_easing with smooth, ease-in-out, or ease-out.",
    });
  } else if (/\b(snappy|crisp|sharp|quick)\b/.test(text)) {
    const matches = comps.filter((c) => profileEasing(c.easing).snappy).length;
    out.push({
      claim: "At least one component uses a snappy easing family (snappy/ease-in/linear).",
      severity: "required",
      verdict: matches > 0 ? "pass" : "fail",
      evidence: matches > 0 ? `${matches} component(s) carry a snappy easing.` : "No snappy easing detected.",
      remediation: matches > 0 ? "" : "Call set_easing with snappy or ease-in.",
    });
  }

  // --- Timing direction. ---
  if (/\b(slower|longer|more.time)\b/.test(text)) {
    const long = comps.filter((c) => c.durationMs >= 800).length;
    out.push({
      claim: "At least one component duration is 800ms or longer.",
      severity: "required",
      verdict: long > 0 ? "pass" : "fail",
      evidence: long > 0 ? `${long} component(s) hold a duration >= 800ms.` : `All durations are under 800ms (max ${comps.reduce((m, c) => Math.max(m, c.durationMs), 0)}ms).`,
      remediation: long > 0 ? "" : "Call set_duration with a value of 800 or higher.",
    });
  } else if (/\b(faster|quicker|shorter|less.time)\b/.test(text)) {
    const short = comps.filter((c) => c.durationMs <= 400).length;
    out.push({
      claim: "At least one component duration is 400ms or shorter.",
      severity: "required",
      verdict: short > 0 ? "pass" : "fail",
      evidence: short > 0 ? `${short} component(s) finish within 400ms.` : `All durations exceed 400ms (min ${comps.reduce((m, c) => Math.min(m, c.durationMs), Infinity)}ms).`,
      remediation: short > 0 ? "" : "Call set_duration with a value of 400 or lower.",
    });
  }

  // --- Loop behavior. ---
  if (/\b(loop|repeat|forever|infinite)\b/.test(text)) {
    const loops = countInfiniteLoops(spec);
    out.push({
      claim: "At least one component loops infinitely.",
      severity: "required",
      verdict: loops > 0 ? "pass" : "fail",
      evidence: loops > 0 ? `${loops} component(s) loop infinitely.` : "No infinite loops are set.",
      remediation: loops > 0 ? "" : "Call set_loop with iterationCount 'infinite'.",
    });
  } else if (/\b(once|single|no.*loop|stop.*loop|play.*once)\b/.test(text)) {
    const loops = countInfiniteLoops(spec);
    out.push({
      claim: "No component loops infinitely.",
      severity: "required",
      verdict: loops === 0 ? "pass" : "fail",
      evidence: loops === 0 ? "All components play once." : `${loops} component(s) still loop infinitely.`,
      remediation: loops === 0 ? "" : "Call set_loop with iterationCount 1 on the looping components.",
    });
  }

  // --- Stagger / choreography: delays must spread. ---
  if (/\b(stagger|cascade|choreograph|wave|ripple|sequence|one.by.one)\b/.test(text)) {
    if (comps.length >= 2) {
      const distinctDelays = new Set(comps.map((c) => c.delayMs)).size;
      out.push({
        claim: "Components stagger across at least 2 distinct delay values.",
        severity: "required",
        verdict: distinctDelays >= 2 ? "pass" : "fail",
        evidence: distinctDelays >= 2 ? `${distinctDelays} distinct delay values distribute the start times.` : "All components share the same delay — no stagger is present.",
        remediation: distinctDelays >= 2 ? "" : "Call apply_choreography or stagger_components to spread start times.",
      });
    } else {
      out.push({
        claim: "At least 2 components exist so a stagger can be applied.",
        severity: "required",
        verdict: "skip",
        evidence: `Only ${comps.length} component(s) present — stagger is not applicable yet.`,
        remediation: "Add another component before staggering.",
      });
    }
  }

  // --- Color / visual style. ---
  if (/\b(color|colour|red|blue|green|purple|yellow|background)\b/.test(text)) {
    const colored = comps.filter((c) => {
      const s = c.style ?? {};
      return typeof s.color === "string" || typeof s.background === "string" || typeof s.backgroundColor === "string";
    }).length;
    out.push({
      claim: "At least one component carries an explicit color or background.",
      severity: "required",
      verdict: colored > 0 ? "pass" : "fail",
      evidence: colored > 0 ? `${colored} component(s) carry a color or background.` : "No explicit color or background is set on any component.",
      remediation: colored > 0 ? "" : "Call set_color or set_static_style to set a color/background.",
    });
  }

  // --- 3D transforms. ---
  if (/\b(3d|perspective|rotateX|rotateY|tilt|flip in 3d)\b/.test(text)) {
    const has3d = comps.some((c) => hasStyleKey(c, /perspective|rotateX|rotateY|translateZ/i));
    out.push({
      claim: "At least one component has a 3D transform property set.",
      severity: "required",
      verdict: has3d ? "pass" : "fail",
      evidence: has3d ? "A 3D transform property is present." : "No 3D transform property is set on any component.",
      remediation: has3d ? "" : "Call set_3d_transform with perspective and rotateX/rotateY.",
    });
  }

  // --- Creation: a new component should exist when the user asked to add one. ---
  if (/\b(create|add|make|build|generate|insert)\b/.test(text) && /\b(component|layer|element|animation|shape|image|video|text)\b/.test(text)) {
    out.push({
      claim: "At least one component exists in the project.",
      severity: "required",
      verdict: comps.length > 0 ? "pass" : "fail",
      evidence: comps.length > 0 ? `${comps.length} component(s) present.` : "The project is empty — no component was created.",
      remediation: comps.length > 0 ? "" : "Call add_layer, set_template, or add_shape to create a component.",
    });
  }

  // --- Shader / WebGL effects. ---
  if (/\b(shader|glitch|neon|plasma|chromatic|vignette|aurora|vortex|warp|swirl|perlin|simplex|voronoi|metaballs|halftone|dithering|pixelate)\b/.test(text)) {
    const hasShader = comps.some((c) => hasStyleKey(c, /shader|filter/i) || (c.templateId ?? "").startsWith("tpl-shader"));
    out.push({
      claim: "At least one component has a shader effect applied.",
      severity: "required",
      verdict: hasShader ? "pass" : "fail",
      evidence: hasShader ? "A shader/filter property is present." : "No shader effect is applied.",
      remediation: hasShader ? "" : "Call set_shader_effect with the requested effect name.",
    });
  }

  // --- Motion path / trajectory. ---
  if (/\b(orbit|circle|ellipse|along.*path|trajectory|fly across|move in a|motion.*path)\b/.test(text)) {
    const hasPath = comps.some((c) => {
      const props = animatedProperties(c);
      return props.has("translateX") && props.has("translateY") && c.keyframes.length >= 3;
    });
    out.push({
      claim: "At least one component animates translateX+translateY across multiple keyframes (a path).",
      severity: "required",
      verdict: hasPath ? "pass" : "fail",
      evidence: hasPath ? "A multi-keyframe translateX/translateY track is present." : "No motion-path track is present.",
      remediation: hasPath ? "" : "Call set_motion_path to generate a path animation.",
    });
  }

  // --- Trigger configuration. ---
  if (/\b(on.*click|on.*hover|on.*scroll|trigger|playback.*trigger)\b/.test(text)) {
    let expectedTrigger: "onClick" | "onHover" | "onScroll" | null = null;
    if (/\bclick\b/.test(text)) expectedTrigger = "onClick";
    else if (/\bhover\b/.test(text)) expectedTrigger = "onHover";
    else if (/\bscroll\b/.test(text)) expectedTrigger = "onScroll";
    if (expectedTrigger) {
      const matches = comps.filter((c) => c.trigger === expectedTrigger).length;
      out.push({
        claim: `At least one component trigger is set to ${expectedTrigger}.`,
        severity: "required",
        verdict: matches > 0 ? "pass" : "fail",
        evidence: matches > 0 ? `${matches} component(s) use trigger ${expectedTrigger}.` : `No component uses trigger ${expectedTrigger}.`,
        remediation: matches > 0 ? "" : `Call set_trigger with trigger ${expectedTrigger}.`,
      });
    }
  }

  // --- Advisory: restraint health checks that don't gate "achieved". ---
  const infiniteLoops = countInfiniteLoops(spec);
  if (infiniteLoops >= 4) {
    out.push({
      claim: "Fewer than 4 components loop infinitely (restraint budget).",
      severity: "advisory",
      verdict: "fail",
      evidence: `${infiniteLoops} components loop infinitely — risk of visual overload.`,
      remediation: "Reduce the number of infinite loops to keep the scene calm.",
    });
  }
  if (comps.length > 12) {
    out.push({
      claim: "Scene density stays at or below 12 components.",
      severity: "advisory",
      verdict: "fail",
      evidence: `${comps.length} components present — dense scenes risk visual overload.`,
      remediation: "Consider removing or consolidating components before adding more.",
    });
  }

  return out;
}

/**
 * Evaluate the user's request against the resulting spec. Returns a structured
 * report with one assertion per detected intent, plus an overall achieved
 * verdict. Call this after a spec-changing turn to produce verifiable evidence
 * the agent can act on (and the user can inspect).
 */
export function verifyMotion(
  userMessage: string,
  spec: MotionSpec,
): VerificationReport {
  const intent = summarizeIntent(userMessage);
  const assertions = compileAssertions(userMessage, spec);

  const required = assertions.filter((a) => a.severity === "required" && a.verdict !== "skip");
  const requiredPassed = required.filter((a) => a.verdict === "pass").length;
  const achievedRatio = required.length > 0 ? requiredPassed / required.length : 1;
  const achieved = required.length > 0 && required.every((a) => a.verdict === "pass");

  const failedRemediations = assertions
    .filter((a) => a.verdict === "fail" && a.remediation.length > 0)
    .map((a) => a.remediation);
  const summary = failedRemediations.length === 0
    ? ""
    : `${failedRemediations.length} gap(s) remain: ${failedRemediations.join(" ")}`;

  return { intent, assertions, achievedRatio, achieved, summary };
}

function summarizeIntent(userMessage: string): string {
  const clipped = userMessage.trim().slice(0, 160);
  return clipped.length < userMessage.trim().length ? `${clipped}…` : clipped;
}

/** Format a verification report as a compact human-readable string. */
export function formatVerificationReport(report: VerificationReport): string {
  const lines: string[] = [];
  lines.push(`Verification (intent: "${report.intent}")`);
  if (report.assertions.length === 0) {
    lines.push("No structured assertions applied to this request.");
    return lines.join("\n");
  }
  for (const a of report.assertions) {
    const mark = a.verdict === "pass" ? "[+]" : a.verdict === "fail" ? "[x]" : "[?]";
    lines.push(`${mark} ${a.claim} — ${a.evidence}`);
  }
  const pct = Math.round(report.achievedRatio * 100);
  lines.push(`Achieved: ${report.achieved ? "yes" : "no"} (${pct}% of required assertions pass).`);
  if (report.summary.length > 0) lines.push(report.summary);
  return lines.join("\n");
}
