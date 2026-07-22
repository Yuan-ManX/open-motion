/**
 * Motion Strategist — project-level motion strategy recommendation.
 *
 * This is the sixteenth original AI-native module. Where the Coach teaches
 * individual principles and the Persona applies a design style, the Strategist
 * analyzes the entire project context and recommends a holistic motion
 * strategy — a unified philosophy that governs timing, easing, intensity,
 * rhythm, and accessibility stance across the whole project.
 *
 * Five core outputs:
 * 1. Project archetype detection — classifies the project into one of eight
 *    archetypes (landing-page, dashboard, storytelling, game, product-app,
 *    marketing, prototype, data-viz) based on component patterns and metadata.
 * 2. Timing philosophy — recommends a duration palette and stagger philosophy
 *    matched to the archetype and audience.
 * 3. Easing palette — recommends 3-5 easings that should form the project's
 *    vocabulary, with usage ratios.
 * 4. Rhythm pattern — recommends a rhythmic structure (steady, accelerating,
 *    decelerating, syncopated, free-form) for multi-component sequences.
 * 5. Accessibility stance — recommends a baseline accessibility posture
 *    (strict, balanced, permissive) with specific guardrails.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec } from "@openmotion/shared";

/** Project archetypes that the strategist can detect. */
export type ProjectArchetype =
  | "landing-page"
  | "dashboard"
  | "storytelling"
  | "game"
  | "product-app"
  | "marketing"
  | "prototype"
  | "data-viz";

/** A recommended timing philosophy. */
export interface TimingPhilosophy {
  /** Recommended duration palette in ms. */
  durationPalette: { label: string; ms: number; usage: string }[];
  /** Recommended stagger interval for sequential animations. */
  staggerIntervalMs: number;
  /** Whether to favor parallel or sequential animation. */
  executionStyle: "parallel" | "sequential" | "hybrid";
  /** Description of the timing philosophy. */
  description: string;
}

/** A recommended easing palette entry. */
export interface EasingPaletteEntry {
  easing: string;
  /** Recommended usage ratio (0..1). */
  ratio: number;
  /** When to use this easing. */
  whenToUse: string;
}

/** A recommended rhythm pattern. */
export interface RhythmPattern {
  pattern: "steady" | "accelerating" | "decelerating" | "syncopated" | "free-form";
  description: string;
  /** Recommended beats per minute equivalent for sequential timing. */
  tempoBpm: number;
  /** Whether silence/gaps are part of the rhythm. */
  usesRests: boolean;
}

/** A recommended accessibility stance. */
export interface AccessibilityStance {
  level: "strict" | "balanced" | "permissive";
  /** Max duration for any single animation. */
  maxDurationMs: number;
  /** Whether infinite loops are allowed. */
  allowsInfiniteLoops: boolean;
  /** Easings to avoid. */
  avoidedEasings: string[];
  /** Specific guardrails. */
  guardrails: string[];
  description: string;
}

/** A strategic recommendation. */
export interface StrategicRecommendation {
  rank: number;
  category: "timing" | "easing" | "rhythm" | "accessibility" | "structure";
  title: string;
  description: string;
  /** Current state. */
  currentState: string;
  /** Recommended state. */
  recommendedState: string;
  /** Expected impact. */
  impact: string;
}

/** The complete strategist report. */
export interface StrategyReport {
  /** Detected project archetype. */
  archetype: ProjectArchetype;
  /** Confidence in the archetype detection (0..1). */
  archetypeConfidence: number;
  /** Evidence for the archetype. */
  archetypeEvidence: string[];
  /** Recommended timing philosophy. */
  timing: TimingPhilosophy;
  /** Recommended easing palette. */
  easingPalette: EasingPaletteEntry[];
  /** Recommended rhythm pattern. */
  rhythm: RhythmPattern;
  /** Recommended accessibility stance. */
  accessibility: AccessibilityStance;
  /** Strategic recommendations. */
  recommendations: StrategicRecommendation[];
  /** Overall strategy coherence score (0..100). */
  coherenceScore: number;
  /** Human-readable summary. */
  summary: string;
}

/** Archetype detection signatures. */
const ARCHETYPE_SIGNATURES: Record<ProjectArchetype, {
  description: string;
  durationRange: { min: number; max: number };
  typicalTriggers: string[];
  typicalEasings: string[];
  prefersLoops: boolean;
  typicalComponentCount: { min: number; max: number };
  keywords: string[];
}> = {
  "landing-page": {
    description: "Marketing landing page with hero sections, CTAs, and scroll reveals.",
    durationRange: { min: 600, max: 1200 },
    typicalTriggers: ["onLoad", "onScroll"],
    prefersLoops: false,
    typicalComponentCount: { min: 5, max: 20 },
    keywords: ["hero", "cta", "landing", "scroll", "reveal", "section", "banner"],
    typicalEasings: ["ease-out", "cubic-bezier"],
  },
  "dashboard": {
    description: "Data dashboard with charts, widgets, and real-time updates.",
    durationRange: { min: 200, max: 600 },
    typicalTriggers: ["onLoad", "afterDelay"],
    prefersLoops: false,
    typicalComponentCount: { min: 10, max: 50 },
    keywords: ["chart", "widget", "card", "stat", "metric", "data", "panel", "grid"],
    typicalEasings: ["ease-in-out", "linear"],
  },
  "storytelling": {
    description: "Narrative-driven experience with sequential story beats.",
    durationRange: { min: 800, max: 2000 },
    typicalTriggers: ["onScroll", "afterDelay"],
    prefersLoops: false,
    typicalComponentCount: { min: 8, max: 30 },
    keywords: ["story", "scene", "chapter", "narrative", "beat", "act", "scroll"],
    typicalEasings: ["ease-in-out", "cubic-bezier"],
  },
  "game": {
    description: "Interactive game with character animations and feedback loops.",
    durationRange: { min: 100, max: 800 },
    typicalTriggers: ["onClick", "onHover"],
    prefersLoops: true,
    typicalComponentCount: { min: 15, max: 60 },
    keywords: ["game", "player", "character", "score", "level", "enemy", "sprite", "particle"],
    typicalEasings: ["spring", "bounce", "linear"],
  },
  "product-app": {
    description: "Product application with UI transitions and micro-interactions.",
    durationRange: { min: 150, max: 500 },
    typicalTriggers: ["onClick", "onHover"],
    prefersLoops: false,
    typicalComponentCount: { min: 8, max: 40 },
    keywords: ["button", "modal", "dropdown", "menu", "tab", "sidebar", "toolbar", "input"],
    typicalEasings: ["ease-out", "ease-in-out"],
  },
  "marketing": {
    description: "Promotional content with bold animations and eye-catching effects.",
    durationRange: { min: 400, max: 1500 },
    typicalTriggers: ["onLoad", "onScroll"],
    prefersLoops: true,
    typicalComponentCount: { min: 5, max: 25 },
    keywords: ["promo", "banner", "ad", "popup", "overlay", "spotlight", "feature"],
    typicalEasings: ["spring", "bounce", "ease-out"],
  },
  "prototype": {
    description: "Interactive prototype with exploratory motion and rough timing.",
    durationRange: { min: 100, max: 1000 },
    typicalTriggers: ["onLoad", "onClick"],
    prefersLoops: false,
    typicalComponentCount: { min: 3, max: 15 },
    keywords: ["proto", "demo", "test", "mock", "sample", "placeholder"],
    typicalEasings: ["ease-out", "linear"],
  },
  "data-viz": {
    description: "Data visualization with precise state transitions and axis animations.",
    durationRange: { min: 300, max: 800 },
    typicalTriggers: ["onLoad", "afterDelay"],
    prefersLoops: false,
    typicalComponentCount: { min: 5, max: 30 },
    keywords: ["axis", "bar", "line", "pie", "graph", "plot", "legend", "tooltip"],
    typicalEasings: ["linear", "ease-in-out"],
  },
};

/** Timing philosophies per archetype. */
const TIMING_PHILOSOPHIES: Record<ProjectArchetype, TimingPhilosophy> = {
  "landing-page": {
    durationPalette: [
      { label: "micro", ms: 300, usage: "Button hovers, small accents" },
      { label: "standard", ms: 800, usage: "Section reveals, card entrances" },
      { label: "hero", ms: 1200, usage: "Hero text, large imagery" },
    ],
    staggerIntervalMs: 120,
    executionStyle: "sequential",
    description: "Sequential reveals with generous durations — let the story unfold as the user scrolls.",
  },
  "dashboard": {
    durationPalette: [
      { label: "instant", ms: 150, usage: "Data updates, value changes" },
      { label: "standard", ms: 400, usage: "Panel transitions, widget loading" },
      { label: "emphasis", ms: 600, usage: "Alert animations, notification entrance" },
    ],
    staggerIntervalMs: 50,
    executionStyle: "parallel",
    description: "Quick parallel updates — data should feel responsive and live.",
  },
  "storytelling": {
    durationPalette: [
      { label: "beat", ms: 1000, usage: "Scene transitions, narrative beats" },
      { label: "dramatic", ms: 1800, usage: "Climax moments, reveals" },
      { label: "breath", ms: 2500, usage: "Establishing shots, contemplation" },
    ],
    staggerIntervalMs: 300,
    executionStyle: "sequential",
    description: "Long sequential beats with dramatic pacing — let each moment land before the next begins.",
  },
  "game": {
    durationPalette: [
      { label: "snappy", ms: 120, usage: "Click feedback, hit reactions" },
      { label: "action", ms: 400, usage: "Character moves, item spawns" },
      { label: "cinematic", ms: 800, usage: "Level transitions, cutscenes" },
    ],
    staggerIntervalMs: 60,
    executionStyle: "hybrid",
    description: "Snappy reactive timing with occasional cinematic pauses — keep the player in flow.",
  },
  "product-app": {
    durationPalette: [
      { label: "micro", ms: 200, usage: "Button presses, toggle switches" },
      { label: "standard", ms: 350, usage: "Modal opens, panel slides" },
      { label: "page", ms: 500, usage: "Route transitions, full-screen changes" },
    ],
    staggerIntervalMs: 40,
    executionStyle: "parallel",
    description: "Tight responsive timing — motion should feel instant but smooth.",
  },
  "marketing": {
    durationPalette: [
      { label: "pop", ms: 400, usage: "Logo reveals, icon bounces" },
      { label: "standard", ms: 900, usage: "Feature showcases, text reveals" },
      { label: "spectacle", ms: 1500, usage: "Hero animations, particle effects" },
    ],
    staggerIntervalMs: 100,
    executionStyle: "hybrid",
    description: "Bold hybrid timing — mix quick pops with longer spectacles for maximum impact.",
  },
  "prototype": {
    durationPalette: [
      { label: "quick", ms: 250, usage: "Test transitions, placeholder motion" },
      { label: "standard", ms: 600, usage: "Demo flows, presentation moments" },
    ],
    staggerIntervalMs: 80,
    executionStyle: "sequential",
    description: "Exploratory timing — quick enough to iterate, slow enough to evaluate.",
  },
  "data-viz": {
    durationPalette: [
      { label: "tick", ms: 200, usage: "Axis ticks, grid lines" },
      { label: "morph", ms: 500, usage: "Bar heights, line paths" },
      { label: "sweep", ms: 800, usage: "Full chart transitions, legend fades" },
    ],
    staggerIntervalMs: 30,
    executionStyle: "parallel",
    description: "Precise parallel timing — data should morph simultaneously for accurate comparison.",
  },
};

/** Rhythm patterns per archetype. */
const RHYTHM_PATTERNS: Record<ProjectArchetype, RhythmPattern> = {
  "landing-page": { pattern: "steady", description: "Consistent cadence as sections reveal on scroll.", tempoBpm: 80, usesRests: true },
  "dashboard": { pattern: "steady", description: "Uniform parallel updates — no rhythm hierarchy.", tempoBpm: 120, usesRests: false },
  "storytelling": { pattern: "decelerating", description: "Starts brisk, slows for dramatic moments.", tempoBpm: 60, usesRests: true },
  "game": { pattern: "syncopated", description: "Irreactive bursts matching player input.", tempoBpm: 140, usesRests: true },
  "product-app": { pattern: "steady", description: "Uniform snappy timing for predictability.", tempoBpm: 100, usesRests: false },
  "marketing": { pattern: "accelerating", description: "Builds energy toward a climax.", tempoBpm: 90, usesRests: true },
  "prototype": { pattern: "free-form", description: "Exploratory — no strict rhythm.", tempoBpm: 80, usesRests: true },
  "data-viz": { pattern: "steady", description: "Precise uniform ticks for data integrity.", tempoBpm: 110, usesRests: false },
};

/** Accessibility stances per archetype. */
const ACCESSIBILITY_STANCES: Record<ProjectArchetype, AccessibilityStance> = {
  "landing-page": {
    level: "balanced",
    maxDurationMs: 1500,
    allowsInfiniteLoops: false,
    avoidedEasings: ["linear"],
    guardrails: ["Honor prefers-reduced-motion for scroll-triggered reveals.", "Keep hero animations under 1.5s."],
    description: "Balanced — welcoming but not restrictive. Motion enhances but doesn't block content.",
  },
  "dashboard": {
    level: "strict",
    maxDurationMs: 600,
    allowsInfiniteLoops: false,
    avoidedEasings: ["bounce", "spring"],
    guardrails: ["No infinite loops — they distract from data.", "All transitions under 600ms for responsiveness.", "Provide loading skeletons, not spinners."],
    description: "Strict — data clarity comes first. Motion must never obscure or delay information.",
  },
  "storytelling": {
    level: "permissive",
    maxDurationMs: 3000,
    allowsInfiniteLoops: false,
    avoidedEasings: [],
    guardrails: ["Provide a static-text fallback for screen readers.", "Allow pause/skip for long sequences."],
    description: "Permissive — narrative impact requires longer durations. Provide alternatives, not restrictions.",
  },
  "game": {
    level: "permissive",
    maxDurationMs: 1000,
    allowsInfiniteLoops: true,
    avoidedEasings: [],
    guardrails: ["Provide a reduced-motion mode that simplifies particle effects.", "Flash rate under 3Hz for photosensitivity."],
    description: "Permissive — gameplay requires expressive motion. Offer a reduced-motion toggle, not restrictions.",
  },
  "product-app": {
    level: "strict",
    maxDurationMs: 500,
    allowsInfiniteLoops: false,
    avoidedEasings: ["bounce"],
    guardrails: ["All UI transitions under 500ms.", "No decorative loops.", "Focus indicators must persist."],
    description: "Strict — product motion must be fast, predictable, and never block interaction.",
  },
  "marketing": {
    level: "balanced",
    maxDurationMs: 2000,
    allowsInfiniteLoops: true,
    avoidedEasings: ["linear"],
    guardrails: ["Loops must respect prefers-reduced-motion.", "Hero loops should be subtle, not distracting."],
    description: "Balanced — expressive but with safety rails. Loops welcome if they respect user preferences.",
  },
  "prototype": {
    level: "permissive",
    maxDurationMs: 1000,
    allowsInfiniteLoops: false,
    avoidedEasings: [],
    guardrails: ["Label as prototype — accessibility polish comes later."],
    description: "Permissive — focus on exploration. Accessibility hardening happens post-prototype.",
  },
  "data-viz": {
    level: "strict",
    maxDurationMs: 800,
    allowsInfiniteLoops: false,
    avoidedEasings: ["bounce", "spring"],
    guardrails: ["Data transitions must complete fully — no mid-transition pause.", "Tooltips must not animate their content.", "Axis changes must be instant or smoothly interpolated."],
    description: "Strict — data integrity is paramount. Motion must never create ambiguity about values.",
  },
};

/**
 * Detect the project archetype based on component patterns and metadata.
 */
function detectArchetype(
  spec: MotionSpec,
): { archetype: ProjectArchetype; confidence: number; evidence: string[] } {
  const components = spec.components;
  const evidence: string[] = [];

  if (components.length === 0) {
    return { archetype: "prototype", confidence: 0.3, evidence: ["Empty project — assuming prototype."] };
  }

  const scores: Record<ProjectArchetype, number> = {
    "landing-page": 0,
    "dashboard": 0,
    "storytelling": 0,
    "game": 0,
    "product-app": 0,
    "marketing": 0,
    "prototype": 0,
    "data-viz": 0,
  };

  // Name-based scoring
  const allNames = components.map((c) => c.name.toLowerCase()).join(" ");
  for (const [archetype, sig] of Object.entries(ARCHETYPE_SIGNATURES)) {
    let keywordHits = 0;
    for (const kw of sig.keywords) {
      if (allNames.includes(kw)) keywordHits++;
    }
    if (keywordHits > 0) {
      scores[archetype as ProjectArchetype] += keywordHits * 3;
      evidence.push(`Name match: ${keywordHits} keyword(s) for "${archetype}"`);
    }
  }

  // Component count scoring
  for (const [archetype, sig] of Object.entries(ARCHETYPE_SIGNATURES)) {
    if (components.length >= sig.typicalComponentCount.min && components.length <= sig.typicalComponentCount.max) {
      scores[archetype as ProjectArchetype] += 2;
      evidence.push(`Component count (${components.length}) fits "${archetype}" range`);
    }
  }

  // Duration range scoring
  const avgDuration = components.reduce((sum, c) => sum + c.durationMs, 0) / components.length;
  for (const [archetype, sig] of Object.entries(ARCHETYPE_SIGNATURES)) {
    if (avgDuration >= sig.durationRange.min && avgDuration <= sig.durationRange.max) {
      scores[archetype as ProjectArchetype] += 2;
      evidence.push(`Average duration (${Math.round(avgDuration)}ms) fits "${archetype}" range`);
    }
  }

  // Trigger distribution scoring
  const triggers = components.map((c) => c.trigger);
  for (const [archetype, sig] of Object.entries(ARCHETYPE_SIGNATURES)) {
    const triggerMatch = triggers.filter((t) => sig.typicalTriggers.includes(t)).length;
    if (triggerMatch > 0) {
      scores[archetype as ProjectArchetype] += triggerMatch;
      evidence.push(`Trigger match: ${triggerMatch}/${components.length} for "${archetype}"`);
    }
  }

  // Loop preference scoring
  const hasLoops = components.some((c) => c.iterationCount === "infinite");
  for (const [archetype, sig] of Object.entries(ARCHETYPE_SIGNATURES)) {
    if (hasLoops && sig.prefersLoops) {
      scores[archetype as ProjectArchetype] += 2;
      evidence.push(`Has loops, matching "${archetype}" preference`);
    } else if (!hasLoops && !sig.prefersLoops) {
      scores[archetype as ProjectArchetype] += 1;
    }
  }

  // Project metadata scoring
  const projDesc = (spec.project.description || "").toLowerCase();
  const projName = (spec.project.name || "").toLowerCase();
  const projText = `${projName} ${projDesc}`;
  for (const [archetype, sig] of Object.entries(ARCHETYPE_SIGNATURES)) {
    let metaHits = 0;
    for (const kw of sig.keywords) {
      if (projText.includes(kw)) metaHits++;
    }
    if (metaHits > 0) {
      scores[archetype as ProjectArchetype] += metaHits * 2;
      evidence.push(`Project metadata match: ${metaHits} keyword(s) for "${archetype}"`);
    }
  }

  // Find best archetype
  let bestArchetype: ProjectArchetype = "prototype";
  let bestScore = 0;
  let totalScore = 0;
  for (const [archetype, score] of Object.entries(scores)) {
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestArchetype = archetype as ProjectArchetype;
    }
  }

  const confidence = totalScore > 0 ? bestScore / totalScore : 0.3;

  // Keep only top evidence
  const topEvidence = evidence.slice(0, 5);

  return { archetype: bestArchetype, confidence: Math.round(confidence * 100) / 100, evidence: topEvidence };
}

/**
 * Generate the easing palette for the detected archetype.
 */
function generateEasingPalette(archetype: ProjectArchetype): EasingPaletteEntry[] {
  const sig = ARCHETYPE_SIGNATURES[archetype];
  const palette: EasingPaletteEntry[] = [];

  // Primary easing from signature
  const primary = sig.typicalEasings[0];
  palette.push({
    easing: primary,
    ratio: 0.5,
    whenToUse: `Primary easing for most ${archetype} animations`,
  });

  // Secondary easing
  if (sig.typicalEasings.length > 1) {
    palette.push({
      easing: sig.typicalEasings[1],
      ratio: 0.3,
      whenToUse: `Secondary easing for variety and emphasis`,
    });
  }

  // Always include a utility easing
  palette.push({
    easing: "ease-out",
    ratio: 0.2,
    whenToUse: "Utility easing for entrances and reveals",
  });

  return palette;
}

/**
 * Generate strategic recommendations by comparing current state to ideal.
 */
function generateStrategicRecs(
  spec: MotionSpec,
  archetype: ProjectArchetype,
  timing: TimingPhilosophy,
  accessibility: AccessibilityStance,
): StrategicRecommendation[] {
  const recs: StrategicRecommendation[] = [];
  const components = spec.components;
  let rank = 1;

  if (components.length === 0) {
    recs.push({
      rank: rank++,
      category: "structure",
      title: "Start with archetype-appropriate components",
      description: `Based on the "${archetype}" archetype, begin with ${ARCHETYPE_SIGNATURES[archetype].typicalComponentCount.min}-${ARCHETYPE_SIGNATURES[archetype].typicalComponentCount.max} components using ${timing.executionStyle} execution.`,
      currentState: "Empty project",
      recommendedState: `${ARCHETYPE_SIGNATURES[archetype].typicalComponentCount.min}+ ${archetype} components`,
      impact: "Establishes the right structural foundation from the start.",
    });
    return recs;
  }

  // Duration analysis
  const avgDuration = components.reduce((sum, c) => sum + c.durationMs, 0) / components.length;
  const idealRange = ARCHETYPE_SIGNATURES[archetype].durationRange;
  if (avgDuration < idealRange.min) {
    recs.push({
      rank: rank++,
      category: "timing",
      title: "Extend average duration to match archetype",
      description: `Average duration (${Math.round(avgDuration)}ms) is shorter than the ideal ${archetype} range (${idealRange.min}-${idealRange.max}ms).`,
      currentState: `${Math.round(avgDuration)}ms average`,
      recommendedState: `${idealRange.min}-${idealRange.max}ms range`,
      impact: "Longer durations will give the motion more presence and readability.",
    });
  } else if (avgDuration > idealRange.max) {
    recs.push({
      rank: rank++,
      category: "timing",
      title: "Shorten average duration to match archetype",
      description: `Average duration (${Math.round(avgDuration)}ms) is longer than the ideal ${archetype} range (${idealRange.min}-${idealRange.max}ms).`,
      currentState: `${Math.round(avgDuration)}ms average`,
      recommendedState: `${idealRange.min}-${idealRange.max}ms range`,
      impact: "Shorter durations will feel more responsive and appropriate for the context.",
    });
  }

  // Accessibility analysis
  const longAnims = components.filter((c) => c.durationMs > accessibility.maxDurationMs);
  if (longAnims.length > 0 && accessibility.level !== "permissive") {
    recs.push({
      rank: rank++,
      category: "accessibility",
      title: `Reduce ${longAnims.length} animation(s) exceeding max duration`,
      description: `${longAnims.length} component(s) exceed the ${accessibility.maxDurationMs}ms max for ${archetype} projects.`,
      currentState: `${longAnims.length} animations over ${accessibility.maxDurationMs}ms`,
      recommendedState: `All animations under ${accessibility.maxDurationMs}ms`,
      impact: accessibility.description,
    });
  }

  const infiniteLoops = components.filter((c) => c.iterationCount === "infinite");
  if (infiniteLoops.length > 0 && !accessibility.allowsInfiniteLoops) {
    recs.push({
      rank: rank++,
      category: "accessibility",
      title: "Replace infinite loops with finite iterations",
      description: `${infiniteLoops.length} component(s) use infinite loops, which is not recommended for ${archetype} projects.`,
      currentState: `${infiniteLoops.length} infinite loops`,
      recommendedState: "Finite iterations (3-5)",
      impact: "Reduces continuous GPU cost and avoids accessibility concerns.",
    });
  }

  // Easing consistency
  const easingSet = new Set(components.map((c) => String(c.easing)));
  if (easingSet.size > 5) {
    recs.push({
      rank: rank++,
      category: "easing",
      title: "Consolidate easing vocabulary",
      description: `Project uses ${easingSet.size} distinct easings. A focused palette of 3-5 easings creates more cohesion.`,
      currentState: `${easingSet.size} distinct easings`,
      recommendedState: "3-5 easings from the recommended palette",
      impact: "Creates a more unified motion language across the project.",
    });
  }

  return recs;
}

/**
 * Compute strategy coherence score.
 */
function computeCoherenceScore(
  spec: MotionSpec,
  archetype: ProjectArchetype,
  recommendations: StrategicRecommendation[],
): number {
  if (spec.components.length === 0) return 50;

  let score = 100;
  // Each recommendation reduces the score
  score -= recommendations.length * 8;
  // Confidence of archetype detection adds to the score
  return Math.max(20, Math.min(100, score));
}

/**
 * Analyze a project and recommend a holistic motion strategy.
 */
export function strategizeMotion(spec: MotionSpec): StrategyReport {
  // Detect archetype
  const { archetype, confidence, evidence } = detectArchetype(spec);

  // Get philosophy from archetype
  const timing = TIMING_PHILOSOPHIES[archetype];
  const easingPalette = generateEasingPalette(archetype);
  const rhythm = RHYTHM_PATTERNS[archetype];
  const accessibility = ACCESSIBILITY_STANCES[archetype];

  // Generate recommendations
  const recommendations = generateStrategicRecs(spec, archetype, timing, accessibility);

  // Compute coherence
  const coherenceScore = computeCoherenceScore(spec, archetype, recommendations);

  // Summary
  const summary = `Archetype: ${archetype} (${Math.round(confidence * 100)}% confidence). ${timing.description} Rhythm: ${rhythm.pattern}. Accessibility: ${accessibility.level}. ${recommendations.length} strategic recommendation(s). Coherence: ${coherenceScore}/100.`;

  return {
    archetype,
    archetypeConfidence: confidence,
    archetypeEvidence: evidence,
    timing,
    easingPalette,
    rhythm,
    accessibility,
    recommendations,
    coherenceScore,
    summary,
  };
}

/**
 * List all project archetypes with their descriptions.
 */
export function listArchetypes(): Array<{ archetype: ProjectArchetype; description: string }> {
  return (Object.keys(ARCHETYPE_SIGNATURES) as ProjectArchetype[]).map((a) => ({
    archetype: a,
    description: ARCHETYPE_SIGNATURES[a].description,
  }));
}

/**
 * Format the strategy report as a human-readable string.
 */
export function formatStrategyReport(report: StrategyReport): string {
  const lines: string[] = [];
  lines.push(`# Motion Strategist Report`);
  lines.push("");
  lines.push(`**Archetype: ${report.archetype}** (${Math.round(report.archetypeConfidence * 100)}% confidence) | Coherence: ${report.coherenceScore}/100`);
  lines.push(report.summary);
  lines.push("");

  lines.push(`## Archetype Evidence`);
  for (const e of report.archetypeEvidence) {
    lines.push(`- ${e}`);
  }
  lines.push("");

  lines.push(`## Timing Philosophy`);
  lines.push(report.timing.description);
  lines.push(`- Execution: ${report.timing.executionStyle}`);
  lines.push(`- Stagger: ${report.timing.staggerIntervalMs}ms`);
  for (const d of report.timing.durationPalette) {
    lines.push(`- ${d.label}: ${d.ms}ms — ${d.usage}`);
  }
  lines.push("");

  lines.push(`## Easing Palette`);
  for (const e of report.easingPalette) {
    lines.push(`- ${e.easing} (${Math.round(e.ratio * 100)}%) — ${e.whenToUse}`);
  }
  lines.push("");

  lines.push(`## Rhythm Pattern`);
  lines.push(`- Pattern: ${report.rhythm.pattern}`);
  lines.push(`- Tempo: ${report.rhythm.tempoBpm} BPM`);
  lines.push(`- Uses rests: ${report.rhythm.usesRests}`);
  lines.push(`- ${report.rhythm.description}`);
  lines.push("");

  lines.push(`## Accessibility Stance`);
  lines.push(`- Level: ${report.accessibility.level}`);
  lines.push(`- Max duration: ${report.accessibility.maxDurationMs}ms`);
  lines.push(`- Infinite loops: ${report.accessibility.allowsInfiniteLoops ? "allowed" : "discouraged"}`);
  if (report.accessibility.avoidedEasings.length > 0) {
    lines.push(`- Avoided easings: ${report.accessibility.avoidedEasings.join(", ")}`);
  }
  for (const g of report.accessibility.guardrails) {
    lines.push(`- Guardrail: ${g}`);
  }
  lines.push("");

  if (report.recommendations.length > 0) {
    lines.push(`## Strategic Recommendations`);
    for (const r of report.recommendations) {
      lines.push(`${r.rank}. [${r.category.toUpperCase()}] ${r.title}`);
      lines.push(`   ${r.description}`);
      lines.push(`   ${r.currentState} → ${r.recommendedState}`);
      lines.push(`   Impact: ${r.impact}`);
    }
  }

  return lines.join("\n");
}
