/**
 * Motion Lexicon Engine — a formal token system that translates natural
 * language (English or Chinese) into structured motion parameters.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical duration tokens, ordered from fastest to slowest. */
export type DurationTokenId =
  | "instant"
  | "micro"
  | "standard"
  | "normal"
  | "extended"
  | "cinematic";

/** Canonical easing tokens. */
export type EasingTokenId =
  | "ease-out"
  | "ease-in-out"
  | "spring-soft"
  | "spring-snappy"
  | "linear";

/** The eleven canonical motion categories. */
export type MotionCategoryId =
  | "entrance"
  | "exit"
  | "scroll-reveal"
  | "hover-press"
  | "state-transition"
  | "feedback-delight"
  | "emphasis"
  | "loading"
  | "page-transition"
  | "text-kinetic"
  | "video-transition";

/** Reduced-motion fallback strategy. */
export type ReducedMotionMode = "scale-only" | "crossfade" | "none";

export interface DurationToken {
  id: DurationTokenId;
  label: string;
  /** Inclusive minimum ms for this band. */
  minMs: number;
  /** Inclusive maximum ms for this band. */
  maxMs: number;
  /** Suggested concrete ms inside the band. */
  suggestedMs: number;
  description: string;
}

export interface EasingToken {
  id: EasingTokenId;
  label: string;
  /** CSS cubic-bezier or spring signature, for surfacing in UIs. */
  signature: string;
  description: string;
}

export interface MotionCategory {
  id: MotionCategoryId;
  label: string;
  description: string;
  /** Default duration token when the intent matches this category. */
  defaultDuration: DurationTokenId;
  /** Default easing token when the intent matches this category. */
  defaultEasing: EasingTokenId;
  /** Default reduced-motion fallback for this category. */
  defaultReducedMotion: ReducedMotionMode;
}

/** A natural-language cue that routes to a category. */
interface CategoryCue {
  /** The category this cue routes to. */
  category: MotionCategoryId;
  /** English keywords. */
  en: string[];
  /** Chinese keywords. */
  zh: string[];
  /** Optional easing override when this cue fires. */
  easingOverride?: EasingTokenId;
  /** Optional duration override when this cue fires. */
  durationOverride?: DurationTokenId;
}

/** Full lexicon translation report. */
export interface LexiconReport {
  /** The input that was translated. */
  input: string;
  /** Routed motion category. */
  category: MotionCategoryId;
  /** Resolved duration token. */
  durationToken: DurationToken;
  /** Resolved easing token. */
  easingToken: EasingToken;
  /** Resolved reduced-motion mode. */
  reducedMotionMode: ReducedMotionMode;
  /** Cues (English + Chinese) that fired, in match order. */
  matchedCues: Array<{ cue: string; category: MotionCategoryId }>;
  /** Suggested tool names for this intent. */
  suggestedTools: string[];
  /** One-line summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Token tables
// ---------------------------------------------------------------------------

const DURATION_TOKENS: Record<DurationTokenId, DurationToken> = {
  instant: {
    id: "instant",
    label: "Instant",
    minMs: 80,
    maxMs: 120,
    suggestedMs: 100,
    description: "Immediate feedback — for state changes that must feel synchronous with the trigger.",
  },
  micro: {
    id: "micro",
    label: "Micro",
    minMs: 150,
    maxMs: 250,
    suggestedMs: 200,
    description: "Micro-interactions — hover, press, toggle. Fast enough to feel direct.",
  },
  standard: {
    id: "standard",
    label: "Standard",
    minMs: 300,
    maxMs: 500,
    suggestedMs: 400,
    description: "Default entrance and reveal. The workhorse band.",
  },
  normal: {
    id: "normal",
    label: "Normal",
    minMs: 600,
    maxMs: 900,
    suggestedMs: 700,
    description: "Sustained motion with breathing room — page transitions, modal entries.",
  },
  extended: {
    id: "extended",
    label: "Extended",
    minMs: 1000,
    maxMs: 1500,
    suggestedMs: 1200,
    description: "Deliberate, theatrical motion. Hero moments and signature reveals.",
  },
  cinematic: {
    id: "cinematic",
    label: "Cinematic",
    minMs: 1600,
    maxMs: 2400,
    suggestedMs: 2000,
    description: "Film-grade motion. Reserved for opening title sequences and brand moments.",
  },
};

const EASING_TOKENS: Record<EasingTokenId, EasingToken> = {
  "ease-out": {
    id: "ease-out",
    label: "Ease-out",
    signature: "cubic-bezier(0.16, 1, 0.3, 1)",
    description: "Default entrance easing — fast start, gentle landing. The most universally correct easing for reveals.",
  },
  "ease-in-out": {
    id: "ease-in-out",
    label: "Ease-in-out",
    signature: "cubic-bezier(0.65, 0, 0.35, 1)",
    description: "Symmetric acceleration. Used for state transitions and loops that need a centered apex.",
  },
  "spring-soft": {
    id: "spring-soft",
    label: "Spring (soft)",
    signature: "spring(stiffness=170, damping=26)",
    description: "Soft spring with gentle overshoot — organic, alive, but never jarring.",
  },
  "spring-snappy": {
    id: "spring-snappy",
    label: "Spring (snappy)",
    signature: "spring(stiffness=300, damping=30)",
    description: "Snappy spring with crisp settle — for tactile, energetic entrances.",
  },
  linear: {
    id: "linear",
    label: "Linear",
    signature: "linear",
    description: "Constant velocity — loading spinners, progress bars, and ambient loops only.",
  },
};

const MOTION_CATEGORIES: Record<MotionCategoryId, MotionCategory> = {
  entrance: {
    id: "entrance",
    label: "Entrance",
    description: "Elements arriving on screen for the first time.",
    defaultDuration: "standard",
    defaultEasing: "ease-out",
    defaultReducedMotion: "scale-only",
  },
  exit: {
    id: "exit",
    label: "Exit",
    description: "Elements leaving the screen permanently or temporarily.",
    defaultDuration: "micro",
    defaultEasing: "ease-in-out",
    defaultReducedMotion: "crossfade",
  },
  "scroll-reveal": {
    id: "scroll-reveal",
    label: "Scroll reveal",
    description: "Content revealed as the user scrolls into view.",
    defaultDuration: "standard",
    defaultEasing: "ease-out",
    defaultReducedMotion: "crossfade",
  },
  "hover-press": {
    id: "hover-press",
    label: "Hover / press",
    description: "Micro-feedback on pointer interaction.",
    defaultDuration: "micro",
    defaultEasing: "spring-snappy",
    defaultReducedMotion: "scale-only",
  },
  "state-transition": {
    id: "state-transition",
    label: "State transition",
    description: "Element changing between two persistent states (on/off, open/closed).",
    defaultDuration: "normal",
    defaultEasing: "ease-in-out",
    defaultReducedMotion: "crossfade",
  },
  "feedback-delight": {
    id: "feedback-delight",
    label: "Feedback / delight",
    description: "Reactive confirmation — success, error, completion delight.",
    defaultDuration: "standard",
    defaultEasing: "spring-soft",
    defaultReducedMotion: "scale-only",
  },
  emphasis: {
    id: "emphasis",
    label: "Emphasis",
    description: "Drawing attention to a specific element briefly.",
    defaultDuration: "micro",
    defaultEasing: "spring-snappy",
    defaultReducedMotion: "none",
  },
  loading: {
    id: "loading",
    label: "Loading",
    description: "Indeterminate progress — spinners, skeletons, shimmer.",
    defaultDuration: "normal",
    defaultEasing: "linear",
    defaultReducedMotion: "crossfade",
  },
  "page-transition": {
    id: "page-transition",
    label: "Page transition",
    description: "Navigation between routes or major views.",
    defaultDuration: "normal",
    defaultEasing: "ease-in-out",
    defaultReducedMotion: "crossfade",
  },
  "text-kinetic": {
    id: "text-kinetic",
    label: "Text kinetic",
    description: "Animated typography — typewriter, scramble, split, kinetic typography.",
    defaultDuration: "standard",
    defaultEasing: "ease-out",
    defaultReducedMotion: "crossfade",
  },
  "video-transition": {
    id: "video-transition",
    label: "Video transition",
    description: "Cinematic transitions between shots — whip pan, dissolve, match cut.",
    defaultDuration: "cinematic",
    defaultEasing: "ease-in-out",
    defaultReducedMotion: "crossfade",
  },
};

// ---------------------------------------------------------------------------
// Bilingual intent → category router
// ---------------------------------------------------------------------------

const CATEGORY_CUES: CategoryCue[] = [
  {
    category: "entrance",
    en: ["entrance", "enter", "appear", "arrive", "reveal", "fade in", "slide in", "fly in", "pop in", "drop in", "come in"],
    zh: ["入场", "出现", "淡入", "滑入", "进入", "飞入", "弹出", "降临", "显现", "浮现"],
    easingOverride: "ease-out",
  },
  {
    category: "exit",
    en: ["exit", "leave", "disappear", "fade out", "fly out", "slide out", "vanish", "dismiss", "close"],
    zh: ["退场", "消失", "淡出", "滑出", "离开", "飞出", "弹出", "关闭"],
  },
  {
    category: "scroll-reveal",
    en: ["scroll", "scroll reveal", "in view", "into view", "viewport", "as it appears"],
    zh: ["滚动", "滚动揭示", "进入视野", "视口", "划过"],
  },
  {
    category: "hover-press",
    en: ["hover", "press", "tap", "click", "mousedown", "pointer", "hover state", "丝滑"],
    zh: ["悬停", "按下", "点击", "丝滑", "触摸"],
    easingOverride: "spring-snappy",
    durationOverride: "micro",
  },
  {
    category: "state-transition",
    en: ["toggle", "switch", "expand", "collapse", "open", "close panel", "accordion", "drawer", "modal open"],
    zh: ["切换", "展开", "收起", "折叠", "打开面板", "抽屉", "弹窗"],
  },
  {
    category: "feedback-delight",
    en: ["success", "error", "confirmation", "celebrate", "confetti", "thumbs up", "reward", "delight", "toast"],
    zh: ["成功", "失败", "确认", "庆祝", "彩纸", "点赞", "奖励", "提示"],
    easingOverride: "spring-soft",
  },
  {
    category: "emphasis",
    en: ["emphasize", "highlight", "attention", "spotlight", "pulse", "flash", "blink", "glow"],
    zh: ["强调", "高亮", "注意", "聚光", "闪烁", "发光", "突出"],
  },
  {
    category: "loading",
    en: ["loading", "spinner", "skeleton", "progress", "indeterminate", "shimmer", "fetching"],
    zh: ["加载", "等待", "骨架", "进度", "转圈", "拉取"],
    easingOverride: "linear",
    durationOverride: "normal",
  },
  {
    category: "page-transition",
    en: ["page transition", "route", "navigate", "page change", "view transition", "turn page"],
    zh: ["翻页", "页面切换", "路由", "导航", "转场"],
  },
  {
    category: "text-kinetic",
    en: ["typewriter", "type out", "text animation", "kinetic typography", "scramble text", "split text", "counter"],
    zh: ["打字", "打字机", "文字动画", "数字滚动", "分字", "文字特效"],
  },
  {
    category: "video-transition",
    en: ["cinematic", "whip pan", "match cut", "dissolve", "film", "movie", "shot transition", "trailer"],
    zh: ["电影感", "电影", "镜头切换", "溶解", "转场", "预告片"],
    easingOverride: "ease-in-out",
    durationOverride: "cinematic",
  },
];

/** Modifier cues that nudge the duration or easing without changing category. */
interface ModifierCue {
  /** Token this modifier overrides. */
  kind: "duration" | "easing";
  /** The override value. */
  value: DurationTokenId | EasingTokenId;
  /** English keywords. */
  en: string[];
  /** Chinese keywords. */
  zh: string[];
}

const MODIFIER_CUES: ModifierCue[] = [
  // Duration modifiers.
  { kind: "duration", value: "instant", en: ["instant", "immediate", "instantly", "no delay"], zh: ["立即", "瞬间", "马上"] },
  { kind: "duration", value: "micro", en: ["micro", "very fast", "super fast", "snappy duration"], zh: ["微动", "极快"] },
  { kind: "duration", value: "standard", en: ["standard", "default duration"], zh: ["标准时长"] },
  { kind: "duration", value: "normal", en: ["normal", "moderate"], zh: ["正常", "中等"] },
  { kind: "duration", value: "extended", en: ["extended", "long", "slow", "deliberate"], zh: ["延长", "缓慢", "悠长"] },
  { kind: "duration", value: "cinematic", en: ["cinematic duration", "very slow", "theatrical"], zh: ["电影级时长", "非常慢"] },
  // Easing modifiers.
  { kind: "easing", value: "ease-out", en: ["ease out", "ease-out", "soft landing"], zh: ["缓出", "柔和落地"] },
  { kind: "easing", value: "ease-in-out", en: ["ease in out", "ease-in-out", "symmetric"], zh: ["缓入缓出", "对称"] },
  { kind: "easing", value: "spring-soft", en: ["soft spring", "gentle spring", "organic spring"], zh: ["软弹簧", "柔和弹性"] },
  { kind: "easing", value: "spring-snappy", en: ["snappy spring", "elastic", "bouncy", "lively"], zh: ["弹性", "弹力", "活泼", "弹簧"] },
  { kind: "easing", value: "linear", en: ["linear", "constant speed", "steady"], zh: ["线性", "匀速"] },
  // Premium / advanced — routes to entrance + ease-out (the "高级" cue).
  // (handled in the router as a category-level override)
];

// ---------------------------------------------------------------------------
// Cue matching
// ---------------------------------------------------------------------------

function matchCues(input: string): Array<{ cue: string; category: MotionCategoryId; easingOverride?: EasingTokenId; durationOverride?: DurationTokenId }> {
  const lower = input.toLowerCase();
  const matches: Array<{ cue: string; category: MotionCategoryId; easingOverride?: EasingTokenId; durationOverride?: DurationTokenId }> = [];
  for (const cue of CATEGORY_CUES) {
    for (const kw of cue.en) {
      if (lower.includes(kw.toLowerCase())) {
        matches.push({ cue: kw, category: cue.category, easingOverride: cue.easingOverride, durationOverride: cue.durationOverride });
        break; // one hit per cue group is enough
      }
    }
    if (matches.some((m) => m.category === cue.category)) continue;
    for (const kw of cue.zh) {
      if (input.includes(kw)) {
        matches.push({ cue: kw, category: cue.category, easingOverride: cue.easingOverride, durationOverride: cue.durationOverride });
        break;
      }
    }
  }
  return matches;
}

function matchModifiers(input: string): { duration?: DurationTokenId; easing?: EasingTokenId } {
  const lower = input.toLowerCase();
  const out: { duration?: DurationTokenId; easing?: EasingTokenId } = {};
  for (const mod of MODIFIER_CUES) {
    if (mod.kind === "duration" && out.duration) continue;
    if (mod.kind === "easing" && out.easing) continue;
    let hit = false;
    for (const kw of mod.en) {
      if (lower.includes(kw.toLowerCase())) { hit = true; break; }
    }
    if (!hit) {
      for (const kw of mod.zh) {
        if (input.includes(kw)) { hit = true; break; }
      }
    }
    if (hit) {
      if (mod.kind === "duration") out.duration = mod.value as DurationTokenId;
      else out.easing = mod.value as EasingTokenId;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reduced-motion mode resolution
// ---------------------------------------------------------------------------

function resolveReducedMotion(category: MotionCategoryId, reducedHint?: string): ReducedMotionMode {
  // An explicit hint in the input overrides the category default.
  if (reducedHint) {
    if (/scale.only/i.test(reducedHint)) return "scale-only";
    if (/crossfade|cross.?fade/i.test(reducedHint)) return "crossfade";
    if (/none|no.?fallback/i.test(reducedHint)) return "none";
  }
  return MOTION_CATEGORIES[category].defaultReducedMotion;
}

// ---------------------------------------------------------------------------
// Suggested tools per category
// ---------------------------------------------------------------------------

function suggestToolsForCategory(category: MotionCategoryId): string[] {
  switch (category) {
    case "entrance": return ["add_layer", "set_easing", "set_duration"];
    case "exit": return ["set_easing", "set_duration", "set_keyframe"];
    case "scroll-reveal": return ["add_layer", "set_trigger", "set_easing"];
    case "hover-press": return ["set_trigger", "set_easing", "set_duration"];
    case "state-transition": return ["set_easing", "set_duration", "set_keyframe"];
    case "feedback-delight": return ["apply_preset", "set_easing"];
    case "emphasis": return ["apply_preset", "set_keyframe"];
    case "loading": return ["set_loop", "set_easing"];
    case "page-transition": return ["set_easing", "set_duration", "set_trigger"];
    case "text-kinetic": return ["apply_preset", "set_keyframe"];
    case "video-transition": return ["set_easing", "set_duration", "set_keyframe"];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Translate a natural-language intent into a structured lexicon report.
 *
 * @param input The user's intent string (English or Chinese).
 */
export function translateLexicon(input: string): LexiconReport {
  const text = input.trim();
  const cueMatches = matchCues(text);
  const modifiers = matchModifiers(text);

  // Choose the category — first cue wins, default to entrance.
  const category: MotionCategoryId = cueMatches[0]?.category ?? "entrance";
  const cat = MOTION_CATEGORIES[category];

  // Duration: explicit modifier > cue override > category default.
  const durationId: DurationTokenId = modifiers.duration ?? cueMatches[0]?.durationOverride ?? cat.defaultDuration;
  const durationToken = DURATION_TOKENS[durationId];

  // Easing: explicit modifier > cue override > category default.
  const easingId: EasingTokenId = modifiers.easing ?? cueMatches[0]?.easingOverride ?? cat.defaultEasing;
  const easingToken = EASING_TOKENS[easingId];

  // Reduced-motion mode: detect an explicit hint, else the category default.
  const reducedHint = /\breduced.?motion[\s:]+([a-z-]+)/i.exec(text)?.[1];
  const reducedMotionMode = resolveReducedMotion(category, reducedHint);

  const matchedCues = cueMatches.map((m) => ({ cue: m.cue, category: m.category }));
  const suggestedTools = suggestToolsForCategory(category);

  const summary = formatSummary(text, category, durationId, easingId, reducedMotionMode, matchedCues.length);

  return {
    input: text,
    category,
    durationToken,
    easingToken,
    reducedMotionMode,
    matchedCues,
    suggestedTools,
    summary,
  };
}

function formatSummary(
  input: string,
  category: MotionCategoryId,
  duration: DurationTokenId,
  easing: EasingTokenId,
  reduced: ReducedMotionMode,
  cueCount: number,
): string {
  const catLabel = MOTION_CATEGORIES[category].label;
  const preview = input.length > 40 ? input.slice(0, 40) + "…" : input;
  return [
    `Lexicon: "${preview}" → ${catLabel} / ${duration} / ${easing} / reduced=${reduced}`,
    `(${cueCount} cue${cueCount === 1 ? "" : "s"} matched)`,
  ].join(" ");
}

/** Format the full lexicon report as a readable multi-line string. */
export function formatLexiconReport(report: LexiconReport): string {
  const lines: string[] = [report.summary, ""];
  lines.push(`Category: ${MOTION_CATEGORIES[report.category].label}`);
  lines.push(`  ${MOTION_CATEGORIES[report.category].description}`);
  lines.push("");
  lines.push(`Duration token: ${report.durationToken.label}`);
  lines.push(`  band ${report.durationToken.minMs}–${report.durationToken.maxMs}ms (suggested ${report.durationToken.suggestedMs}ms)`);
  lines.push(`  ${report.durationToken.description}`);
  lines.push("");
  lines.push(`Easing token: ${report.easingToken.label}`);
  lines.push(`  ${report.easingToken.signature}`);
  lines.push(`  ${report.easingToken.description}`);
  lines.push("");
  lines.push(`Reduced-motion mode: ${report.reducedMotionMode}`);
  if (report.matchedCues.length > 0) {
    lines.push("", "Matched cues:");
    for (const c of report.matchedCues) {
      lines.push(`  • "${c.cue}" → ${MOTION_CATEGORIES[c.category].label}`);
    }
  }
  if (report.suggestedTools.length > 0) {
    lines.push("", `Suggested tools: ${report.suggestedTools.join(" → ")}`);
  }
  return lines.join("\n");
}

/** All duration tokens, for UI / manifest endpoints. */
export function listMotionTokens(): { durations: DurationToken[]; easings: EasingToken[] } {
  return {
    durations: Object.values(DURATION_TOKENS),
    easings: Object.values(EASING_TOKENS),
  };
}

/** All motion categories, for UI / manifest endpoints. */
export function listMotionCategories(): MotionCategory[] {
  return Object.values(MOTION_CATEGORIES);
}
