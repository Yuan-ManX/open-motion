/**
 * Motion Creative Context — tracks the creative session state to provide
 * context-aware intelligence for the Agent. Maintains a rolling window of
 * creative decisions, detected design patterns, and inferred user intent
 * trajectory so the Agent can anticipate what the user needs next.
 *
 * This is the "creative memory" that gives the Agent a sense of continuity
 * across a design session — knowing what was tried, what was rejected, and
 * where the creative direction is heading.
 */

import type { MotionSpec, MotionComponent, Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single creative decision recorded in the session timeline. */
export interface CreativeDecision {
  /** Timestamp of the decision. */
  timestamp: number;
  /** The tool or action that was performed. */
  action: string;
  /** Component ID affected (if any). */
  componentId?: string;
  /** Short description of what changed. */
  summary: string;
  /** The creative intent inferred from the action. */
  intent: CreativeIntent;
  /** Whether the user explicitly approved or seemed satisfied. */
  approved: boolean;
}

/** High-level creative intents the Agent can detect. */
export type CreativeIntent =
  | "establish_hierarchy"
  | "create_rhythm"
  | "build_tension"
  | "release_tension"
  | "add_personality"
  | "refine_timing"
  | "harmonize_palette"
  | "optimize_attention"
  | "add_interactivity"
  | "prepare_export"
  | "explore_alternatives"
  | "fix_accessibility"
  | "narrative_beat"
  | "brand_alignment"
  | "performance_tuning"
  | "creative_exploration";

/** The creative direction the session is trending toward. */
export interface CreativeDirection {
  /** Primary intent dominating the session. */
  primaryIntent: CreativeIntent;
  /** Secondary intents present. */
  secondaryIntents: CreativeIntent[];
  /** Design maturity 0..1 — how close to "finished". */
  maturity: number;
  /** Creative confidence 0..1 — how decisive the user is. */
  confidence: number;
  /** Detected design style. */
  style: DetectedStyle;
  /** Session velocity — actions per minute. */
  velocity: number;
  /** Recommended next actions. */
  recommendations: ContextRecommendation[];
}

/** Design styles the engine can detect from component properties. */
export type DetectedStyle =
  | "minimal"
  | "playful"
  | "corporate"
  | "cinematic"
  | "brutalist"
  | "organic"
  | "futuristic"
  | "retro"
  | "elegant"
  | "experimental"
  | "undetermined";

/** A context-aware recommendation. */
export interface ContextRecommendation {
  /** The action to recommend. */
  action: string;
  /** Why this is recommended given the current context. */
  reason: string;
  /** Tool name to execute. */
  tool: string;
  /** Suggested prompt. */
  prompt: string;
  /** Priority 0..1. */
  priority: number;
}

/** Complete creative context report. */
export interface CreativeContextReport {
  decisions: CreativeDecision[];
  direction: CreativeDirection;
  /** Design patterns detected in the current spec. */
  patterns: DesignPattern[];
  /** Session statistics. */
  stats: SessionStats;
  /** Summary text for display. */
  summary: string;
  timestamp: number;
}

/** A design pattern detected in the motion spec. */
export interface DesignPattern {
  name: string;
  description: string;
  confidence: number;
  components: string[];
}

/** Session statistics. */
export interface SessionStats {
  totalActions: number;
  uniqueComponentsTouched: number;
  averageActionsPerComponent: number;
  timeSpentMs: number;
  intentDistribution: Record<string, number>;
  mostUsedTools: Array<{ tool: string; count: number }>;
  experimentationRate: number;
}

// ---------------------------------------------------------------------------
// Session state (in-memory, per project)
// ---------------------------------------------------------------------------

const sessionState = new Map<string, {
  decisions: CreativeDecision[];
  startTime: number;
  lastActionTime: number;
}>();

/** Record a creative decision in the session timeline. */
export function recordDecision(
  projectId: string,
  action: string,
  summary: string,
  intent: CreativeIntent,
  componentId?: string,
  approved = false,
): void {
  let state = sessionState.get(projectId);
  if (!state) {
    state = { decisions: [], startTime: Date.now(), lastActionTime: Date.now() };
    sessionState.set(projectId, state);
  }
  state.decisions.push({
    timestamp: Date.now(),
    action,
    componentId,
    summary,
    intent,
    approved,
  });
  state.lastActionTime = Date.now();

  // Keep only the last 100 decisions
  if (state.decisions.length > 100) {
    state.decisions = state.decisions.slice(-100);
  }
}

/** Infer creative intent from a tool name and its context. */
export function inferCreativeIntent(
  tool: string,
  args: Record<string, unknown>,
  spec: MotionSpec,
): CreativeIntent {
  const componentCount = spec.components.length;

  // Tool-to-intent mapping
  const toolIntentMap: Record<string, CreativeIntent> = {
    add_layer: componentCount === 0 ? "establish_hierarchy" : "creative_exploration",
    add_shape: "add_personality",
    set_easing: "refine_timing",
    set_spring: "refine_timing",
    set_duration: "refine_timing",
    set_delay: "create_rhythm",
    set_custom_bezier: "refine_timing",
    apply_preset: "add_personality",
    apply_style: "brand_alignment",
    apply_choreography: "create_rhythm",
    stagger_components: "create_rhythm",
    choreograph: "create_rhythm",
    harmonize_colors: "harmonize_palette",
    set_color: "harmonize_palette",
    set_blend_mode: "creative_exploration",
    set_motion_path: "add_personality",
    set_trigger: "add_interactivity",
    add_listener: "add_interactivity",
    capture_state: "add_interactivity",
    add_scene_transition: "narrative_beat",
    add_camera_move: "narrative_beat",
    check_accessibility: "fix_accessibility",
    analyze_motion: "optimize_attention",
    recognize_pattern: "optimize_attention",
    apply_brand_pack: "brand_alignment",
    refine_motion: "refine_timing",
    create_variant: "explore_alternatives",
    find_similar_motion: "explore_alternatives",
    match_template: "creative_exploration",
    set_template: "creative_exploration",
    export_html: "prepare_export",
    export_video: "prepare_export",
    export_code: "prepare_export",
    export_lottie: "prepare_export",
    set_project_tempo: "create_rhythm",
    quantize_to_tempo: "create_rhythm",
    align_to_beat: "create_rhythm",
    set_phase: "create_rhythm",
    verify_motion: "optimize_attention",
    self_correct: "fix_accessibility",
    critique_motion: "optimize_attention",
    generate_variations: "explore_alternatives",
    transfer_style: "brand_alignment",
    apply_recipe: "brand_alignment",
    set_artboard: "establish_hierarchy",
    set_parent: "establish_hierarchy",
    compose_sequence: "create_rhythm",
  };

  return toolIntentMap[tool] ?? "creative_exploration";
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/** Analyze the current creative context for a project. */
export function analyzeCreativeContext(projectId: string, spec: MotionSpec): CreativeContextReport {
  const state = sessionState.get(projectId);
  const decisions = state?.decisions ?? [];
  const startTime = state?.startTime ?? Date.now();

  const direction = detectCreativeDirection(decisions, spec);
  const patterns = detectDesignPatterns(spec);
  const stats = computeStats(decisions, spec, startTime);
  const summary = buildSummary(direction, patterns, stats);

  return {
    decisions: decisions.slice(-20),
    direction,
    patterns,
    stats,
    summary,
    timestamp: Date.now(),
  };
}

/** Detect the overall creative direction from the decision history. */
function detectCreativeDirection(
  decisions: CreativeDecision[],
  spec: MotionSpec,
): CreativeDirection {
  // Count intent frequencies
  const intentCounts = new Map<CreativeIntent, number>();
  for (const d of decisions) {
    intentCounts.set(d.intent, (intentCounts.get(d.intent) ?? 0) + 1);
  }

  const sortedIntents = [...intentCounts.entries()].sort((a, b) => b[1] - a[1]);
  const primaryIntent = sortedIntents[0]?.[0] ?? "creative_exploration";
  const secondaryIntents = sortedIntents.slice(1, 4).map((e) => e[0]);

  // Design maturity: based on component count, decision count, and export actions
  const componentCount = spec.components.length;
  const hasExport = decisions.some((d) => d.intent === "prepare_export");
  const hasAccessibility = decisions.some((d) => d.intent === "fix_accessibility");
  const hasRefinement = decisions.some((d) => d.intent === "refine_timing");

  let maturity = 0;
  if (componentCount >= 1) maturity += 0.15;
  if (componentCount >= 3) maturity += 0.15;
  if (componentCount >= 5) maturity += 0.1;
  if (decisions.length >= 5) maturity += 0.15;
  if (decisions.length >= 10) maturity += 0.1;
  if (hasRefinement) maturity += 0.15;
  if (hasAccessibility) maturity += 0.1;
  if (hasExport) maturity += 0.1;
  maturity = Math.min(1, maturity);

  // Creative confidence: based on approval rate and experimentation
  const approved = decisions.filter((d) => d.approved).length;
  const approvalRate = decisions.length > 0 ? approved / decisions.length : 0.5;
  const uniqueTools = new Set(decisions.map((d) => d.action)).size;
  const experimentation = decisions.length > 0 ? uniqueTools / decisions.length : 0;
  const confidence = approvalRate * 0.6 + (1 - experimentation) * 0.4;

  // Style detection
  const style = detectStyle(spec);

  // Session velocity
  const timeSpan = decisions.length > 0
    ? Math.max(1, decisions[decisions.length - 1].timestamp - decisions[0].timestamp)
    : 1;
  const velocity = (decisions.length / timeSpan) * 60000; // actions per minute

  // Recommendations
  const recommendations = generateRecommendations(primaryIntent, maturity, spec, decisions);

  return {
    primaryIntent,
    secondaryIntents,
    maturity,
    confidence,
    style,
    velocity,
    recommendations,
  };
}

/** Detect the design style from component properties. */
function detectStyle(spec: MotionSpec): DetectedStyle {
  const comps = spec.components;
  if (comps.length === 0) return "undetermined";

  const easings = comps.map((c) => c.easing);
  const hasBouncy = easings.some((e) => {
    if (e.type === "preset") return ["bounce", "elastic", "back"].includes(e.name);
    if (e.type === "spring") return true;
    return false;
  });
  const hasSmooth = easings.some((e) => {
    if (e.type === "preset") return ["smooth", "ease-in-out", "soft"].includes(e.name);
    return false;
  });

  const avgDuration = comps.reduce((s, c) => s + c.durationMs, 0) / comps.length;
  const hasLongDuration = avgDuration > 1500;
  const hasShortDuration = avgDuration < 500;

  const colors = comps.map((c) => {
    const s = c.style as Record<string, string | number>;
    return String(s.background ?? s.color ?? "");
  });

  const hasDarkPalette = colors.some((c) => {
    const hex = c.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return r + g + b < 200;
    }
    return false;
  });

  const hasGradient = colors.some((c) => c.includes("gradient"));
  const componentCount = comps.length;

  // Style detection heuristics
  if (componentCount <= 2 && hasSmooth && avgDuration > 1000) return "minimal";
  if (hasBouncy && hasGradient && componentCount >= 3) return "playful";
  if (hasSmooth && !hasBouncy && componentCount >= 3 && avgDuration > 800) return "corporate";
  if (hasLongDuration && hasDarkPalette) return "cinematic";
  if (hasShortDuration && componentCount >= 4) return "brutalist";
  if (hasBouncy && hasSmooth) return "organic";
  if (hasGradient && hasDarkPalette) return "futuristic";
  if (hasShortDuration && hasBouncy) return "retro";
  if (hasSmooth && componentCount <= 3 && avgDuration > 1200) return "elegant";
  if (componentCount >= 5) return "experimental";

  return "undetermined";
}

/** Detect design patterns in the current spec. */
function detectDesignPatterns(spec: MotionSpec): DesignPattern[] {
  const patterns: DesignPattern[] = [];
  const comps = spec.components;

  if (comps.length === 0) return patterns;

  // Check for staggered timing pattern
  const delays = comps.map((c) => c.delayMs).sort((a, b) => a - b);
  const isStaggered = delays.length >= 3 && delays.every((d, i) =>
    i === 0 || Math.abs((d - delays[i - 1]) - (delays[1] - delays[0])) < 50
  );
  if (isStaggered) {
    patterns.push({
      name: "Cascading Reveal",
      description: "Components reveal in sequence with consistent timing gaps — creates anticipation and guides attention.",
      confidence: 0.85,
      components: comps.map((c) => c.id),
    });
  }

  // Check for synchronized motion pattern
  const allSameDuration = comps.every((c) => c.durationMs === comps[0].durationMs);
  const allSameDelay = comps.every((c) => c.delayMs === comps[0].delayMs);
  if (allSameDuration && allSameDelay && comps.length >= 2) {
    patterns.push({
      name: "Synchronized Ensemble",
      description: "All components animate in unison — creates impact but may overwhelm the viewer.",
      confidence: 0.9,
      components: comps.map((c) => c.id),
    });
  }

  // Check for infinite loop pattern
  const looping = comps.filter((c) => c.iterationCount === "infinite");
  if (looping.length >= 2) {
    patterns.push({
      name: "Ambient Motion Field",
      description: "Multiple components loop infinitely — creates a living, breathing composition.",
      confidence: 0.8,
      components: looping.map((c) => c.id),
    });
  }

  // Check for single-hero pattern
  if (comps.length === 1) {
    patterns.push({
      name: "Hero Focus",
      description: "A single component commands the full canvas — maximum attention focus.",
      confidence: 0.95,
      components: [comps[0].id],
    });
  }

  // Check for layered depth pattern
  const hasNested = comps.some((c) => c.parentId);
  if (hasNested) {
    const nested = comps.filter((c) => c.parentId);
    patterns.push({
      name: "Layered Hierarchy",
      description: "Parent-child relationships create depth — transforms propagate through the rigging system.",
      confidence: 0.75,
      components: nested.map((c) => c.id),
    });
  }

  // Check for varied easing pattern (good diversity)
  const easingFamilies = new Set(comps.map((c) => {
    if (c.easing.type === "preset") return c.easing.name;
    return c.easing.type;
  }));
  if (easingFamilies.size >= 3 && comps.length >= 3) {
    patterns.push({
      name: "Easing Diversity",
      description: "Multiple easing families create rich, varied motion textures.",
      confidence: 0.7,
      components: comps.map((c) => c.id),
    });
  }

  return patterns;
}

/** Generate context-aware recommendations. */
function generateRecommendations(
  primaryIntent: CreativeIntent,
  maturity: number,
  spec: MotionSpec,
  decisions: CreativeDecision[],
): ContextRecommendation[] {
  const recs: ContextRecommendation[] = [];
  const compCount = spec.components.length;

  // Maturity-based recommendations
  if (maturity < 0.3 && compCount <= 2) {
    recs.push({
      action: "Add more layers to build the scene",
      reason: "The composition is sparse — adding layers will create visual depth.",
      tool: "add_layer",
      prompt: "Add another animated layer to complement the existing ones",
      priority: 0.8,
    });
  }

  if (maturity >= 0.3 && maturity < 0.6 && compCount >= 3) {
    const hasStagger = decisions.some((d) => d.action === "stagger_components" || d.action === "apply_choreography");
    if (!hasStagger) {
      recs.push({
        action: "Choreograph the layers",
        reason: "Multiple components exist but aren't sequenced — choreography will create rhythm.",
        tool: "stagger_components",
        prompt: "Stagger the layers in a cascade pattern",
        priority: 0.75,
      });
    }
  }

  if (maturity >= 0.5) {
    const hasAccessibility = decisions.some((d) => d.intent === "fix_accessibility");
    if (!hasAccessibility) {
      recs.push({
        action: "Check accessibility",
        reason: "The design is maturing — verify it meets accessibility standards before export.",
        tool: "check_accessibility",
        prompt: "Check accessibility of the current motion design",
        priority: 0.7,
      });
    }
  }

  if (maturity >= 0.7) {
    const hasExport = decisions.some((d) => d.intent === "prepare_export");
    if (!hasExport) {
      recs.push({
        action: "Prepare for export",
        reason: "The design is nearly complete — export to your target platform.",
        tool: "export_html",
        prompt: "Export the project as HTML",
        priority: 0.85,
      });
    }
  }

  // Intent-based recommendations
  if (primaryIntent === "creative_exploration" && compCount >= 3) {
    recs.push({
      action: "Apply a choreography pattern",
      reason: "Exploration phase benefits from structured patterns to evaluate directions.",
      tool: "apply_choreography",
      prompt: "Apply a ripple choreography pattern across all layers",
      priority: 0.6,
    });
  }

  if (primaryIntent === "refine_timing" && compCount >= 2) {
    recs.push({
      action: "Analyze motion quality",
      reason: "After timing refinements, a quality analysis can surface remaining issues.",
      tool: "analyze_motion",
      prompt: "Analyze the current motion for quality issues",
      priority: 0.65,
    });
  }

  // Sort by priority and return top 5
  return recs.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

/** Compute session statistics. */
function computeStats(
  decisions: CreativeDecision[],
  spec: MotionSpec,
  startTime: number,
): SessionStats {
  const intentDistribution: Record<string, number> = {};
  const toolCounts = new Map<string, number>();
  const componentsTouched = new Set<string>();

  for (const d of decisions) {
    intentDistribution[d.intent] = (intentDistribution[d.intent] ?? 0) + 1;
    toolCounts.set(d.action, (toolCounts.get(d.action) ?? 0) + 1);
    if (d.componentId) componentsTouched.add(d.componentId);
  }

  const mostUsedTools = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tool, count]) => ({ tool, count }));

  const uniqueTools = toolCounts.size;
  const experimentationRate = decisions.length > 0 ? uniqueTools / decisions.length : 0;

  return {
    totalActions: decisions.length,
    uniqueComponentsTouched: componentsTouched.size,
    averageActionsPerComponent: spec.components.length > 0
      ? decisions.length / spec.components.length
      : 0,
    timeSpentMs: Date.now() - startTime,
    intentDistribution,
    mostUsedTools,
    experimentationRate,
  };
}

/** Build a natural language summary. */
function buildSummary(
  direction: CreativeDirection,
  patterns: DesignPattern[],
  stats: SessionStats,
): string {
  const parts: string[] = [];

  // Style and direction
  if (direction.style !== "undetermined") {
    parts.push(`The session trends toward a ${direction.style} aesthetic`);
  }
  parts.push(`with primary creative intent: ${direction.primaryIntent.replace(/_/g, " ")}`);

  // Maturity
  if (direction.maturity >= 0.8) {
    parts.push("The design is near completion");
  } else if (direction.maturity >= 0.5) {
    parts.push("The design is taking shape");
  } else if (direction.maturity >= 0.3) {
    parts.push("The design is in early development");
  } else {
    parts.push("The design is just beginning");
  }

  // Patterns
  if (patterns.length > 0) {
    parts.push(`Detected ${patterns.length} design pattern${patterns.length > 1 ? "s" : ""}: ${patterns.map((p) => p.name).join(", ")}`);
  }

  // Velocity
  if (direction.velocity > 10) {
    parts.push("The user is working rapidly");
  } else if (direction.velocity > 3) {
    parts.push("The user is working at a steady pace");
  } else if (stats.totalActions > 0) {
    parts.push("The user is working deliberately");
  }

  // Experimentation
  if (stats.experimentationRate > 0.7) {
    parts.push("with high experimentation across diverse tools");
  } else if (stats.experimentationRate < 0.3 && stats.totalActions > 5) {
    parts.push("with focused, repetitive refinement");
  }

  return parts.join(", ") + ".";
}

/** Clear session state for a project. */
export function clearCreativeContext(projectId: string): void {
  sessionState.delete(projectId);
}

/** Get the raw decision history for a project. */
export function getDecisionHistory(projectId: string): CreativeDecision[] {
  return sessionState.get(projectId)?.decisions ?? [];
}
