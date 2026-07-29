/**
 * Motion Theme System — coordinated motion identity.
 *
 * Defines a unified motion identity that coordinates easing families,
 * timing scales, choreography rules, and motion personality into a
 * single cohesive theme. A motion theme acts as a design system for
 * motion, ensuring consistency across an entire product or brand.
 *
 * Original to OpenMotion — applies design system principles to motion
 * identity, creating reusable, themable motion personalities.
 */

import type { MotionSpec, MotionComponent, Easing, EasingPreset } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Motion personality archetype. */
export type MotionPersonality =
  | "precise"
  | "organic"
  | "playful"
  | "dramatic"
  | "minimal"
  | "luxurious"
  | "technical"
  | "warm";

/** A motion theme definition. */
export interface MotionTheme {
  /** Unique theme identifier. */
  id: string;
  /** Theme name. */
  name: string;
  /** Personality archetype. */
  personality: MotionPersonality;
  /** Description of the motion character. */
  description: string;
  /** Easing family — the signature easing curves. */
  easingFamily: EasingFamily;
  /** Timing scale — standard durations. */
  timingScale: TimingScale;
  /** Choreography rules. */
  choreography: ThemeChoreography;
  /** Motion vocabulary — what motions are encouraged/discouraged. */
  vocabulary: MotionVocabulary;
  /** Color motion rules — how colors animate. */
  colorMotion: ColorMotionRules;
  /** Tags for search and categorization. */
  tags: string[];
}

/** Easing family — a coordinated set of easing curves. */
export interface EasingFamily {
  /** Primary easing for standard transitions. */
  standard: Easing;
  /** Easing for entrances (elements appearing). */
  entrance: Easing;
  /** Easing for exits (elements disappearing). */
  exit: Easing;
  /** Easing for emphasis (attention-grabbing motions). */
  emphasis: Easing;
  /** Easing for interactive feedback. */
  interactive: Easing;
  /** Spring configuration for physics-based motion. */
  spring?: { stiffness: number; damping: number; mass: number };
}

/** Timing scale — standard durations for different motion types. */
export interface TimingScale {
  /** Micro-interaction duration (ms). */
  micro: number;
  /** Standard transition duration (ms). */
  standard: number;
  /** Extended transition duration (ms). */
  extended: number;
  /** Scene transition duration (ms). */
  scene: number;
  /** Entrance animation duration (ms). */
  entrance: number;
  /** Exit animation duration (ms). */
  exit: number;
  /** Delay between staggered items (ms). */
  stagger: number;
}

/** Choreography rules for a theme. */
export interface ThemeChoreography {
  /** Preferred choreography pattern. */
  preferredPattern: string;
  /** Stagger direction. */
  staggerDirection: "ltr" | "rtl" | "ttb" | "btt" | "center-out" | "random";
  /** Maximum simultaneous animations. */
  maxConcurrent: number;
  /** Overlap percentage (0-1) between sequential items. */
  overlap: number;
  /** Whether to use spring physics for choreography. */
  useSprings: boolean;
}

/** Motion vocabulary — encouraged and discouraged motions. */
export interface MotionVocabulary {
  /** Motion patterns that fit this theme. */
  encouraged: string[];
  /** Motion patterns that conflict with this theme. */
  discouraged: string[];
  /** Signature motions unique to this theme. */
  signature: string[];
}

/** Color motion rules — how colors transition. */
export interface ColorMotionRules {
  /** Whether color transitions are enabled. */
  enabled: boolean;
  /** Transition duration for color changes (ms). */
  durationMs: number;
  /** Easing for color transitions. */
  easing: string;
  /** Whether to use color harmonies. */
  useHarmony: boolean;
  /** Preferred harmony type. */
  harmonyType?: "complementary" | "analogous" | "triadic" | "monochrome";
}

/** Options for creating a custom theme. */
export interface CreateThemeOptions {
  name: string;
  personality: MotionPersonality;
  description?: string;
  /** Base duration for the timing scale (ms). */
  baseDurationMs?: number;
  /** Whether to use spring physics. */
  useSprings?: boolean;
  /** Preferred stagger direction. */
  staggerDirection?: ThemeChoreography["staggerDirection"];
}

// ---------------------------------------------------------------------------
// Predefined Themes
// ---------------------------------------------------------------------------

const PRESET_THEMES: MotionTheme[] = [
  {
    id: "precision-tech",
    name: "Precision Tech",
    personality: "precise",
    description: "Sharp, exact motions with minimal excess. Every movement has purpose and lands precisely where intended.",
    tags: ["tech", "sharp", "exact", "professional"],
    easingFamily: {
      standard: { type: "bezier", p1: [0.4, 0.0], p2: [0.2, 1.0] },
      entrance: { type: "preset", name: "ease-out" },
      exit: { type: "preset", name: "ease-in" },
      emphasis: { type: "bezier", p1: [0.0, 0.0], p2: [0.0, 1.0] },
      interactive: { type: "preset", name: "ease-out" },
      spring: { stiffness: 400, damping: 30, mass: 1 },
    },
    timingScale: {
      micro: 120,
      standard: 240,
      extended: 400,
      scene: 600,
      entrance: 360,
      exit: 240,
      stagger: 40,
    },
    choreography: {
      preferredPattern: "cascade",
      staggerDirection: "ltr",
      maxConcurrent: 4,
      overlap: 0.2,
      useSprings: false,
    },
    vocabulary: {
      encouraged: ["slide", "fade", "scale", "rotate"],
      discouraged: ["bounce", "elastic", "wiggle"],
      signature: ["precise-slide-in", "snap-to-position"],
    },
    colorMotion: {
      enabled: true,
      durationMs: 200,
      easing: "ease-out",
      useHarmony: true,
      harmonyType: "monochrome",
    },
  },
  {
    id: "organic-flow",
    name: "Organic Flow",
    personality: "organic",
    description: "Natural, flowing motions that feel alive. Spring physics and gentle curves create organic movement.",
    tags: ["organic", "natural", "flow", "spring"],
    easingFamily: {
      standard: { type: "spring", stiffness: 180, damping: 20, mass: 1 },
      entrance: { type: "spring", stiffness: 200, damping: 18, mass: 1 },
      exit: { type: "spring", stiffness: 160, damping: 24, mass: 1 },
      emphasis: { type: "spring", stiffness: 300, damping: 15, mass: 1 },
      interactive: { type: "spring", stiffness: 220, damping: 16, mass: 1 },
      spring: { stiffness: 180, damping: 20, mass: 1 },
    },
    timingScale: {
      micro: 180,
      standard: 360,
      extended: 600,
      scene: 800,
      entrance: 500,
      exit: 360,
      stagger: 60,
    },
    choreography: {
      preferredPattern: "wave",
      staggerDirection: "center-out",
      maxConcurrent: 6,
      overlap: 0.35,
      useSprings: true,
    },
    vocabulary: {
      encouraged: ["morph", "spring", "wave", "ripple", "breathe"],
      discouraged: ["snap", "cut", "linear"],
      signature: ["organic-morph", "breathing-pulse"],
    },
    colorMotion: {
      enabled: true,
      durationMs: 400,
      easing: "ease-in-out",
      useHarmony: true,
      harmonyType: "analogous",
    },
  },
  {
    id: "playful-bounce",
    name: "Playful Bounce",
    personality: "playful",
    description: "Energetic, bouncy motions full of character. Overlapping actions and exaggeration bring joy.",
    tags: ["playful", "bounce", "energetic", "fun"],
    easingFamily: {
      standard: { type: "preset", name: "back" },
      entrance: { type: "preset", name: "bounce" },
      exit: { type: "preset", name: "back" },
      emphasis: { type: "preset", name: "elastic" },
      interactive: { type: "preset", name: "back" },
      spring: { stiffness: 300, damping: 12, mass: 1 },
    },
    timingScale: {
      micro: 150,
      standard: 320,
      extended: 500,
      scene: 700,
      entrance: 450,
      exit: 300,
      stagger: 50,
    },
    choreography: {
      preferredPattern: "ripple",
      staggerDirection: "random",
      maxConcurrent: 8,
      overlap: 0.4,
      useSprings: true,
    },
    vocabulary: {
      encouraged: ["bounce", "elastic", "wiggle", "pop", "spin"],
      discouraged: ["linear", "ease-in-out"],
      signature: ["joyful-bounce-in", "playful-pop"],
    },
    colorMotion: {
      enabled: true,
      durationMs: 300,
      easing: "ease-out-back",
      useHarmony: true,
      harmonyType: "triadic",
    },
  },
  {
    id: "dramatic-cinematic",
    name: "Dramatic Cinematic",
    personality: "dramatic",
    description: "Bold, dramatic motions with strong contrasts. Slow builds and sudden releases create cinematic tension.",
    tags: ["dramatic", "cinematic", "bold", "tension"],
    easingFamily: {
      standard: { type: "bezier", p1: [0.7, 0.0], p2: [0.3, 1.0] },
      entrance: { type: "bezier", p1: [0.5, 0.0], p2: [0.0, 1.0] },
      exit: { type: "bezier", p1: [0.5, 0.0], p2: [1.0, 0.5] },
      emphasis: { type: "bezier", p1: [0.0, 0.0], p2: [0.0, 1.0] },
      interactive: { type: "bezier", p1: [0.2, 0.0], p2: [0.2, 1.0] },
      spring: { stiffness: 200, damping: 28, mass: 1.2 },
    },
    timingScale: {
      micro: 200,
      standard: 480,
      extended: 800,
      scene: 1200,
      entrance: 600,
      exit: 480,
      stagger: 80,
    },
    choreography: {
      preferredPattern: "converge",
      staggerDirection: "ttb",
      maxConcurrent: 3,
      overlap: 0.15,
      useSprings: false,
    },
    vocabulary: {
      encouraged: ["zoom", "parallax", "dissolve", "blur", "depth"],
      discouraged: ["bounce", "wiggle", "elastic"],
      signature: ["cinematic-zoom-in", "dramatic-blur-reveal"],
    },
    colorMotion: {
      enabled: true,
      durationMs: 600,
      easing: "ease-in-out",
      useHarmony: true,
      harmonyType: "complementary",
    },
  },
  {
    id: "minimal-clean",
    name: "Minimal Clean",
    personality: "minimal",
    description: "Subtle, restrained motions that respect content. Only what's necessary, nothing more.",
    tags: ["minimal", "clean", "subtle", "restrained"],
    easingFamily: {
      standard: { type: "preset", name: "ease-in-out" },
      entrance: { type: "preset", name: "ease-out" },
      exit: { type: "preset", name: "ease-in" },
      emphasis: { type: "preset", name: "ease-out" },
      interactive: { type: "preset", name: "ease-in-out" },
      spring: { stiffness: 350, damping: 35, mass: 1 },
    },
    timingScale: {
      micro: 100,
      standard: 200,
      extended: 320,
      scene: 400,
      entrance: 280,
      exit: 200,
      stagger: 30,
    },
    choreography: {
      preferredPattern: "cascade",
      staggerDirection: "ttb",
      maxConcurrent: 3,
      overlap: 0.1,
      useSprings: false,
    },
    vocabulary: {
      encouraged: ["fade", "slide", "opacity"],
      discouraged: ["bounce", "elastic", "rotate", "scale-large"],
      signature: ["gentle-fade-in", "subtle-slide-up"],
    },
    colorMotion: {
      enabled: false,
      durationMs: 150,
      easing: "ease-out",
      useHarmony: false,
    },
  },
  {
    id: "luxurious-elegant",
    name: "Luxurious Elegant",
    personality: "luxurious",
    description: "Slow, deliberate motions with refined easing. Each movement feels expensive and considered.",
    tags: ["luxurious", "elegant", "refined", "premium"],
    easingFamily: {
      standard: { type: "bezier", p1: [0.4, 0.0], p2: [0.0, 1.0] },
      entrance: { type: "bezier", p1: [0.0, 0.0], p2: [0.0, 1.0] },
      exit: { type: "bezier", p1: [0.4, 0.0], p2: [1.0, 1.0] },
      emphasis: { type: "bezier", p1: [0.3, 0.0], p2: [0.0, 1.0] },
      interactive: { type: "bezier", p1: [0.4, 0.0], p2: [0.2, 1.0] },
      spring: { stiffness: 120, damping: 25, mass: 1.5 },
    },
    timingScale: {
      micro: 240,
      standard: 520,
      extended: 900,
      scene: 1400,
      entrance: 700,
      exit: 520,
      stagger: 100,
    },
    choreography: {
      preferredPattern: "cascade",
      staggerDirection: "ltr",
      maxConcurrent: 2,
      overlap: 0.25,
      useSprings: true,
    },
    vocabulary: {
      encouraged: ["fade", "scale", "blur", "parallax"],
      discouraged: ["bounce", "snap", "cut", "wiggle"],
      signature: ["elegant-scale-in", "luxurious-blur-reveal"],
    },
    colorMotion: {
      enabled: true,
      durationMs: 700,
      easing: "ease-in-out",
      useHarmony: true,
      harmonyType: "analogous",
    },
  },
  {
    id: "warm-friendly",
    name: "Warm Friendly",
    personality: "warm",
    description: "Gentle, approachable motions that feel human and inviting. Soft curves and comfortable timing.",
    tags: ["warm", "friendly", "approachable", "soft"],
    easingFamily: {
      standard: { type: "preset", name: "ease-in-out" },
      entrance: { type: "preset", name: "ease-out" },
      exit: { type: "preset", name: "ease-in" },
      emphasis: { type: "preset", name: "back" },
      interactive: { type: "preset", name: "ease-out" },
      spring: { stiffness: 200, damping: 22, mass: 1 },
    },
    timingScale: {
      micro: 160,
      standard: 340,
      extended: 520,
      scene: 680,
      entrance: 420,
      exit: 320,
      stagger: 55,
    },
    choreography: {
      preferredPattern: "breathing",
      staggerDirection: "center-out",
      maxConcurrent: 5,
      overlap: 0.3,
      useSprings: true,
    },
    vocabulary: {
      encouraged: ["fade", "scale", "spring", "breathe", "pulse"],
      discouraged: ["snap", "cut", "glitch"],
      signature: ["warm-fade-in", "friendly-pulse"],
    },
    colorMotion: {
      enabled: true,
      durationMs: 350,
      easing: "ease-in-out",
      useHarmony: true,
      harmonyType: "analogous",
    },
  },
  {
    id: "technical-data",
    name: "Technical Data",
    personality: "technical",
    description: "Data-driven motions with precise timing. Suited for dashboards, data viz, and technical interfaces.",
    tags: ["technical", "data", "precise", "dashboard"],
    easingFamily: {
      standard: { type: "bezier", p1: [0.4, 0.0], p2: [0.4, 1.0] },
      entrance: { type: "preset", name: "ease-out" },
      exit: { type: "preset", name: "ease-in" },
      emphasis: { type: "bezier", p1: [0.0, 0.0], p2: [0.0, 1.0] },
      interactive: { type: "preset", name: "ease-out" },
      spring: { stiffness: 500, damping: 40, mass: 1 },
    },
    timingScale: {
      micro: 80,
      standard: 180,
      extended: 300,
      scene: 450,
      entrance: 260,
      exit: 180,
      stagger: 25,
    },
    choreography: {
      preferredPattern: "cascade",
      staggerDirection: "ttb",
      maxConcurrent: 6,
      overlap: 0.15,
      useSprings: false,
    },
    vocabulary: {
      encouraged: ["slide", "fade", "count", "progress", "scale"],
      discouraged: ["bounce", "elastic", "wiggle", "blur"],
      signature: ["data-bar-grow", "counter-roll-up"],
    },
    colorMotion: {
      enabled: true,
      durationMs: 150,
      easing: "ease-out",
      useHarmony: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Personality Configurations
// ---------------------------------------------------------------------------

const PERSONALITY_CONFIG: Record<MotionPersonality, {
  baseEasing: string;
  springStiffness: number;
  springDamping: number;
  baseDuration: number;
  overlap: number;
  maxConcurrent: number;
}> = {
  precise:    { baseEasing: "ease-out",     springStiffness: 400, springDamping: 30, baseDuration: 240, overlap: 0.2,  maxConcurrent: 4 },
  organic:    { baseEasing: "spring",       springStiffness: 180, springDamping: 20, baseDuration: 360, overlap: 0.35, maxConcurrent: 6 },
  playful:    { baseEasing: "ease-out-back", springStiffness: 300, springDamping: 12, baseDuration: 320, overlap: 0.4,  maxConcurrent: 8 },
  dramatic:   { baseEasing: "cubic-bezier(0.7, 0, 0.3, 1)", springStiffness: 200, springDamping: 28, baseDuration: 480, overlap: 0.15, maxConcurrent: 3 },
  minimal:    { baseEasing: "ease-in-out",  springStiffness: 350, springDamping: 35, baseDuration: 200, overlap: 0.1,  maxConcurrent: 3 },
  luxurious:  { baseEasing: "cubic-bezier(0.4, 0, 0, 1)", springStiffness: 120, springDamping: 25, baseDuration: 520, overlap: 0.25, maxConcurrent: 2 },
  technical:  { baseEasing: "ease-out",     springStiffness: 500, springDamping: 40, baseDuration: 180, overlap: 0.15, maxConcurrent: 6 },
  warm:       { baseEasing: "ease-in-out",  springStiffness: 200, springDamping: 22, baseDuration: 340, overlap: 0.3,  maxConcurrent: 5 },
};

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/** List all preset motion themes. */
export function listThemes(): MotionTheme[] {
  return PRESET_THEMES;
}

/** Get a theme by id. */
export function getTheme(id: string): MotionTheme | undefined {
  return PRESET_THEMES.find((t) => t.id === id);
}

/** Get themes by personality. */
export function getThemesByPersonality(personality: MotionPersonality): MotionTheme[] {
  return PRESET_THEMES.filter((t) => t.personality === personality);
}

/**
 * Create a custom motion theme from options.
 * Generates a complete theme based on personality archetype.
 */
export function createTheme(options: CreateThemeOptions): MotionTheme {
  const config = PERSONALITY_CONFIG[options.personality];
  const baseDuration = options.baseDurationMs ?? config.baseDuration;

  const useSprings = options.useSprings ?? (options.personality === "organic" || options.personality === "playful" || options.personality === "warm");

  return {
    id: `custom-${options.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
    name: options.name,
    personality: options.personality,
    description: options.description ?? `${options.personality} motion theme with ${config.baseEasing} easing family.`,
    tags: [options.personality, "custom"],
    easingFamily: {
      standard: { type: "preset", name: config.baseEasing as EasingPreset },
      entrance: { type: "preset", name: useSprings ? "back" as EasingPreset : "ease-out" },
      exit: { type: "preset", name: "ease-in" },
      emphasis: { type: "preset", name: "back" },
      interactive: { type: "preset", name: config.baseEasing as EasingPreset },
      spring: { stiffness: config.springStiffness, damping: config.springDamping, mass: 1 },
    },
    timingScale: {
      micro: Math.round(baseDuration * 0.5),
      standard: baseDuration,
      extended: Math.round(baseDuration * 1.6),
      scene: Math.round(baseDuration * 2.5),
      entrance: Math.round(baseDuration * 1.3),
      exit: Math.round(baseDuration * 0.9),
      stagger: Math.round(baseDuration * 0.15),
    },
    choreography: {
      preferredPattern: options.personality === "playful" ? "ripple" : "cascade",
      staggerDirection: options.staggerDirection ?? "ltr",
      maxConcurrent: config.maxConcurrent,
      overlap: config.overlap,
      useSprings,
    },
    vocabulary: {
      encouraged: getDefaultVocabulary(options.personality),
      discouraged: getDiscouragedVocabulary(options.personality),
      signature: [`${options.personality}-entrance`, `${options.personality}-emphasis`],
    },
    colorMotion: {
      enabled: options.personality !== "minimal" && options.personality !== "technical",
      durationMs: Math.round(baseDuration * 0.6),
      easing: config.baseEasing,
      useHarmony: options.personality !== "minimal" && options.personality !== "technical",
      harmonyType: options.personality === "dramatic" ? "complementary" : "analogous",
    },
  };
}

function getDefaultVocabulary(personality: MotionPersonality): string[] {
  const vocab: Record<MotionPersonality, string[]> = {
    precise: ["slide", "fade", "scale", "rotate"],
    organic: ["morph", "spring", "wave", "ripple"],
    playful: ["bounce", "elastic", "pop", "spin"],
    dramatic: ["zoom", "parallax", "dissolve", "blur"],
    minimal: ["fade", "slide", "opacity"],
    luxurious: ["fade", "scale", "blur", "parallax"],
    technical: ["slide", "fade", "count", "progress"],
    warm: ["fade", "scale", "spring", "breathe"],
  };
  return vocab[personality];
}

function getDiscouragedVocabulary(personality: MotionPersonality): string[] {
  const vocab: Record<MotionPersonality, string[]> = {
    precise: ["bounce", "elastic", "wiggle"],
    organic: ["snap", "cut", "linear"],
    playful: ["linear", "ease-in-out"],
    dramatic: ["bounce", "wiggle", "elastic"],
    minimal: ["bounce", "elastic", "rotate", "scale-large"],
    luxurious: ["bounce", "snap", "cut", "wiggle"],
    technical: ["bounce", "elastic", "wiggle", "blur"],
    warm: ["snap", "cut", "glitch"],
  };
  return vocab[personality];
}

/**
 * Apply a motion theme to a MotionSpec.
 * Adjusts easing, timing, and choreography to match the theme.
 */
export function applyTheme(spec: MotionSpec, theme: MotionTheme): MotionSpec {
  const themedComponents: MotionComponent[] = spec.components.map((comp, index) => {
    // Determine which easing to use based on component position
    let easing: Easing;
    if (index === 0) {
      easing = theme.easingFamily.entrance;
    } else if (index === spec.components.length - 1) {
      easing = theme.easingFamily.exit;
    } else {
      easing = theme.easingFamily.standard;
    }

    // Adjust duration based on timing scale
    let durationMs = comp.durationMs;
    if (comp.durationMs < 200) {
      durationMs = theme.timingScale.micro;
    } else if (comp.durationMs < 500) {
      durationMs = theme.timingScale.standard;
    } else if (comp.durationMs < 1000) {
      durationMs = theme.timingScale.extended;
    } else {
      durationMs = theme.timingScale.scene;
    }

    // Apply stagger delay
    const delayMs = index * theme.timingScale.stagger;

    return {
      ...comp,
      easing,
      durationMs,
      delayMs,
    };
  });

  return {
    ...spec,
    components: themedComponents,
  };
}

/**
 * Analyze how well a spec matches a theme.
 * Returns a compatibility score and suggestions.
 */
export function analyzeThemeCompatibility(spec: MotionSpec, theme: MotionTheme): {
  score: number;
  matched: string[];
  mismatched: string[];
  suggestions: string[];
} {
  const matched: string[] = [];
  const mismatched: string[] = [];
  const suggestions: string[] = [];

  for (const comp of spec.components) {
    const easingName = comp.easing?.type === "preset" ? comp.easing.name : comp.easing?.type ?? "linear";

    // Check easing compatibility
    const encouragedEasings = theme.vocabulary.encouraged;
    const discouragedEasings = theme.vocabulary.discouraged;

    if (encouragedEasings.some((e) => easingName.includes(e))) {
      matched.push(`${comp.name}: easing "${easingName}" fits theme`);
    } else if (discouragedEasings.some((e) => easingName.includes(e))) {
      mismatched.push(`${comp.name}: easing "${easingName}" conflicts with theme`);
      suggestions.push(`Change "${comp.name}" easing to ${theme.easingFamily.standard.type === "preset" ? theme.easingFamily.standard.name : "standard"} to match theme`);
    }

    // Check duration compatibility
    const expectedDuration = theme.timingScale.standard;
    if (Math.abs(comp.durationMs - expectedDuration) > expectedDuration * 0.5) {
      mismatched.push(`${comp.name}: duration ${comp.durationMs}ms differs from theme standard ${expectedDuration}ms`);
    } else {
      matched.push(`${comp.name}: duration ${comp.durationMs}ms aligns with theme`);
    }
  }

  const total = matched.length + mismatched.length;
  const score = total > 0 ? Math.round((matched.length / total) * 100) : 0;

  return { score, matched, mismatched, suggestions };
}

/**
 * Get a summary of a theme as human-readable text.
 */
export function summarizeTheme(theme: MotionTheme): string {
  const lines: string[] = [];
  lines.push(`Theme: "${theme.name}" (${theme.personality})`);
  lines.push(`Description: ${theme.description}`);
  lines.push("");
  lines.push("Easing Family:");
  lines.push(`  Standard: ${theme.easingFamily.standard.type === "preset" ? theme.easingFamily.standard.name : "bezier"}`);
  lines.push(`  Entrance: ${theme.easingFamily.entrance.type === "preset" ? theme.easingFamily.entrance.name : "bezier"}`);
  lines.push(`  Exit: ${theme.easingFamily.exit.type === "preset" ? theme.easingFamily.exit.name : "bezier"}`);
  if (theme.easingFamily.spring) {
    lines.push(`  Spring: stiffness=${theme.easingFamily.spring.stiffness}, damping=${theme.easingFamily.spring.damping}`);
  }
  lines.push("");
  lines.push("Timing Scale:");
  lines.push(`  Micro: ${theme.timingScale.micro}ms | Standard: ${theme.timingScale.standard}ms | Extended: ${theme.timingScale.extended}ms`);
  lines.push(`  Scene: ${theme.timingScale.scene}ms | Entrance: ${theme.timingScale.entrance}ms | Exit: ${theme.timingScale.exit}ms`);
  lines.push(`  Stagger: ${theme.timingScale.stagger}ms`);
  lines.push("");
  lines.push("Choreography:");
  lines.push(`  Pattern: ${theme.choreography.preferredPattern}, Direction: ${theme.choreography.staggerDirection}`);
  lines.push(`  Max concurrent: ${theme.choreography.maxConcurrent}, Overlap: ${Math.round(theme.choreography.overlap * 100)}%`);
  lines.push("");
  lines.push(`Vocabulary: +${theme.vocabulary.encouraged.join(", ")} | -${theme.vocabulary.discouraged.join(", ")}`);
  lines.push(`Signature: ${theme.vocabulary.signature.join(", ")}`);
  return lines.join("\n");
}
