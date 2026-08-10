/** Accessibility Motion Profiles — named, reusable constraint profiles that define safe motion envelopes for accessibility contexts. */

/** When to apply this profile. */
export type AccessibilityProfileContext =
  | "vestibular-safe"
  | "reduced-motion"
  | "seizure-safe"
  | "cognitive-load"
  | "low-bandwidth"
  | "default";

/** A named accessibility motion profile. */
export interface AccessibilityProfile {
  /** Unique profile identifier. */
  id: string;
  /** Human-readable profile name. */
  name: string;
  /** Context this profile is designed for. */
  context: AccessibilityProfileContext;
  /** Short description of who benefits and when to apply. */
  description: string;
  /** Maximum safe translation distance (px) per animation. */
  maxDisplacementPx: number;
  /** Maximum safe rotation (degrees) per animation. */
  maxRotationDeg: number;
  /** Maximum opacity change frequency (Hz) before seizure risk. */
  maxOpacityFrequencyHz: number;
  /** Maximum safe duration (ms) — longer animations can fatigue users. */
  maxDurationMs: number;
  /** Maximum simultaneous active animations before cognitive overload. */
  maxSimultaneousAnimations: number;
  /** Whether infinite loops are permitted. */
  allowLoops: boolean;
  /** Whether parallax layers are permitted. */
  allowParallax: boolean;
  /** Whether to simplify multi-keyframe easing to single ease curves. */
  simplifyEasing: boolean;
  /** Whether to disable spring physics overshoot. */
  disableOvershoot: boolean;
  /** Motion categories discouraged under this profile. */
  discouragedCategories: string[];
  /** Tags for search and filtering. */
  tags: string[];
}

export const ACCESSIBILITY_PROFILES: AccessibilityProfile[] = [
  {
    id: "a11y-default",
    name: "Default (WCAG baseline)",
    context: "default",
    description: "Baseline motion safety following WCAG 2.3.1 — allows most motion but blocks flashing above 3Hz and large unbroken displacements.",
    maxDisplacementPx: 300,
    maxRotationDeg: 180,
    maxOpacityFrequencyHz: 3,
    maxDurationMs: 4000,
    maxSimultaneousAnimations: 8,
    allowLoops: true,
    allowParallax: true,
    simplifyEasing: false,
    disableOvershoot: false,
    discouragedCategories: [],
    tags: ["default", "wcag", "baseline"],
  },
  {
    id: "a11y-vestibular-safe",
    name: "Vestibular Safe",
    context: "vestibular-safe",
    description: "For users with vestibular disorders — limits displacement, rotation, and parallax that trigger motion sickness.",
    maxDisplacementPx: 100,
    maxRotationDeg: 45,
    maxOpacityFrequencyHz: 2,
    maxDurationMs: 1500,
    maxSimultaneousAnimations: 3,
    allowLoops: false,
    allowParallax: false,
    simplifyEasing: true,
    disableOvershoot: true,
    discouragedCategories: ["parallax", "spin", "rotate", "marquee", "page-flip"],
    tags: ["vestibular", "motion-sickness", "safe", "accessibility"],
  },
  {
    id: "a11y-reduced-motion",
    name: "Reduced Motion",
    context: "reduced-motion",
    description: "Honors prefers-reduced-motion — collapses motion to opacity-only fades with minimal displacement and no loops.",
    maxDisplacementPx: 30,
    maxRotationDeg: 0,
    maxOpacityFrequencyHz: 1,
    maxDurationMs: 800,
    maxSimultaneousAnimations: 2,
    allowLoops: false,
    allowParallax: false,
    simplifyEasing: true,
    disableOvershoot: true,
    discouragedCategories: ["slide", "scale", "rotate", "spin", "bounce", "spring", "parallax", "glitch"],
    tags: ["reduced-motion", "prefers-reduced-motion", "accessibility"],
  },
  {
    id: "a11y-seizure-safe",
    name: "Seizure Safe",
    context: "seizure-safe",
    description: "For photosensitive users — strictly limits flashing frequency, opacity changes, and high-contrast color cycling.",
    maxDisplacementPx: 300,
    maxRotationDeg: 180,
    maxOpacityFrequencyHz: 1.5,
    maxDurationMs: 4000,
    maxSimultaneousAnimations: 4,
    allowLoops: false,
    allowParallax: true,
    simplifyEasing: false,
    disableOvershoot: false,
    discouragedCategories: ["glitch", "chromatic", "strobe", "neon-flicker", "flash"],
    tags: ["seizure", "photosensitive", "flashing", "safe", "accessibility"],
  },
  {
    id: "a11y-cognitive-load",
    name: "Low Cognitive Load",
    context: "cognitive-load",
    description: "For users with cognitive load sensitivities (ADHD, etc.) — limits simultaneous animations and staggered sequences that overwhelm attention.",
    maxDisplacementPx: 200,
    maxRotationDeg: 90,
    maxOpacityFrequencyHz: 2,
    maxDurationMs: 2500,
    maxSimultaneousAnimations: 3,
    allowLoops: true,
    allowParallax: true,
    simplifyEasing: true,
    disableOvershoot: false,
    discouragedCategories: ["choreography-cascade", "choreography-wave", "particle-burst", "data-stream"],
    tags: ["cognitive", "adhd", "attention", "load", "accessibility"],
  },
  {
    id: "a11y-low-bandwidth",
    name: "Low Bandwidth / Performance",
    context: "low-bandwidth",
    description: "For low-power devices and slow connections — caps complexity, disables heavy shader/3D, and shortens durations to reduce render load.",
    maxDisplacementPx: 200,
    maxRotationDeg: 90,
    maxOpacityFrequencyHz: 2,
    maxDurationMs: 1200,
    maxSimultaneousAnimations: 3,
    allowLoops: false,
    allowParallax: false,
    simplifyEasing: true,
    disableOvershoot: true,
    discouragedCategories: ["shader", "3d", "particle", "hologram", "liquid", "aurora"],
    tags: ["performance", "low-bandwidth", "low-power", "efficiency"],
  },
];

/** List all accessibility profiles, optionally filtered by context. */
export function listAccessibilityProfiles(context?: AccessibilityProfileContext): AccessibilityProfile[] {
  if (!context) return ACCESSIBILITY_PROFILES;
  return ACCESSIBILITY_PROFILES.filter((p) => p.context === context);
}

/** Get a single profile by id. */
export function getAccessibilityProfile(id: string): AccessibilityProfile | undefined {
  return ACCESSIBILITY_PROFILES.find((p) => p.id === id);
}

/** Get the default profile (the WCAG baseline). */
export function getDefaultAccessibilityProfile(): AccessibilityProfile {
  return ACCESSIBILITY_PROFILES[0];
}

/**
 * Pick the most permissive profile that still satisfies a set of constraints.
 * Useful when multiple accessibility considerations apply (e.g. vestibular +
 * cognitive) — the intersection of two profiles is the more restrictive one.
 */
export function pickStrictestProfile(profiles: AccessibilityProfile[]): AccessibilityProfile {
  if (profiles.length === 0) return getDefaultAccessibilityProfile();
  return profiles.reduce((strictest, current) =>
    current.maxDisplacementPx < strictest.maxDisplacementPx
    || (current.maxDisplacementPx === strictest.maxDisplacementPx
      && current.maxSimultaneousAnimations < strictest.maxSimultaneousAnimations)
      ? current
      : strictest,
  );
}
