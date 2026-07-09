/**
 * Intent classification and alias resolution for the agent.
 * Centralizes the mapping from natural-language terms to concrete template IDs
 * and preset names so the mock provider and system prompt stay in sync.
 */

export type IntentType =
  | "tune"
  | "template"
  | "structure"
  | "export"
  | "preset"
  | "playback"
  | "query"
  | "describe"
  | "scene"
  | "unknown";

/** Friendly name -> real template ID. Single source of truth for aliasing. */
export const TEMPLATE_ALIASES: Record<string, string> = {
  fade: "tpl-fade-in",
  "fade-in": "tpl-fade-in",
  "fadein": "tpl-fade-in",
  slide: "tpl-slide-up",
  "slide-up": "tpl-slide-up",
  "slideup": "tpl-slide-up",
  bounce: "tpl-bounce-in",
  "bounce-in": "tpl-bounce-in",
  "bouncein": "tpl-bounce-in",
  scale: "tpl-scale-in",
  "scale-in": "tpl-scale-in",
  "scalein": "tpl-scale-in",
  rotate: "tpl-flip-in",
  flip: "tpl-flip-in",
  "flip-in": "tpl-flip-in",
  spin: "tpl-spin",
  pulse: "tpl-pulse",
  spring: "tpl-spring",
  resize: "tpl-resize",
  "logo-reveal": "tpl-logo-reveal",
  logoreveal: "tpl-logo-reveal",
  logo: "tpl-logo-reveal",
  "squash-stretch": "tpl-squash-stretch",
  squashstretch: "tpl-squash-stretch",
  squash: "tpl-squash-stretch",
  "flip-card": "tpl-flip-card",
  flipcard: "tpl-flip-card",
  typewriter: "tpl-typewriter",
  "type-writer": "tpl-typewriter",
  shimmer: "tpl-shimmer",
  morph: "tpl-morph",
  notification: "tpl-notification",
  toast: "tpl-notification",
  progress: "tpl-progress",
  "progress-bar": "tpl-progress",
  progressbar: "tpl-progress",
  bar: "tpl-progress",
  ripple: "tpl-ripple",
  marquee: "tpl-marquee",
  ticker: "tpl-marquee",
  scroll: "tpl-marquee",
  "scrolling-text": "tpl-marquee",
};

/** Friendly name -> preset name (used by apply_preset). */
export const PRESET_ALIASES: Record<string, string> = {
  shake: "shake",
  wiggle: "wiggle",
  float: "float",
  glow: "glow",
  heartbeat: "heartbeat",
  "heart-beat": "heartbeat",
  typewriter: "typewriter",
  "type-writer": "typewriter",
};

/**
 * Resolve a raw user-provided template name to a real template ID.
 * Returns null when no alias matches so callers can fall back gracefully.
 */
export function resolveTemplateId(raw: string): string | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "-");
  if (TEMPLATE_ALIASES[normalized]) return TEMPLATE_ALIASES[normalized];
  // Try without hyphen normalization for compound words the user may have joined.
  const joined = normalized.replace(/-/g, "");
  if (TEMPLATE_ALIASES[joined]) return TEMPLATE_ALIASES[joined];
  // If the raw input already looks like a template ID, pass it through.
  if (normalized.startsWith("tpl-")) return normalized;
  return null;
}

/** Resolve a raw preset name to a canonical preset name. */
export function resolvePresetName(raw: string): string | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "-");
  return PRESET_ALIASES[normalized] ?? null;
}

const INTENT_PATTERNS: { type: IntentType; match: RegExp }[] = [
  { type: "export", match: /\b(export|download|导出|下载)\b/i },
  { type: "describe", match: /\b(describe|what.*look|explain|dna|characterize)\b|描述|什么样/i },
  { type: "scene", match: /\b(scene|scenes)\b|场景/i },
  { type: "template", match: /\b(template|模板)\b/i },
  { type: "preset", match: /\b(shake|wiggle|float|glow|heartbeat|preset)\b/i },
  { type: "structure", match: /\b(add|create|new|remove|delete|duplicate|copy|clone|reorder|layer|element|component|scene)\b/i },
  { type: "playback", match: /\b(pause|play|stop|resume|running|paused)\b/i },
  { type: "tune", match: /\b(easing|spring|duration|delay|loop|repeat|fill|color|width|height|radius|transform|keyframe|bouncy|smooth|snappy|slower|faster|red|blue|green)\b/i },
  { type: "query", match: /\b(spec|state|current|status|list|show|browse|preview|what)\b/i },
];

/** Classify the primary intent of a user message. */
export function classifyIntent(text: string): IntentType {
  for (const { type, match } of INTENT_PATTERNS) {
    if (match.test(text)) return type;
  }
  return "unknown";
}
