/**
 * Motion Profile system — per-component personality descriptors that guide
 * context-aware motion decisions. Each profile assigns a role (hero, supporting,
 * background, CTA, etc.), temperament (bold, subtle, urgent, calm), interaction
 * style, and visual weight to a component.
 *
 * When the Agent tunes a component, it can reference the profile to choose
 * appropriate easing, duration, and trigger — e.g., a "hero" component gets
 * generous timing and emphasis easing, while a "background" element stays
 * subtle and ambient.
 */

import type { Easing, MotionComponent } from "@openmotion/shared";
import { easingPreset, easingBezier, easingSpring } from "@openmotion/shared";

export type ComponentRole =
  | "hero"
  | "supporting"
  | "background"
  | "cta"
  | "decorative"
  | "data"
  | "navigation";

export type Temperament =
  | "bold"
  | "subtle"
  | "urgent"
  | "calm"
  | "playful"
  | "precise"
  | "dramatic"
  | "friendly";

export type InteractionStyle = "passive" | "reactive" | "interactive";

export interface MotionProfile {
  componentId: string;
  role: ComponentRole;
  temperament: Temperament;
  interactionStyle: InteractionStyle;
  visualWeight: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const PROFILES_KEY = "__motionProfiles";

/** Read motion profiles from project tokens. */
export function readMotionProfiles(
  tokens: Record<string, string | number>,
): MotionProfile[] {
  const raw = tokens[PROFILES_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as MotionProfile[];
  } catch {
    return [];
  }
}

/** Write motion profiles to tokens. */
export function writeMotionProfiles(
  tokens: Record<string, string | number>,
  profiles: MotionProfile[],
): Record<string, string | number> {
  return { ...tokens, [PROFILES_KEY]: JSON.stringify(profiles) };
}

/** Find a profile by component ID. */
export function findMotionProfile(
  componentId: string,
  tokens: Record<string, string | number>,
): MotionProfile | undefined {
  return readMotionProfiles(tokens).find((p) => p.componentId === componentId);
}

/** Set or update a motion profile for a component. */
export function setMotionProfile(
  componentId: string,
  patch: Partial<Omit<MotionProfile, "componentId" | "createdAt">>,
  tokens: Record<string, string | number>,
): { profile: MotionProfile; tokens: Record<string, string | number> } {
  const profiles = readMotionProfiles(tokens);
  const existing = profiles.find((p) => p.componentId === componentId);
  const now = new Date().toISOString();
  const profile: MotionProfile = existing
    ? { ...existing, ...patch, updatedAt: now }
    : {
        componentId,
        role: patch.role ?? "supporting",
        temperament: patch.temperament ?? "calm",
        interactionStyle: patch.interactionStyle ?? "passive",
        visualWeight: patch.visualWeight ?? 5,
        notes: patch.notes ?? "",
        createdAt: now,
        updatedAt: now,
      };
  const updated = existing
    ? profiles.map((p) => (p.componentId === componentId ? profile : p))
    : [...profiles, profile];
  return { profile, tokens: writeMotionProfiles(tokens, updated) };
}

/** Delete a motion profile by component ID. */
export function deleteMotionProfile(
  componentId: string,
  tokens: Record<string, string | number>,
): Record<string, string | number> {
  const profiles = readMotionProfiles(tokens).filter((p) => p.componentId !== componentId);
  return writeMotionProfiles(tokens, profiles);
}

/**
 * Suggest a motion profile based on component name and properties.
 * Uses keyword matching to infer role and temperament.
 */
export function suggestMotionProfile(component: MotionComponent): Partial<MotionProfile> {
  const name = component.name.toLowerCase();
  const suggestion: Partial<MotionProfile> = {};

  // Infer role from name
  if (/\b(hero|title|headline|main|primary|featured)\b/.test(name)) {
    suggestion.role = "hero";
    suggestion.visualWeight = 9;
  } else if (/\b(cta|button|action|submit|sign.?up|buy|purchase|click)\b/.test(name)) {
    suggestion.role = "cta";
    suggestion.visualWeight = 8;
  } else if (/\b(bg|background|ambient|wallpaper|backdrop)\b/.test(name)) {
    suggestion.role = "background";
    suggestion.visualWeight = 2;
  } else if (/\b(nav|menu|sidebar|header|footer|tab|breadcrumb)\b/.test(name)) {
    suggestion.role = "navigation";
    suggestion.visualWeight = 4;
  } else if (/\b(data|chart|graph|table|stat|metric|number)\b/.test(name)) {
    suggestion.role = "data";
    suggestion.visualWeight = 6;
  } else if (/\b(decor|ornament|accent|sparkle|particle|confetti)\b/.test(name)) {
    suggestion.role = "decorative";
    suggestion.visualWeight = 3;
  } else {
    suggestion.role = "supporting";
    suggestion.visualWeight = 5;
  }

  // Infer temperament from name
  if (/\b(bold|big|large|huge|massive|epic)\b/.test(name)) {
    suggestion.temperament = "bold";
  } else if (/\b(subtle|gentle|soft|quiet|whisper)\b/.test(name)) {
    suggestion.temperament = "subtle";
  } else if (/\b(urgent|alert|warning|error|danger|critical)\b/.test(name)) {
    suggestion.temperament = "urgent";
  } else if (/\b(calm|peaceful|serene|tranquil|meditate)\b/.test(name)) {
    suggestion.temperament = "calm";
  } else if (/\b(fun|play|game|joy|happy|celebrate)\b/.test(name)) {
    suggestion.temperament = "playful";
  } else if (/\b(precise|exact|technical|data|metric|measurement)\b/.test(name)) {
    suggestion.temperament = "precise";
  } else if (/\b(drama|cinematic|epic|grand|majestic)\b/.test(name)) {
    suggestion.temperament = "dramatic";
  } else if (/\b(friendly|welcome|hello|greet|invite)\b/.test(name)) {
    suggestion.temperament = "friendly";
  } else {
    suggestion.temperament = "calm";
  }

  // Infer interaction style from trigger
  if (component.trigger === "onClick") {
    suggestion.interactionStyle = "interactive";
  } else if (component.trigger === "onHover" || component.trigger === "onScroll") {
    suggestion.interactionStyle = "reactive";
  } else {
    suggestion.interactionStyle = "passive";
  }

  return suggestion;
}

/**
 * Translate a motion profile into motion parameter suggestions.
 * Returns a patch that can be applied to a component.
 */
export function profileToMotionPatch(profile: MotionProfile): {
  easing: Easing;
  durationMs: number;
  trigger: string;
  iterationCount: number | "infinite";
} {
  const { role, temperament, visualWeight } = profile;

  // Duration based on role and visual weight
  let durationMs: number;
  switch (role) {
    case "hero":
      durationMs = 600 + visualWeight * 50;
      break;
    case "cta":
      durationMs = 200 + visualWeight * 20;
      break;
    case "background":
      durationMs = 2000 + visualWeight * 200;
      break;
    case "navigation":
      durationMs = 200 + visualWeight * 15;
      break;
    case "data":
      durationMs = 300 + visualWeight * 30;
      break;
    case "decorative":
      durationMs = 800 + visualWeight * 100;
      break;
    default:
      durationMs = 400 + visualWeight * 40;
  }

  // Easing based on temperament
  let easing: Easing;
  switch (temperament) {
    case "bold":
      easing = easingPreset("back");
      break;
    case "subtle":
      easing = easingPreset("smooth");
      break;
    case "urgent":
      easing = easingPreset("snappy");
      break;
    case "calm":
      easing = easingBezier([0.4, 0], [0.2, 1]);
      break;
    case "playful":
      easing = easingSpring(400, 12, 1);
      break;
    case "precise":
      easing = easingPreset("linear");
      break;
    case "dramatic":
      easing = easingBezier([0.16, 1], [0.3, 1]);
      break;
    case "friendly":
      easing = easingPreset("ease-out");
      break;
    default:
      easing = easingPreset("ease-out");
  }

  // Trigger based on interaction style
  let trigger: string;
  switch (profile.interactionStyle) {
    case "interactive":
      trigger = "onClick";
      break;
    case "reactive":
      trigger = role === "background" ? "onScroll" : "onHover";
      break;
    default:
      trigger = "onLoad";
  }

  // Loop based on role
  let iterationCount: number | "infinite";
  if (role === "background" || role === "decorative") {
    iterationCount = "infinite";
  } else {
    iterationCount = 1;
  }

  return { easing, durationMs, trigger, iterationCount };
}

/** Summarize profiles for display. */
export function summarizeMotionProfiles(
  tokens: Record<string, string | number>,
): Array<Pick<MotionProfile, "componentId" | "role" | "temperament" | "interactionStyle" | "visualWeight">> {
  return readMotionProfiles(tokens).map((p) => ({
    componentId: p.componentId,
    role: p.role,
    temperament: p.temperament,
    interactionStyle: p.interactionStyle,
    visualWeight: p.visualWeight,
  }));
}
