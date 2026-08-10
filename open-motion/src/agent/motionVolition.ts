/**
 * Motion Volition Engine — decides whether the agent should act, ask, defer,
 * or refine before committing to a tool sequence.
 */

import type { MotionSpec } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VolitionMode = "act" | "ask" | "defer" | "refine";

/** A single ambiguity signal that lowers action readiness. */
export interface AmbiguitySignal {
  /** Canonical signal id. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** How much this signal lowers readiness (0..1). */
  severity: number;
  /** What was observed. */
  observation: string;
}

/** A bounded clarifying question the agent may ask instead of acting. */
export interface ClarifyingQuestion {
  /** The question, phrased to resolve the dominant ambiguity. */
  question: string;
  /** Which ambiguity signal prompted it. */
  resolves: string;
  /** 2-4 concrete options the user could pick. */
  options: string[];
}

/** A cleaner re-expression of the user's intent (for REFINE mode). */
export interface RefinedIntent {
  /** The re-expressed intent. */
  refined: string;
  /** What was clarified by the refinement. */
  changes: string[];
}

/** Full volition report. */
export interface VolitionReport {
  /** The input that was evaluated. */
  input: string;
  /** Chosen volition mode. */
  mode: VolitionMode;
  /** Action readiness 0..1. */
  readiness: number;
  /** Stall risk 0..1. */
  stallRisk: number;
  /** Estimated regret (expected undo count) if the agent acts now. */
  regretEstimate: number;
  /** Detected ambiguity signals, sorted by severity descending. */
  ambiguities: AmbiguitySignal[];
  /** The clarifying question to ask, when mode is ASK. Null otherwise. */
  clarifyingQuestion: ClarifyingQuestion | null;
  /** The refined intent, when mode is REFINE. Null otherwise. */
  refinedIntent: RefinedIntent | null;
  /** Suggested tool names to execute, when mode is ACT. Empty otherwise. */
  suggestedTools: string[];
  /** One-line rationale for the chosen mode. */
  rationale: string;
  /** Summary string. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Spec features used by volition
// ---------------------------------------------------------------------------

interface SpecSignals {
  isEmpty: boolean;
  componentCount: number;
  hasSelection: boolean;
  hasScenes: boolean;
  hasBpm: boolean;
}

function readSpecSignals(spec: MotionSpec | null): SpecSignals {
  if (!spec) {
    return { isEmpty: true, componentCount: 0, hasSelection: false, hasScenes: false, hasBpm: false };
  }
  const components = spec.components ?? [];
  return {
    isEmpty: components.length === 0,
    componentCount: components.length,
    hasSelection: components.length > 0,
    hasScenes: (spec.project?.scenes?.length ?? 0) > 0,
    hasBpm: Boolean(spec.project?.globalTiming?.bpm),
  };
}

// ---------------------------------------------------------------------------
// Ambiguity detection
// ---------------------------------------------------------------------------

/** Optional project history hints used to detect repeated asks. */
export interface VolitionHistory {
  /** Number of consecutive prior turns that ended in an ASK. */
  consecutiveAsks: number;
  /** Whether the same keyword appeared in the prior turn. */
  repeatedKeyword: boolean;
}

const DEFAULT_HISTORY: VolitionHistory = { consecutiveAsks: 0, repeatedKeyword: false };

function detectAmbiguity(
  input: string,
  spec: SpecSignals,
  history: VolitionHistory,
): AmbiguitySignal[] {
  const signals: AmbiguitySignal[] = [];
  const text = input.trim();
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  // Empty or near-empty input — cannot act or ask well.
  if (words.length === 0) {
    signals.push({
      id: "empty",
      label: "Empty input",
      severity: 1.0,
      observation: "no tokens to interpret",
    });
  } else if (words.length <= 2) {
    signals.push({
      id: "thin",
      label: "Thin input",
      severity: 0.5,
      observation: `only ${words.length} token(s) — intent may be premature`,
    });
  }

  // Missing target: an action verb with no layer/element to act on.
  const hasActionVerb = /\b(make|set|apply|add|remove|delete|change|update|animate|tune|adjust|move|scale|rotate|fade|slide|bounce|export|render|generate|create|build)\b/i.test(text);
  const hasTarget = /\b(it|this|that|everything|all|layer|component|element|text|shape|image|button|card|scene|hero|background|cta|headline|grid|list|modal|toast|badge|icon)\b/i.test(text);
  if (hasActionVerb && !hasTarget && !spec.isEmpty) {
    signals.push({
      id: "missing-target",
      label: "Missing target",
      severity: 0.55,
      observation: "action verb present but no target layer or element named",
    });
  }

  // Conflicting modifiers: e.g. "make it faster and slower".
  const conflicts: Array<[RegExp, RegExp, string]> = [
    [/\bfaster\b/i, /\bslower\b/i, "faster vs slower"],
    [/\bbigger\b/i, /\bsmaller\b/i, "bigger vs smaller"],
    [/\bbouncy\b/i, /\bsmooth\b/i, "bouncy vs smooth"],
    [/\bsnappy\b/i, /\bsoft\b/i, "snappy vs soft"],
    [/\blouder\b/i, /\bquieter\b/i, "louder vs quieter"],
    [/\bbrighter\b/i, /\bdarker\b/i, "brighter vs darker"],
  ];
  for (const [a, b, label] of conflicts) {
    if (a.test(text) && b.test(text)) {
      signals.push({
        id: "conflict-" + label.replace(/\W+/g, "-"),
        label: `Conflicting modifiers (${label})`,
        severity: 0.7,
        observation: `both "${a.source.replace(/\\b/g, "")}" and "${b.source.replace(/\\b/g, "")}" appear — they cannot both hold`,
      });
    }
  }

  // Destructive scope: delete / remove / reset / clear without a clear target.
  const isDestructive = /\b(delete|remove|reset|clear|wipe|erase|destroy|purge)\b/i.test(text);
  if (isDestructive && !hasTarget) {
    signals.push({
      id: "destructive-scope",
      label: "Destructive scope unknown",
      severity: 0.85,
      observation: "destructive verb without a named target — high regret risk",
    });
  }

  // Missing required parameter: export with no format, color with no value.
  if (/\bexport\b/i.test(text) && !/\b(html|css|json|react|tsx|video|mp4|gif|webm|lottie|skill|code|component)\b/i.test(text)) {
    signals.push({
      id: "missing-format",
      label: "Missing export format",
      severity: 0.5,
      observation: "export requested but no target format named",
    });
  }
  if (/\b(color|colour|背景色|颜色)\b/i.test(text) && !/\b(red|green|blue|yellow|orange|purple|pink|white|black|gray|grey|#[0-9a-f]{3,8}|rgba?\(|hsl|mood|theme|palette)\b/i.test(lower)) {
    signals.push({
      id: "missing-color",
      label: "Missing color value",
      severity: 0.45,
      observation: "color change requested but no specific color or palette named",
    });
  }

  // Acting on an empty project: most "tune this" intents need an existing layer.
  const tunesExisting = /\b(make|set|apply|tune|adjust|change|update|animate|move|scale|rotate|fade|slide|bounce|speed|slow)\b/i.test(text);
  if (spec.isEmpty && tunesExisting && !/\b(add|create|new|build|generate|seed)\b/i.test(text)) {
    signals.push({
      id: "empty-project",
      label: "Nothing to tune yet",
      severity: 0.6,
      observation: "the project has no layers — a tuning intent has nothing to act on",
    });
  }

  // Vague quality-only intent: "make it nice" / "better" / "cool".
  if (/\b(nice|better|cool|good|awesome|pretty|wow|something|stuff)\b/i.test(text) && words.length < 5) {
    signals.push({
      id: "vague-quality",
      label: "Vague quality ask",
      severity: 0.55,
      observation: "qualitative adjective without a concrete motion direction",
    });
  }

  // Repeated ask: the agent already asked once and the user reissued the same
  // keyword — acting now is better than asking a third time.
  if (history.repeatedKeyword && history.consecutiveAsks >= 1) {
    signals.push({
      id: "repeated-ask",
      label: "Repeated ask",
      severity: -0.4,
      observation: "user reissued the same intent after a prior clarification — proceed",
    });
  }

  // Sort by severity descending (negative severities rank last and lower stall risk).
  return signals.sort((a, b) => b.severity - a.severity);
}

// ---------------------------------------------------------------------------
// Readiness + stall risk
// ---------------------------------------------------------------------------

function computeReadiness(signals: AmbiguitySignal[]): number {
  // Baseline readiness for a non-empty input.
  let readiness = 0.85;
  for (const s of signals) {
    readiness -= s.severity;
  }
  return Math.max(0, Math.min(1, readiness));
}

function computeStallRisk(signals: AmbiguitySignal[]): number {
  // Stall risk is the regret-weighted sum of negative-readiness signals.
  let risk = 0;
  for (const s of signals) {
    if (s.severity > 0) risk += s.severity * 0.7;
  }
  return Math.max(0, Math.min(1, risk));
}

function estimateRegret(signals: AmbiguitySignal[], spec: SpecSignals): number {
  // Each high-severity ambiguity contributes roughly one undo if the agent acts.
  let regret = 0;
  for (const s of signals) {
    if (s.severity >= 0.7) regret += 1;
    else if (s.severity >= 0.4) regret += 0.4;
  }
  if (spec.componentCount > 8) regret += 0.5; // large specs amplify undo cost
  return Math.round(regret * 10) / 10;
}

// ---------------------------------------------------------------------------
// Mode selection
// ---------------------------------------------------------------------------

function chooseMode(
  readiness: number,
  stallRisk: number,
  history: VolitionHistory,
  ambiguities: AmbiguitySignal[],
): VolitionMode {
  // Repeated ask forces action — the agent must not ping-pong.
  if (history.repeatedKeyword && history.consecutiveAsks >= 1 && readiness > 0.2) {
    return "act";
  }
  // Empty input — defer rather than ask a meaningless question.
  if (ambiguities.some((a) => a.id === "empty")) {
    return "defer";
  }
  // High stall risk with a single dominant, resolvable ambiguity — ask.
  if (stallRisk >= 0.6 && ambiguities.length <= 3) {
    return "ask";
  }
  // Conflicting modifiers or vague quality — refine the intent first.
  if (ambiguities.some((a) => a.id.startsWith("conflict-") || a.id === "vague-quality")) {
    return "refine";
  }
  // Destructive scope without a target — always ask, never guess.
  if (ambiguities.some((a) => a.id === "destructive-scope")) {
    return "ask";
  }
  // Otherwise: act if readiness is high enough; else ask.
  if (readiness >= 0.55) return "act";
  if (readiness >= 0.25) return "refine";
  return "ask";
}

// ---------------------------------------------------------------------------
// Clarifying question + refined intent composition
// ---------------------------------------------------------------------------

function composeQuestion(input: string, ambiguities: AmbiguitySignal[]): ClarifyingQuestion | null {
  if (ambiguities.length === 0) return null;
  const top = ambiguities[0];
  switch (top.id) {
    case "missing-target":
      return {
        question: "Which layer should this apply to?",
        resolves: top.id,
        options: ["the selected layer", "all layers", "the headline", "the CTA"],
      };
    case "destructive-scope":
      return {
        question: "What specifically should I delete?",
        resolves: top.id,
        options: ["the selected layer", "empty layers only", "the last scene", "nothing — cancel"],
      };
    case "missing-format":
      return {
        question: "Which export format do you want?",
        resolves: top.id,
        options: ["HTML", "CSS", "Lottie", "MP4 video", "React component"],
      };
    case "missing-color":
      return {
        question: "What color should it be?",
        resolves: top.id,
        options: ["a hex code", "a named color", "a palette from the brand pack", "keep current — just shift hue"],
      };
    case "empty-project":
      return {
        question: "There are no layers yet — should I create one first?",
        resolves: top.id,
        options: ["add a headline", "add a CTA button", "add a card", "seed a starter scene"],
      };
    case "conflict-faster-vs-slower":
    case "conflict-bouncy-vs-smooth":
    case "conflict-snappy-vs-soft":
    case "conflict-bigger-vs-smaller":
    case "conflict-louder-vs-quieter":
    case "conflict-brighter-vs-darker":
      return {
        question: `You asked for two opposite directions (${top.label.replace("Conflicting modifiers (", "").replace(")", "")}) — which one?`,
        resolves: top.id,
        options: ["the first one", "the second one", "a balance between both"],
      };
    case "vague-quality":
      return {
        question: "What direction should 'better' take?",
        resolves: top.id,
        options: ["more energetic", "calmer and subtler", "more premium", "more playful"],
      };
    case "thin":
      return {
        question: "Could you add one more detail so I act on the right thing?",
        resolves: top.id,
        options: ["which layer", "which feeling", "which duration"],
      };
    default:
      return {
        question: "Before I act, can you narrow this down?",
        resolves: top.id,
        options: ["yes", "just do your best guess"],
      };
  }
}

function composeRefinement(input: string, ambiguities: AmbiguitySignal[], spec: SpecSignals): RefinedIntent | null {
  const text = input.trim();
  if (text.length === 0) return null;
  const changes: string[] = [];
  let refined = text;

  // Resolve conflicting modifiers by keeping the first.
  for (const a of ambiguities) {
    if (a.id.startsWith("conflict-")) {
      const match = a.observation.match(/"(\w+)" and "(\w+)"/);
      if (match) {
        refined = refined.replace(new RegExp(`\\b${match[2]}\\b`, "gi"), "").replace(/\s{2,}/g, " ").trim();
        changes.push(`dropped conflicting "${match[2]}" to keep "${match[1]}"`);
      }
    }
  }

  // Vague quality → default to "more premium" if no other direction.
  if (ambiguities.some((a) => a.id === "vague-quality")) {
    if (!/\b(energetic|calm|premium|playful|dramatic|minimal|bouncy|smooth|snappy|soft)\b/i.test(refined)) {
      refined = refined.replace(/\b(nice|better|cool|good|awesome|pretty|wow)\b/i, "premium and deliberate");
      changes.push('expanded vague quality word into "premium and deliberate"');
    }
  }

  // Empty project tuning → prepend a create step.
  if (spec.isEmpty && ambiguities.some((a) => a.id === "empty-project")) {
    refined = `add a headline, then ${refined}`;
    changes.push("prepended a layer-creation step because the project is empty");
  }

  if (changes.length === 0) return null;
  return { refined, changes };
}

// ---------------------------------------------------------------------------
// Suggested tools for ACT mode
// ---------------------------------------------------------------------------

function suggestTools(input: string, spec: SpecSignals): string[] {
  const lower = input.toLowerCase();
  const tools: string[] = [];
  if (/\b(add|create|new|build|generate)\b/i.test(input) && /\b(layer|element|text|shape|image|button|card|headline)\b/i.test(input)) {
    tools.push("add_layer");
  }
  if (/\b(bouncy|bounce|smooth|snappy|soft|elastic|spring|easing)\b/i.test(input)) {
    tools.push(spec.isEmpty ? "add_layer" : "set_easing");
  }
  if (/\b(faster|slower|duration|speed|quick|slow)\b/i.test(input)) {
    tools.push(spec.isEmpty ? "add_layer" : "set_duration");
  }
  if (/\b(color|colour|背景色|颜色)\b/i.test(input)) {
    tools.push(spec.isEmpty ? "add_layer" : "set_color");
  }
  if (/\b(loop|repeat|forever)\b/i.test(input)) {
    tools.push(spec.isEmpty ? "add_layer" : "set_loop");
  }
  if (/\bexport\b/i.test(input)) {
    if (/\bhtml\b/i.test(lower)) tools.push("export_html");
    else if (/\b(css|样式)\b/i.test(lower)) tools.push("export_code");
    else if (/\bjson\b/i.test(lower)) tools.push("export_code");
    else if (/\b(react|tsx|component)\b/i.test(lower)) tools.push("export_code");
    else if (/\b(video|mp4|gif|webm)\b/i.test(lower)) tools.push("export_video");
    else if (/\b(lottie|after\s*effects)\b/i.test(lower)) tools.push("export_lottie");
    else tools.push("export_html");
  }
  if (/\b(describe|analyze|review|critique|dna)\b/i.test(input)) {
    tools.push("describe_motion");
  }
  if (tools.length === 0) {
    tools.push(spec.isEmpty ? "add_layer" : "get_motion_spec");
  }
  return tools;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decide what the agent should do next given a user message, the current
 * spec, and optional turn history.
 *
 * @param input The user's message.
 * @param spec The current motion spec (may be null).
 * @param history Optional turn history for repeated-ask detection.
 */
export function decide(
  input: string,
  spec: MotionSpec | null = null,
  history: VolitionHistory = DEFAULT_HISTORY,
): VolitionReport {
  const specSignals = readSpecSignals(spec);
  const ambiguities = detectAmbiguity(input, specSignals, history);
  const readiness = computeReadiness(ambiguities);
  const stallRisk = computeStallRisk(ambiguities);
  const regret = estimateRegret(ambiguities, specSignals);
  const mode = chooseMode(readiness, stallRisk, history, ambiguities);

  let clarifyingQuestion: ClarifyingQuestion | null = null;
  let refinedIntent: RefinedIntent | null = null;
  let suggestedTools: string[] = [];

  if (mode === "ask") {
    clarifyingQuestion = composeQuestion(input, ambiguities);
  } else if (mode === "refine") {
    refinedIntent = composeRefinement(input, ambiguities, specSignals);
    // If refinement succeeds, the agent can act on the refined intent.
    if (refinedIntent) suggestedTools = suggestTools(refinedIntent.refined, specSignals);
  } else if (mode === "act") {
    suggestedTools = suggestTools(input, specSignals);
  }

  const rationale = rationaleFor(mode, readiness, stallRisk, regret, ambiguities);
  const summary = formatSummary(mode, readiness, stallRisk, regret, ambiguities.length);

  return {
    input,
    mode,
    readiness,
    stallRisk,
    regretEstimate: regret,
    ambiguities,
    clarifyingQuestion,
    refinedIntent,
    suggestedTools,
    rationale,
    summary,
  };
}

function rationaleFor(
  mode: VolitionMode,
  readiness: number,
  stallRisk: number,
  regret: number,
  ambiguities: AmbiguitySignal[],
): string {
  const r = Math.round(readiness * 100);
  const s = Math.round(stallRisk * 100);
  switch (mode) {
    case "act":
      return `Readiness ${r}% outweighs stall risk ${s}% — acting now. Estimated regret ${regret}.`;
    case "ask":
      return `Stall risk ${s}% exceeds readiness ${r}% — one clarifying question resolves "${ambiguities[0]?.label ?? "the dominant ambiguity"}".`;
    case "refine":
      return `Intent is recoverable without a round-trip — re-express then act (readiness ${r}%, regret ${regret}).`;
    case "defer":
      return `Input too thin to act or ask well (readiness ${r}%) — wait for more from the user.`;
  }
}

function formatSummary(
  mode: VolitionMode,
  readiness: number,
  stallRisk: number,
  regret: number,
  ambiguityCount: number,
): string {
  return [
    `Volition: ${mode.toUpperCase()} — readiness ${Math.round(readiness * 100)}%, stall risk ${Math.round(stallRisk * 100)}%, regret ${regret}, ${ambiguityCount} ambiguity signal(s).`,
  ].join(" ");
}

/** Format the full volition report as a readable multi-line string. */
export function formatVolitionReport(report: VolitionReport): string {
  const lines: string[] = [report.summary, ""];
  lines.push(`Mode: ${report.mode.toUpperCase()}`);
  lines.push(`Readiness: ${Math.round(report.readiness * 100)}%`);
  lines.push(`Stall risk: ${Math.round(report.stallRisk * 100)}%`);
  lines.push(`Regret estimate: ${report.regretEstimate}`);
  if (report.ambiguities.length > 0) {
    lines.push("", "Ambiguities:");
    for (const a of report.ambiguities) {
      lines.push(`  • ${a.label} — severity ${Math.round(a.severity * 100)}%`);
      lines.push(`      ${a.observation}`);
    }
  }
  if (report.clarifyingQuestion) {
    lines.push("", "Clarifying question:");
    lines.push(`  ? ${report.clarifyingQuestion.question}`);
    lines.push(`      options: ${report.clarifyingQuestion.options.join(" | ")}`);
  }
  if (report.refinedIntent) {
    lines.push("", "Refined intent:");
    lines.push(`  → "${report.refinedIntent.refined}"`);
    for (const c of report.refinedIntent.changes) {
      lines.push(`      • ${c}`);
    }
  }
  if (report.suggestedTools.length > 0) {
    lines.push("", `Suggested tools: ${report.suggestedTools.join(" → ")}`);
  }
  lines.push("", `Rationale: ${report.rationale}`);
  return lines.join("\n");
}

/** The canonical volition modes, for UI / manifest endpoints. */
export function listVolitionModes(): Array<{ id: VolitionMode; label: string; description: string }> {
  return [
    { id: "act", label: "Act", description: "Proceed with the suggested tool sequence. Readiness outweighs stall risk." },
    { id: "ask", label: "Ask", description: "Pose one bounded clarifying question that resolves the dominant ambiguity." },
    { id: "defer", label: "Defer", description: "Wait — the input is too thin to act or ask well. Avoid a meaningless question." },
    { id: "refine", label: "Refine", description: "Re-express the messy intent in a cleaner form, then act without a round-trip." },
  ];
}
