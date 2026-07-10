/**
 * Intent classification and alias resolution for the agent.
 * Centralizes the mapping from natural-language terms to concrete template IDs
 * and preset names so the mock provider and system prompt stay in sync.
 */

export type IntentType =
  | "tune"
  | "template"
  | "structure"
  | "composition"
  | "export"
  | "preset"
  | "playback"
  | "query"
  | "describe"
  | "scene"
  | "analysis"
  | "path"
  | "style"
  | "pattern"
  | "color"
  | "choreography"
  | "refine"
  | "bezier"
  | "interpolation"
  | "keyframe_edit"
  | "trigger"
  | "onion_skin"
  | "preview_fullscreen"
  | "canvas_view"
  | "lock"
  | "z_order"
  | "transform_props"
  | "align"
  | "playback_range"
  | "select"
  | "snap"
  | "shape"
  | "blend_mode"
  | "artboard"
  | "layer_opacity"
  | "rulers"
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
  spinner: "tpl-spin",
  "loading-spinner": "tpl-spin",
  loading: "tpl-spin",
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
  orbit: "tpl-orbit",
  circular: "tpl-orbit",
  "circular-motion": "tpl-orbit",
  wave: "tpl-wave",
  sine: "tpl-wave",
  oscillate: "tpl-wave",
  confetti: "tpl-confetti",
  celebration: "tpl-confetti",
  celebrate: "tpl-confetti",
  burst: "tpl-confetti",
  parallax: "tpl-parallax",
  "kinetic-text": "tpl-kinetic-text",
  kinetic: "tpl-kinetic-text",
  typography: "tpl-kinetic-text",
  "particle-burst": "tpl-particle-burst",
  particles: "tpl-particle-burst",
  "liquid-morph": "tpl-liquid-morph",
  liquid: "tpl-liquid-morph",
  blob: "tpl-liquid-morph",
  "elastic-collapse": "tpl-elastic-collapse",
  collapse: "tpl-elastic-collapse",
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
  { type: "analysis", match: /\b(analyze|review|critique|quality|is this good|score|insight)\b/i },
  { type: "path", match: /\b(orbit|circle|ellipse|along.*path|trajectory|fly across|move in a)\b/i },
  { type: "style", match: /\b(playful|energetic|calm|professional|dramatic|minimal|style.*preset|style.*project|give it a .* feel|make it .* feel)\b/i },
  { type: "pattern", match: /\b(patterns?|composition balanced|what.s missing|monoton\w*|balance|coherent)\b/i },
  { type: "color", match: /\b(harmoniz\w*|color scheme|colors work together|palette|color theory|complementary|analogous|triadic|monochrome)\b/i },
  { type: "choreography", match: /\b(choreograph|orchestrat|wave pattern|ripple effect|cascade|canon|converge)\b/i },
  { type: "refine", match: /\b(snappier|smoother|more dramatic|calmer|subtler|more energetic|bouncier|softer)\b/i },
  { type: "bezier", match: /\b(custom.*easing|bezier|cubic.bezier|easing curve|control point)\b/i },
  { type: "interpolation", match: /\b(interpolation|linear.*keyframe|hold.*keyframe|step.*keyframe)\b/i },
  { type: "keyframe_edit", match: /\b(add.*keyframe|remove.*keyframe|delete.*keyframe|keyframe.*opacity|keyframe.*scale|keyframe.*position|keyframe.*offset)\b/i },
  { type: "trigger", match: /\b(trigger|on click|on hover|on scroll|on load|after delay|play on|animate on|when.*click|when.*hover|when.*scroll)\b/i },
  { type: "onion_skin", match: /\b(onion.*skins?|ghost frame|motion trail|show.*trail)/i },
  { type: "preview_fullscreen", match: /\b(fullscreen|full screen|present|present mode|preview.*full|big preview)\b/i },
  { type: "canvas_view", match: /\b(zoom\s*(in|out)|fit.*screen|frame.*select|reset.*view|pan\s*canvas|canvas.*view)\b/i },
  { type: "lock", match: /\b(lock|unlock|lock.*layer)\b/i },
  { type: "z_order", match: /\b(bring.*front|send.*back|move.*forward|move.*backward|z.?order|to.?front|to.?back)\b/i },
  { type: "transform_props", match: /\b(set.*position|set.*x\b|set.*y\b|set.*width|set.*height|set.*rotation|rotate.*deg|position.*to|resize.*to)\b/i },
  { type: "align", match: /\b(align|distribute)\s*(left|right|center|top|bottom|middle|horizontal|vertical|h|v)?\b/i },
  { type: "playback_range", match: /\b(playback.*range|set.*range|in.*point|out.*point|trim|loop.*range|clear.*range)\b/i },
  { type: "select", match: /\b(select.*all|select.*everything|multi.?select|select.*multiple)\b/i },
  { type: "snap", match: /\b(snap|snap.*grid|toggle.*snap|magnet)\b/i },
  { type: "shape", match: /\b(add.*rectangle|add.*circle|add.*text|add.*triangle|add.*star|add.*pentagon|add.*polygon|add.*line|add.*arrow|create.*shape|create.*rectangle|create.*circle|create.*triangle|create.*star|draw.*shape)\b/i },
  { type: "blend_mode", match: /\b(blend.*mode|mix.*blend|set.*blend|blend.*with|multiply|screen|overlay|darken|lighten|color.?dodge|color.?burn|hard.?light|soft.?light|difference|exclusion|luminosity)\b/i },
  { type: "artboard", match: /\b(canvas|artboard|stage.*size|set.*width|set.*height|canvas.*size|canvas.*background|artboard.*size)\b/i },
  { type: "layer_opacity", match: /\b(set.*opacity|layer.*opacity|opacity.*to|make.*transparent|make.*opaque)\b/i },
  { type: "rulers", match: /\b(ruler|toggle.*ruler|show.*ruler|hide.*ruler|guide)\b/i },
  { type: "composition", match: /\b(stagger|cascade|sequence|one by one|variant|variation|alternative)\b|错开|依次|逐个|变体/i },
  { type: "scene", match: /\b(scene|scenes)\b|场景/i },
  { type: "template", match: /\b(template|模板)\b/i },
  { type: "preset", match: /\b(shake|wiggle|float|glow|heartbeat|preset)\b/i },
  { type: "structure", match: /\b(add|create|new|remove|delete|duplicate|copy|clone|reorder|layer|element|component|scene)\b/i },
  { type: "playback", match: /\b(pause|play|stop|resume|running|paused)\b/i },
  { type: "tune", match: /\b(easing|spring|duration|delay|loop|repeat|fill|color|width|height|radius|transform|keyframe|bouncy|smooth|snappy|slower|faster|red|blue|green)\b/i },
  { type: "query", match: /\b(spec|state|current|status|list|show|browse|preview|what|suggest|ideas?)\b/i },
];

/** Classify the primary intent of a user message. */
export function classifyIntent(text: string): IntentType {
  for (const { type, match } of INTENT_PATTERNS) {
    if (match.test(text)) return type;
  }
  return "unknown";
}
