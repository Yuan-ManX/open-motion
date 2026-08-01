/**
 * Platform Motion Presets — motion defaults tailored to specific platforms.
 *
 * Each platform has its own motion language: iOS favors spring-driven easing
 * with generous damping, Android Material favors expressive easing curves with
 * standard durations, macOS favors elastic snaps with conservative timing,
 * and the web favors standard ease curves tuned for 60fps. This file encodes
 * those platform conventions as named presets so a project can switch motion
 * languages by selecting a platform preset.
 *
 * Distinct from stylePresets.ts (aesthetic moods) and brandPack.ts (brand
 * identity): platform presets encode the native motion dialect of a target
 * platform — the easing, timing, spring constants, corner radii, and shadow
 * idioms that make motion feel "at home" on that platform.
 *
 * Original to OpenMotion — translates platform-specific motion design
 * guidelines into a unified, switchable preset system.
 */

import type { Easing } from "@openmotion/shared";
import { easingPreset, easingBezier, easingSpring } from "@openmotion/shared";

/** Target platform identifier. */
export type MotionPlatform = "ios" | "android" | "macos" | "web" | "windows";

/** A platform-specific motion preset. */
export interface PlatformMotionPreset {
  /** Unique preset identifier. */
  id: string;
  /** Target platform. */
  platform: MotionPlatform;
  /** Human-readable preset name. */
  name: string;
  /** Short description of the platform's motion character. */
  description: string;
  /** Standard transition duration (ms). */
  durationMs: number;
  /** Default easing for standard transitions. */
  easing: Easing;
  /** Easing for entrance (elements appearing). */
  entranceEasing: Easing;
  /** Easing for exit (elements disappearing). */
  exitEasing: Easing;
  /** Spring configuration for physics-based motion (when applicable). */
  spring?: { stiffness: number; damping: number; mass: number };
  /** Standard corner radius (px) used by cards and surfaces on this platform. */
  cornerRadius: number;
  /** Standard shadow style for elevated surfaces. */
  shadowStyle: string;
  /** Default stagger step (ms) between sequenced items. */
  staggerStepMs: number;
  /** Tags for search and filtering. */
  tags: string[];
}

export const PLATFORM_MOTION_PRESETS: PlatformMotionPreset[] = [
  {
    id: "platform-ios-swift",
    platform: "ios",
    name: "iOS Spring",
    description: "iOS-native spring with critical damping — fluid, responsive, and physically grounded.",
    durationMs: 500,
    easing: easingSpring(290, 26, 1),
    entranceEasing: easingSpring(290, 26, 1),
    exitEasing: easingBezier([0.32, 0.0], [0.67, 0.0]),
    spring: { stiffness: 290, damping: 26, mass: 1 },
    cornerRadius: 16,
    shadowStyle: "0 2px 8px rgba(0,0,0,0.12)",
    staggerStepMs: 60,
    tags: ["ios", "spring", "apple", "native", "fluid"],
  },
  {
    id: "platform-android-material-expressive",
    platform: "android",
    name: "Android Material Expressive",
    description: "Material Design expressive motion — emphasized easing with standard durations and clear spatial choreography.",
    durationMs: 300,
    easing: easingBezier([0.2, 0.0], [0.0, 1.0]),
    entranceEasing: easingBezier([0.05, 0.7], [0.1, 1.0]),
    exitEasing: easingBezier([0.3, 0.0], [0.8, 0.15]),
    spring: { stiffness: 380, damping: 30, mass: 1 },
    cornerRadius: 12,
    shadowStyle: "0 1px 2px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)",
    staggerStepMs: 50,
    tags: ["android", "material", "google", "expressive"],
  },
  {
    id: "platform-macos-elastic",
    platform: "macos",
    name: "macOS Elastic",
    description: "macOS-native elastic with conservative timing — precise, calm, and professional.",
    durationMs: 400,
    easing: easingBezier([0.25, 0.1], [0.25, 1.0]),
    entranceEasing: easingBezier([0.16, 1.0], [0.3, 1.0]),
    exitEasing: easingBezier([0.7, 0.0], [0.84, 0.0]),
    spring: { stiffness: 200, damping: 28, mass: 1 },
    cornerRadius: 10,
    shadowStyle: "0 1px 4px rgba(0,0,0,0.10)",
    staggerStepMs: 70,
    tags: ["macos", "apple", "elastic", "precise", "desktop"],
  },
  {
    id: "platform-web-standard",
    platform: "web",
    name: "Web Standard",
    description: "Web-native motion tuned for 60fps — ease-out with moderate timing and CSS-friendly curves.",
    durationMs: 250,
    easing: easingPreset("ease-out"),
    entranceEasing: easingPreset("ease-out-quad"),
    exitEasing: easingPreset("ease-in-quad"),
    cornerRadius: 8,
    shadowStyle: "0 1px 3px rgba(0,0,0,0.10)",
    staggerStepMs: 40,
    tags: ["web", "css", "standard", "browser"],
  },
  {
    id: "platform-windows-fluent",
    platform: "windows",
    name: "Windows Fluent",
    description: "Fluent Design motion — quick, connected, and depth-aware with a slight overshoot on entrances.",
    durationMs: 300,
    easing: easingBezier([0.1, 0.9], [0.2, 1.0]),
    entranceEasing: easingBezier([0.075, 0.82], [0.165, 1.0]),
    exitEasing: easingBezier([0.42, 0.0], [0.58, 1.0]),
    spring: { stiffness: 320, damping: 28, mass: 1 },
    cornerRadius: 7,
    shadowStyle: "0 2px 6px rgba(0,0,0,0.18)",
    staggerStepMs: 45,
    tags: ["windows", "fluent", "microsoft", "desktop"],
  },
];

/** List all platform presets, optionally filtered by platform. */
export function listPlatformPresets(platform?: MotionPlatform): PlatformMotionPreset[] {
  if (!platform) return PLATFORM_MOTION_PRESETS;
  return PLATFORM_MOTION_PRESETS.filter((p) => p.platform === platform);
}

/** Get a single platform preset by id. */
export function getPlatformPreset(id: string): PlatformMotionPreset | undefined {
  return PLATFORM_MOTION_PRESETS.find((p) => p.id === id);
}

/** Get the default preset for a platform (first match wins). */
export function getDefaultPlatformPreset(platform: MotionPlatform): PlatformMotionPreset | undefined {
  return PLATFORM_MOTION_PRESETS.find((p) => p.platform === platform);
}

/**
 * Pick the platform preset whose tags best match a free-text query. Useful
 * when the agent receives a natural-language hint like "make this feel like
 * an iOS app" — the matcher scores each preset's tags + platform + name.
 */
export function matchPlatformPreset(query: string): PlatformMotionPreset | undefined {
  const q = query.toLowerCase();
  let best: PlatformMotionPreset | undefined;
  let bestScore = 0;
  for (const preset of PLATFORM_MOTION_PRESETS) {
    let score = 0;
    if (preset.platform.toLowerCase().includes(q)) score += 50;
    if (preset.name.toLowerCase().includes(q)) score += 30;
    for (const tag of preset.tags) {
      if (tag.toLowerCase().includes(q)) score += 20;
    }
    if (score > bestScore) {
      bestScore = score;
      best = preset;
    }
  }
  return best;
}
