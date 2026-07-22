/**
 * Motion Coach — generates educational commentary and skill-aware suggestions
 * that teach the user what each animation does and how to make it better.
 *
 * This is the eighth original AI-native module. Where Critique diagnoses
 * structural problems and Auto-Fix remediates them, the Coach explains motion
 * design in plain language: what a component does, why it works (or doesn't),
 * what principle it illustrates, and what the user should try next based on
 * their proficiency level.
 *
 * The Coach produces three kinds of output:
 * 1. Per-component narration — a plain-language description of what each
 *    animation does, suitable for screen readers or onboarding tooltips.
 * 2. Skill-tier suggestions — beginner / intermediate / advanced next steps
 *    calibrated to the user's proficiency, inferred from project complexity.
 * 3. Lesson plan — a sequence of micro-lessons derived from the project's
 *    current state, each anchored to a real component the user can study.
 *
 * The Coach is rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";

/** Proficiency tiers inferred from project complexity. */
export type ProficiencyTier = "beginner" | "intermediate" | "advanced";

/** A plain-language narration of what a component does. */
export interface ComponentNarration {
  componentId: string;
  componentName: string;
  /** One-sentence summary — what the animation does. */
  summary: string;
  /** Two-to-three sentence explanation — how it works, what feeling it creates. */
  explanation: string;
  /** The motion principle this component illustrates (or violates). */
  principle: string;
  /** The skill level required to author this component. */
  skillLevel: ProficiencyTier;
}

/** A skill-tiered suggestion for what the user should try next. */
export interface CoachSuggestion {
  tier: ProficiencyTier;
  title: string;
  description: string;
  /** Component to study, if anchored. */
  anchorComponentId?: string;
  anchorComponentName?: string;
  /** The principle this suggestion teaches. */
  principle: string;
}

/** A micro-lesson anchored to a real component in the project. */
export interface LessonPlanItem {
  title: string;
  concept: string;
  example: string;
  anchorComponentId: string;
  anchorComponentName: string;
  /** What the user should observe or try. */
  exercise: string;
}

/** The full coaching result returned by the Coach. */
export interface CoachResult {
  proficiency: ProficiencyTier;
  proficiencyReason: string;
  narrations: ComponentNarration[];
  suggestions: CoachSuggestion[];
  lessons: LessonPlanItem[];
  summary: string;
}

/** Estimate the user's proficiency from project complexity signals. */
function inferProficiency(spec: MotionSpec): { tier: ProficiencyTier; reason: string } {
  const comps = spec.components;
  if (comps.length === 0) {
    return { tier: "beginner", reason: "Empty project — starting fresh." };
  }

  // Signals for advanced: many components, custom easings, loops, delays, multi-property keyframes.
  let score = 0;
  if (comps.length >= 5) score += 1;
  if (comps.length >= 12) score += 1;
  if (comps.some((c) => c.easing.type === "bezier" || c.easing.type === "spring")) score += 1;
  if (comps.some((c) => c.iterationCount === "infinite")) score += 1;
  if (comps.some((c) => c.delayMs > 0)) score += 1;
  if (comps.some((c) => c.keyframes.length >= 4)) score += 1;
  if (comps.some((c) => c.keyframes.some((kf) => Object.keys(kf.properties).length >= 3))) score += 1;
  if (comps.some((c) => c.direction === "alternate" || c.direction === "alternate-reverse")) score += 1;

  if (score >= 6) {
    return { tier: "advanced", reason: `${score}/8 complexity signals — multi-property keyframes, custom easings, loops, and choreography all in use.` };
  }
  if (score >= 3) {
    return { tier: "intermediate", reason: `${score}/8 complexity signals — comfortable with the basics and starting to compose.` };
  }
  return { tier: "beginner", reason: `${score}/8 complexity signals — focused on essentials.` };
}

/** Describe an easing in plain language. */
function describeEasing(easing: Easing): { name: string; feel: string; principle: string } {
  if (easing.type === "preset") {
    const map: Record<string, { feel: string; principle: string }> = {
      linear: { feel: "constant speed — mechanical, no acceleration", principle: "Linear motion feels artificial; reserve it for progress bars and mechanical objects." },
      ease: { feel: "gentle ease in and out", principle: "Default ease feels friendly but can be generic." },
      "ease-in": { feel: "starts slow, accelerates outward", principle: "Ease-in builds anticipation — good for exits and dismissals." },
      "ease-out": { feel: "starts fast, decelerates to rest", principle: "Ease-out feels responsive — perfect for entrances." },
      "ease-in-out": { feel: "slow at both ends, fast in the middle", principle: "Symmetric easing reads as deliberate and ceremonial." },
      "ease-in-quad": { feel: "soft acceleration in", principle: "Quad easing is a subtler version of ease-in." },
      "ease-out-quad": { feel: "soft deceleration out", principle: "Quad easing is a subtler version of ease-out." },
      "ease-in-out-quad": { feel: "subtle slow-fast-slow", principle: "Quad in-out is restrained and professional." },
      "ease-in-cubic": { feel: "stronger acceleration in", principle: "Cubic easing sharpens the anticipation." },
      "ease-out-cubic": { feel: "stronger deceleration out", principle: "Cubic ease-out feels snappy and confident." },
      "ease-in-out-cubic": { feel: "pronounced slow-fast-slow", principle: "Cubic in-out adds drama to ceremonial transitions." },
      bounce: { feel: "bounces on landing", principle: "Bounce conveys weight and playfulness — use sparingly or it becomes a gimmick." },
      back: { feel: "overshoots then settles", principle: "Back easing adds energy to entrances." },
      elastic: { feel: "oscillates like a spring", principle: "Elastic is exuberant — reserve for celebratory moments." },
      snappy: { feel: "quick and crisp", principle: "Snappy timing communicates responsiveness." },
      smooth: { feel: "fluid and polished", principle: "Smooth easing reads as premium and refined." },
      soft: { feel: "gentle and quiet", principle: "Soft easing fades changes into the background." },
    };
    const entry = map[easing.name] ?? { feel: "custom preset", principle: "Custom easing curve." };
    return { name: easing.name, ...entry };
  }
  if (easing.type === "spring") {
    return {
      name: "spring",
      feel: `physics-based spring (stiffness ${easing.stiffness}, damping ${easing.damping})`,
      principle: "Springs model real-world physics — they feel natural because they respect mass and friction.",
    };
  }
  if (easing.type === "bezier") {
    return {
      name: "bezier",
      feel: `custom bezier curve (${easing.p1[0]},${easing.p1[1]}) → (${easing.p2[0]},${easing.p2[1]})`,
      principle: "Custom bezier curves give precise control over acceleration and deceleration.",
    };
  }
  return { name: "unknown", feel: "unknown easing", principle: "" };
}

/** Describe what a component animates, in plain language. */
function describeAnimatedProperties(comp: MotionComponent): { summary: string; skillLevel: ProficiencyTier } {
  const props = new Set<string>();
  for (const kf of comp.keyframes) {
    for (const key of Object.keys(kf.properties)) props.add(key);
  }
  if (props.size === 0) {
    return { summary: "is currently static with no keyframes", skillLevel: "beginner" };
  }
  const list = Array.from(props).join(", ");
  const propCount = props.size;
  const kfCount = comp.keyframes.length;

  let skillLevel: ProficiencyTier = "beginner";
  if (propCount >= 3 || kfCount >= 4) skillLevel = "intermediate";
  if (propCount >= 4 || kfCount >= 6) skillLevel = "advanced";

  return { summary: `animates ${list} across ${kfCount} keyframe(s)`, skillLevel };
}

/** Identify the motion principle a component most illustrates. */
function identifyPrinciple(comp: MotionComponent, desc: { summary: string }): string {
  if (comp.iterationCount === "infinite") {
    return "Rhythm — infinite loops create ongoing visual pulse.";
  }
  if (comp.delayMs > 0 && comp.delayMs < 400) {
    return "Staging — short delays build anticipation.";
  }
  if (comp.durationMs > 1000) {
    return "Slow in / slow out — long durations feel deliberate and ceremonial.";
  }
  if (comp.durationMs < 250) {
    return "Snappiness — fast durations communicate responsiveness.";
  }
  if (desc.summary.includes("opacity")) {
    return "Solid drawing — opacity changes reveal or conceal depth.";
  }
  if (desc.summary.includes("scale")) {
    return "Squash and stretch — scale changes convey weight and volume.";
  }
  if (desc.summary.includes("translateX") || desc.summary.includes("translateY")) {
    return "Arcs — translation suggests physical movement through space.";
  }
  if (desc.summary.includes("rotate")) {
    return "Secondary action — rotation adds life to a primary movement.";
  }
  return "Appeal — every animation should have a clear, readable silhouette.";
}

/** Narrate a single component. */
function narrateComponent(comp: MotionComponent): ComponentNarration {
  const desc = describeAnimatedProperties(comp);
  const easingInfo = describeEasing(comp.easing);
  const principle = identifyPrinciple(comp, desc);

  const durSec = (comp.durationMs / 1000).toFixed(comp.durationMs % 1000 === 0 ? 0 : 1);
  const loopPart = comp.iterationCount === "infinite"
    ? "looping forever"
    : typeof comp.iterationCount === "number" && comp.iterationCount > 1
      ? `repeating ${comp.iterationCount} times`
      : "playing once";
  const delayPart = comp.delayMs > 0 ? ` after a ${comp.delayMs}ms delay` : "";

  const summary = `"${comp.name}" ${desc.summary} over ${durSec}s with ${easingInfo.name} easing, ${loopPart}${delayPart}.`;
  const explanation = `This component ${desc.summary}. The ${easingInfo.name} easing ${easingInfo.feel}, which ${easingInfo.principle} The animation is ${durSec}s long and ${loopPart}${delayPart}.`;

  return {
    componentId: comp.id,
    componentName: comp.name,
    summary,
    explanation,
    principle,
    skillLevel: desc.skillLevel,
  };
}

/** Generate skill-tiered suggestions for the project. */
function generateSuggestions(spec: MotionSpec, proficiency: ProficiencyTier): CoachSuggestion[] {
  const suggestions: CoachSuggestion[] = [];
  const comps = spec.components;

  // Beginner suggestions.
  if (comps.length === 0) {
    suggestions.push({
      tier: "beginner",
      title: "Start with a fade-in",
      description: "Create a single component that fades in over 600ms. This is the simplest possible motion and teaches the relationship between duration, easing, and feel.",
      principle: "Slow in / slow out — every animation benefits from acceleration and deceleration.",
    });
    suggestions.push({
      tier: "beginner",
      title: "Try two easings side by side",
      description: "Duplicate your fade-in and change the easing on the copy from 'linear' to 'smooth'. Compare how they feel — smooth easing reads as polished, linear as mechanical.",
      principle: "Easing choice changes emotional tone more than the property being animated.",
    });
  } else {
    const hasSimpleOpacity = comps.some((c) => c.keyframes.length === 2 && c.keyframes.some((k) => k.properties.opacity !== undefined));
    if (!hasSimpleOpacity) {
      suggestions.push({
        tier: "beginner",
        title: "Add a simple fade-in",
        description: "Your project has motion, but no pure fade-in. Try animating opacity from 0 to 1 over 600ms with smooth easing — it's the cleanest entrance.",
        principle: "Fades are the most readable entrance — they work even when other properties fail.",
      });
    }
    const allLinear = comps.every((c) => c.easing.type === "preset" && c.easing.name === "linear");
    if (allLinear && comps.length > 0) {
      suggestions.push({
        tier: "beginner",
        title: "Replace linear easing with smooth",
        description: "Every component uses linear easing, which feels mechanical. Switch to 'smooth' on at least one component and notice how the motion becomes more natural.",
        principle: "Linear motion is for progress bars and mechanical objects — almost nothing else.",
      });
    }
  }

  // Intermediate suggestions.
  if (comps.length >= 2) {
    const allSameDelay = comps.every((c) => c.delayMs === comps[0].delayMs);
    if (allSameDelay) {
      suggestions.push({
        tier: "intermediate",
        title: "Stagger the entrances",
        description: `All ${comps.length} components start at the same time. Try staggering delays by 80-120ms so they enter in sequence — this creates rhythm and guides the eye.`,
        principle: "Stagger transforms a chaotic burst into a readable sequence.",
        anchorComponentId: comps[0].id,
        anchorComponentName: comps[0].name,
      });
    }
    const hasLoop = comps.some((c) => c.iterationCount === "infinite");
    if (!hasLoop) {
      suggestions.push({
        tier: "intermediate",
        title: "Add an ambient loop",
        description: "Pick one supporting element and set it to loop infinitely (e.g., a subtle scale pulse 1.0 → 1.05 → 1.0). Ambient loops keep the scene feeling alive.",
        principle: "Infinite loops create ambient life without demanding attention.",
      });
    }
    const hasSpring = comps.some((c) => c.easing.type === "spring");
    if (!hasSpring) {
      suggestions.push({
        tier: "intermediate",
        title: "Try a spring easing",
        description: "All easings are preset curves. Try switching one component's easing to a spring (stiffness 200, damping 20) — physics-based motion feels more natural than curves.",
        principle: "Springs model real-world physics and feel grounded because they respect mass.",
      });
    }
  }

  // Advanced suggestions.
  if (comps.length >= 5 && proficiency !== "beginner") {
    const hasMultiPropertyKf = comps.some((c) => c.keyframes.some((k) => Object.keys(k.properties).length >= 3));
    if (!hasMultiPropertyKf) {
      suggestions.push({
        tier: "advanced",
        title: "Compose multi-property keyframes",
        description: "No keyframe animates more than 2 properties at once. Try a keyframe that combines opacity, scale, and translateY — coordinated changes feel richer than separate ones.",
        principle: "Coordinated multi-property motion creates a unified gesture rather than separate animations.",
      });
    }
    const hasAlternate = comps.some((c) => c.direction === "alternate" || c.direction === "alternate-reverse");
    if (!hasAlternate) {
      suggestions.push({
        tier: "advanced",
        title: "Use alternate direction for ping-pong",
        description: "All animations play forward only. Setting direction to 'alternate' on a loop creates a ping-pong effect — useful for breathing pulses and back-and-forth reveals.",
        principle: "Alternate direction eliminates the visible 'jump' at loop boundaries.",
      });
    }
  }

  return suggestions;
}

/** Build a lesson plan anchored to real components. */
function buildLessonPlan(spec: MotionSpec, narrations: ComponentNarration[]): LessonPlanItem[] {
  const lessons: LessonPlanItem[] = [];
  const byId = new Map(narrations.map((n) => [n.componentId, n]));

  // Lesson 1: Find a component that illustrates staging (delays).
  const stagingComp = spec.components.find((c) => c.delayMs > 0);
  if (stagingComp && byId.has(stagingComp.id)) {
    lessons.push({
      title: "Anticipation through delay",
      concept: "A short delay before an animation begins creates anticipation — the viewer knows something is about to happen.",
      example: `"${stagingComp.name}" waits ${stagingComp.delayMs}ms before starting, which draws attention without motion.`,
      anchorComponentId: stagingComp.id,
      anchorComponentName: stagingComp.name,
      exercise: "Try changing the delay to 0ms and then to 400ms. Notice how 0ms feels abrupt and 400ms feels sluggish — the sweet spot is usually 80-200ms.",
    });
  }

  // Lesson 2: Find a component that illustrates slow-in/slow-out.
  const slowComp = spec.components.find((c) => c.easing.type === "preset" && ["smooth", "ease-in-out", "soft"].includes(c.easing.name));
  if (slowComp && byId.has(slowComp.id)) {
    lessons.push({
      title: "Slow in / slow out",
      concept: "Real-world objects don't start or stop instantly — they accelerate and decelerate. Easings like 'smooth' mimic this physics.",
      example: `"${slowComp.name}" uses ${slowComp.easing.type === "preset" ? slowComp.easing.name : "custom"} easing, which decelerates into its final position.`,
      anchorComponentId: slowComp.id,
      anchorComponentName: slowComp.name,
      exercise: "Switch this component's easing to 'linear' and replay. The motion should feel noticeably more mechanical and less natural.",
    });
  }

  // Lesson 3: Find a component illustrating rhythm (loops).
  const loopComp = spec.components.find((c) => c.iterationCount === "infinite");
  if (loopComp && byId.has(loopComp.id)) {
    lessons.push({
      title: "Rhythm through looping",
      concept: "An infinite loop creates ongoing pulse — the scene never feels static. Loop duration controls the perceived heartbeat of the design.",
      example: `"${loopComp.name}" loops forever, taking ${loopComp.durationMs}ms per cycle.`,
      anchorComponentId: loopComp.id,
      anchorComponentName: loopComp.name,
      exercise: `Try changing the duration to ${Math.round(loopComp.durationMs / 2)}ms (faster) and then ${loopComp.durationMs * 2}ms (slower). Faster loops feel urgent; slower loops feel meditative.`,
    });
  }

  // Lesson 4: Find a component illustrating secondary action (rotation on top of translation).
  const secondaryComp = spec.components.find((c) => {
    const props = new Set<string>();
    for (const kf of c.keyframes) for (const k of Object.keys(kf.properties)) props.add(k);
    return props.has("rotate") && (props.has("translateX") || props.has("translateY"));
  });
  if (secondaryComp && byId.has(secondaryComp.id)) {
    lessons.push({
      title: "Secondary action",
      concept: "When a primary motion (like translation) is paired with a secondary motion (like rotation), the result feels more alive than either alone.",
      example: `"${secondaryComp.name}" combines translation with rotation — the rotation is secondary, adding spin to the slide.`,
      anchorComponentId: secondaryComp.id,
      anchorComponentName: secondaryComp.name,
      exercise: "Remove the rotation from this component's keyframes and replay. The motion should feel flatter and less interesting.",
    });
  }

  // Lesson 5: Find a component illustrating staging via opacity.
  const opacityComp = spec.components.find((c) => c.keyframes.some((k) => k.properties.opacity !== undefined));
  if (opacityComp && byId.has(opacityComp.id) && opacityComp.id !== stagingComp?.id) {
    lessons.push({
      title: "Solid drawing via opacity",
      concept: "Opacity changes reveal or conceal depth — a fade-in suggests something emerging from nothing, a fade-out suggests it receding.",
      example: `"${opacityComp.name}" animates opacity, which creates a sense of emergence or withdrawal.`,
      anchorComponentId: opacityComp.id,
      anchorComponentName: opacityComp.name,
      exercise: "Set this component's opacity keyframes to start at 1 instead of 0. The entrance should feel less dramatic — fades carry meaning that pure movement cannot.",
    });
  }

  return lessons;
}

/** Run the coaching pass on a project spec. */
export function coachMotion(spec: MotionSpec): CoachResult {
  const { tier, reason } = inferProficiency(spec);
  const narrations = spec.components.map(narrateComponent);
  const suggestions = generateSuggestions(spec, tier);
  const lessons = buildLessonPlan(spec, narrations);

  const summary = `Project coached at ${tier} level. ${narrations.length} component(s) narrated, ${suggestions.length} suggestion(s), ${lessons.length} lesson(s). ${reason}`;

  return {
    proficiency: tier,
    proficiencyReason: reason,
    narrations,
    suggestions,
    lessons,
    summary,
  };
}

/** Format a coach result as a human-readable report. */
export function formatCoachReport(result: CoachResult): string {
  const lines: string[] = [];
  lines.push("=== Motion Coach ===");
  lines.push("");
  lines.push(`Proficiency: ${result.proficiency}`);
  lines.push(`Reason: ${result.proficiencyReason}`);
  lines.push("");

  if (result.narrations.length > 0) {
    lines.push("--- Component Narrations ---");
    for (const n of result.narrations) {
      lines.push(`[${n.componentName}] (${n.skillLevel})`);
      lines.push(`  ${n.summary}`);
      lines.push(`  principle: ${n.principle}`);
    }
    lines.push("");
  }

  if (result.suggestions.length > 0) {
    lines.push("--- Suggestions ---");
    for (const s of result.suggestions) {
      lines.push(`(${s.tier}) ${s.title}`);
      lines.push(`  ${s.description}`);
      if (s.anchorComponentName) lines.push(`  anchored to: ${s.anchorComponentName}`);
      lines.push(`  principle: ${s.principle}`);
    }
    lines.push("");
  }

  if (result.lessons.length > 0) {
    lines.push("--- Lesson Plan ---");
    for (const lesson of result.lessons) {
      lines.push(`• ${lesson.title}`);
      lines.push(`  concept: ${lesson.concept}`);
      lines.push(`  example: ${lesson.example}`);
      lines.push(`  exercise: ${lesson.exercise}`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${result.summary}`);
  return lines.join("\n");
}
