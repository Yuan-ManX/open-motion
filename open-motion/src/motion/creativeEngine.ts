import type { MotionSpec } from "@openmotion/shared";
import { analyzeMood } from "./moodEngine.js";
import { analyzeMotion } from "./analysis.js";
import { analyzeRestraint } from "./restraint.js";

/**
 * Creative Suggestion Engine — generates context-aware, creative next-step
 * ideas that go beyond simple technical suggestions. Includes a "surprise me"
 * mode that proposes unexpected but aesthetically valid combinations, style
 * transfer recommendations, and trend-aware ideas based on project state.
 */

export type SuggestionCategory =
  | "composition"
  | "timing"
  | "mood"
  | "pattern"
  | "interaction"
  | "surprise"
  | "refinement"
  | "accessibility";

export interface CreativeSuggestion {
  id: string;
  category: SuggestionCategory;
  title: string;
  description: string;
  rationale: string;
  tools: string[];
  priority: "high" | "medium" | "low";
  noveltyScore: number;
}

export interface CreativeResult {
  suggestions: CreativeSuggestion[];
  projectFingerprint: string;
  diversityIndex: number;
}

/** Compute a compact fingerprint of the project for comparison. */
function projectFingerprint(spec: MotionSpec): string {
  const moods = spec.components.map((c) => c.easing.type).join(",");
  const props = new Set<string>();
  for (const c of spec.components) {
    for (const kf of c.keyframes) {
      for (const key of Object.keys(kf.properties)) props.add(key);
    }
  }
  return `${spec.components.length}c:${moods}:${Array.from(props).sort().join("+")}`;
}

/** Compute diversity index (0-1) based on property, easing, and duration variety. */
function diversityIndex(spec: MotionSpec): number {
  if (spec.components.length <= 1) return 0;
  const easings = new Set(spec.components.map((c) => c.easing.type));
  const durations = new Set(spec.components.map((c) => Math.round(c.durationMs / 100)));
  const allProps = new Set<string>();
  for (const c of spec.components) {
    for (const kf of c.keyframes) {
      for (const key of Object.keys(kf.properties)) allProps.add(key);
    }
  }
  const easingDiv = easings.size / spec.components.length;
  const durDiv = durations.size / spec.components.length;
  const propDiv = Math.min(allProps.size / 4, 1);
  return Math.round(((easingDiv + durDiv + propDiv) / 3) * 100) / 100;
}

/** Generate creative suggestions based on project state. */
export function suggestCreative(spec: MotionSpec, options?: { surprise?: boolean }): CreativeResult {
  const suggestions: CreativeSuggestion[] = [];
  const surprise = options?.surprise ?? false;
  const compCount = spec.components.length;

  if (compCount === 0) {
    suggestions.push({
      id: "start-fade",
      category: "composition",
      title: "Start with a fade-in entrance",
      description: "Create a component with a smooth fade-in to establish the scene.",
      rationale: "An empty canvas benefits from a simple, elegant entrance to set the tone.",
      tools: ["add_layer", "set_template"],
      priority: "high",
      noveltyScore: 0.1,
    });
    return { suggestions, projectFingerprint: projectFingerprint(spec), diversityIndex: 0 };
  }

  const moodAnalysis = analyzeMood(spec);
  const qualityAnalysis = analyzeMotion(spec);
  const restraint = analyzeRestraint(spec);
  const diversity = diversityIndex(spec);

  // Mood-based suggestions
  if (moodAnalysis.dominantMood === "minimal" && compCount >= 2) {
    suggestions.push({
      id: "mood-contrast",
      category: "mood",
      title: `Add a ${moodAnalysis.dominantMood === "minimal" ? "playful" : "calm"} contrast element`,
      description: `The project feels ${moodAnalysis.dominantMood}. Introducing a contrasting mood would create visual interest.`,
      rationale: `Current mood: ${moodAnalysis.dominantMood} (${Math.round((moodAnalysis.moodScores[moodAnalysis.dominantMood] ?? 0) * 100)}%). Contrast prevents monotony.`,
      tools: ["add_layer", "set_mood"],
      priority: "medium",
      noveltyScore: 0.6,
    });
  }

  if (moodAnalysis.energy < 0.3 && compCount >= 3) {
    suggestions.push({
      id: "energy-boost",
      category: "mood",
      title: "Introduce an energetic accent animation",
      description: "Add a fast, snappy element to break the low-energy uniformity.",
      rationale: `Energy level is ${moodAnalysis.energy}. A single high-energy accent creates a focal point without overwhelming.`,
      tools: ["add_shape", "set_easing", "set_duration"],
      priority: "medium",
      noveltyScore: 0.5,
    });
  }

  // Timing and rhythm suggestions
  if (moodAnalysis.rhythm === "steady" && compCount >= 3) {
    suggestions.push({
      id: "rhythm-break",
      category: "timing",
      title: "Break the steady rhythm with a choreographed pattern",
      description: "Apply a wave or ripple choreography to create organic visual rhythm.",
      rationale: `Rhythm is ${moodAnalysis.rhythm}. Introducing variation prevents the composition from feeling mechanical.`,
      tools: ["choreograph"],
      priority: "high",
      noveltyScore: 0.7,
    });
  }

  if (moodAnalysis.rhythm === "irregular") {
    suggestions.push({
      id: "rhythm-unify",
      category: "timing",
      title: "Unify the rhythm with staggered delays",
      description: "Apply consistent staggered delays to create a deliberate sequence.",
      rationale: `Rhythm is ${moodAnalysis.rhythm}. Staggering creates intentionality and flow.`,
      tools: ["stagger_components"],
      priority: "high",
      noveltyScore: 0.4,
    });
  }

  // Composition suggestions
  if (compCount >= 3 && diversity < 0.4) {
    suggestions.push({
      id: "diversity-up",
      category: "composition",
      title: "Diversify animated properties",
      description: "The project uses similar properties across all components. Try animating different properties (scale, rotate, opacity) for visual variety.",
      rationale: `Diversity index: ${diversity}. Low diversity leads to a monotonous feel.`,
      tools: ["set_transform", "add_property_keyframe"],
      priority: "medium",
      noveltyScore: 0.5,
    });
  }

  // Restraint-based suggestions
  if (restraint.score < 40) {
    suggestions.push({
      id: "restraint-reduce",
      category: "refinement",
      title: "Reduce motion density for better restraint",
      description: "Too many animations compete for attention. Consider simplifying or removing some.",
      rationale: `Restraint score: ${restraint.score}/100. High density overwhelms viewers.`,
      tools: ["remove_component", "set_loop", "set_duration"],
      priority: "high",
      noveltyScore: 0.3,
    });
  }

  if (restraint.score > 80 && compCount >= 2) {
    suggestions.push({
      id: "restraint-add",
      category: "composition",
      title: "Add a subtle ambient detail",
      description: "The project is well-restrained. A single subtle ambient animation (gentle float or pulse) would add life without breaking restraint.",
      rationale: `Restraint score: ${restraint.score}/100. There's room for one more tasteful element.`,
      tools: ["apply_preset", "set_duration"],
      priority: "low",
      noveltyScore: 0.6,
    });
  }

  // Quality-based suggestions from analysis insights
  for (const insight of qualityAnalysis.insights) {
    if (insight.severity === "critical" || insight.severity === "warning") {
      suggestions.push({
        id: `quality-${insight.category}`,
        category: "refinement",
        title: `Fix: ${insight.category}`,
        description: insight.message,
        rationale: `Severity: ${insight.severity}. Addressing this improves overall motion quality.`,
        tools: ["set_easing", "set_duration", "set_loop"],
        priority: insight.severity === "critical" ? "high" : "medium",
        noveltyScore: 0.2,
      });
    }
  }

  // Surprise / creative suggestions
  if (surprise || compCount >= 2) {
    const surpriseIdeas = generateSurpriseIdeas(spec, moodAnalysis, diversity);
    suggestions.push(...surpriseIdeas);
  }

  // Interaction suggestions
  if (compCount >= 2 && !spec.components.some((c) => c.trigger !== "onLoad")) {
    suggestions.push({
      id: "interaction-add",
      category: "interaction",
      title: "Add an interactive trigger",
      description: "All animations play on load. Adding onClick or onHover triggers creates engagement.",
      rationale: "Interactive triggers transform passive animations into engaging experiences.",
      tools: ["set_trigger", "add_listener"],
      priority: "medium",
      noveltyScore: 0.7,
    });
  }

  // Accessibility suggestion
  const hasInfiniteLoops = spec.components.some((c) => c.iterationCount === "infinite");
  if (hasInfiniteLoops && compCount >= 3) {
    suggestions.push({
      id: "a11y-loops",
      category: "accessibility",
      title: "Limit infinite loops for accessibility",
      description: "Multiple infinite loops can cause distraction and vestibular issues. Consider limiting to 3-5 iterations.",
      rationale: "WCAG 2.1 guidelines recommend limiting repetitive motion for users with vestibular disorders.",
      tools: ["set_loop"],
      priority: "medium",
      noveltyScore: 0.3,
    });
  }

  // Sort by priority then novelty
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.noveltyScore - a.noveltyScore;
  });

  return {
    suggestions: suggestions.slice(0, surprise ? 8 : 5),
    projectFingerprint: projectFingerprint(spec),
    diversityIndex: diversity,
  };
}

/** Generate unexpected but aesthetically valid creative ideas. */
function generateSurpriseIdeas(
  spec: MotionSpec,
  mood: ReturnType<typeof analyzeMood>,
  diversity: number,
): CreativeSuggestion[] {
  const ideas: CreativeSuggestion[] = [];
  const compCount = spec.components.length;

  const surprises: Array<{
    id: string;
    title: string;
    description: string;
    rationale: string;
    tools: string[];
    novelty: number;
  }> = [
    {
      id: "surprise-shader",
      title: "Add a subtle glitch shader to one element",
      description: "Apply a low-intensity shader-glitch effect to a single component for a modern, digital aesthetic.",
      rationale: "A single shader-accented element creates a striking focal point against smooth motion.",
      tools: ["set_shader_effect"],
      novelty: 0.9,
    },
    {
      id: "surprise-path",
      title: "Send an element along a circular path",
      description: "Animate one component along a circular or elliptical trajectory for orbital movement.",
      rationale: "Path-based motion adds a dynamic dimension that linear transforms cannot achieve.",
      tools: ["set_motion_path"],
      novelty: 0.85,
    },
    {
      id: "surprise-3d",
      title: "Introduce a 3D perspective tilt",
      description: "Add a subtle rotateY or perspective transform to create depth without full 3D.",
      rationale: "Even slight 3D depth creates a premium, layered feel that stands out.",
      tools: ["set_3d_transform"],
      novelty: 0.8,
    },
    {
      id: "surprise-variant",
      title: "Create a variant with opposite easing",
      description: "Duplicate a component and apply the opposite easing family (bounce→smooth or smooth→snappy).",
      rationale: "Side-by-side easing comparison reveals which feels right for the context.",
      tools: ["create_variant"],
      novelty: 0.7,
    },
    {
      id: "surprise-choreograph",
      title: "Apply a ripple choreography from center",
      description: "Trigger a center-out ripple pattern so animations radiate from the middle.",
      rationale: "Ripple patterns feel organic and draw the eye inward then outward.",
      tools: ["choreograph"],
      novelty: 0.75,
    },
    {
      id: "surprise-reverse",
      title: "Reverse keyframes on one component",
      description: "Play one component's animation in reverse for a counterpoint effect.",
      rationale: "Contrasting direction creates tension and visual interest in a uniform composition.",
      tools: ["reverse_keyframes"],
      novelty: 0.65,
    },
  ];

  // Pick 1-2 surprise ideas based on context
  const idx = (compCount + Math.round(mood.energy * 10)) % surprises.length;
  const pick1 = surprises[idx];
  ideas.push({
    id: pick1.id,
    category: "surprise",
    title: pick1.title,
    description: pick1.description,
    rationale: pick1.rationale,
    tools: pick1.tools,
    priority: "low",
    noveltyScore: pick1.novelty,
  });

  if (diversity < 0.5 && compCount >= 2) {
    const idx2 = (idx + 2) % surprises.length;
    const pick2 = surprises[idx2];
    ideas.push({
      id: pick2.id,
      category: "surprise",
      title: pick2.title,
      description: pick2.description,
      rationale: pick2.rationale,
      tools: pick2.tools,
      priority: "low",
      noveltyScore: pick2.novelty,
    });
  }

  return ideas;
}

/**
 * Generate a style transfer recommendation — suggests applying the aesthetic
 * of one component to others for visual coherence.
 */
export function suggestStyleTransfer(spec: MotionSpec): CreativeSuggestion | null {
  if (spec.components.length < 2) return null;

  // Find the component with the richest animation (most keyframes + properties)
  let richest = spec.components[0];
  let richestScore = 0;
  for (const c of spec.components) {
    const props = new Set<string>();
    for (const kf of c.keyframes) {
      for (const key of Object.keys(kf.properties)) props.add(key);
    }
    const score = c.keyframes.length + props.size;
    if (score > richestScore) {
      richestScore = score;
      richest = c;
    }
  }

  if (richestScore <= 1) return null;

  return {
    id: "style-transfer",
    category: "refinement",
    title: `Transfer "${richest.name}"'s style to other components`,
    description: `Apply the easing (${richest.easing.type}) and duration (${richest.durationMs}ms) of "${richest.name}" to other components for visual coherence.`,
    rationale: `"${richest.name}" has the richest animation. Unifying timing creates a cohesive aesthetic.`,
    tools: ["batch_update"],
    priority: "low",
    noveltyScore: 0.55,
  };
}
