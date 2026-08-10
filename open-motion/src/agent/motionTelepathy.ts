/**
 * Motion Telepathy Engine — predicts user intent from partial input.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single predicted intent with its confidence and supporting evidence. */
export interface PredictedIntent {
  /** Canonical intent id. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Confidence 0..1. */
  confidence: number;
  /** Signals that contributed to this prediction. */
  evidence: string[];
  /** Suggested user-message completion. */
  completion: string;
  /** Ordered tool names that would satisfy this intent. */
  toolPath: string[];
}

/** A signal extracted from partial user input. */
export interface TelepathySignal {
  /** The matched keyword or phrase. */
  match: string;
  /** Signal category. */
  category: "action" | "modifier" | "target" | "constraint" | "quality";
  /** Weight 0..1 — how strongly this signal implies an intent. */
  weight: number;
  /** Start index in the source text. */
  start: number;
}

/** Full telepathy report. */
export interface TelepathyReport {
  /** The partial input that was analyzed. */
  input: string;
  /** Top predicted intents, sorted by confidence descending. */
  predictions: PredictedIntent[];
  /** Extracted signals. */
  signals: TelepathySignal[];
  /** Whether the prediction is confident enough to act on automatically. */
  actionable: boolean;
  /** Suggested next prompt the user might accept. */
  suggestedPrompt: string | null;
  /** Summary string. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Intent vocabulary
// ---------------------------------------------------------------------------

interface IntentDef {
  id: string;
  label: string;
  /** Keywords that map to this intent with their weights. */
  keywords: Array<{ word: string; weight: number; category: TelepathySignal["category"] }>;
  /** Tool sequence that satisfies this intent. */
  toolPath: string[];
  /** Template for the suggested completion. */
  completionTemplate: (signals: TelepathySignal[]) => string;
}

const INTENT_VOCABULARY: IntentDef[] = [
  {
    id: "ease.adjust",
    label: "Adjust easing curve",
    keywords: [
      { word: "bouncy", weight: 0.9, category: "quality" },
      { word: "bounce", weight: 0.85, category: "quality" },
      { word: "smooth", weight: 0.8, category: "quality" },
      { word: "snappy", weight: 0.85, category: "quality" },
      { word: "soft", weight: 0.7, category: "quality" },
      { word: "elastic", weight: 0.9, category: "quality" },
      { word: "spring", weight: 0.85, category: "modifier" },
      { word: "easing", weight: 0.95, category: "action" },
      { word: "curve", weight: 0.6, category: "target" },
    ],
    toolPath: ["set_easing", "set_spring"],
    completionTemplate: (s) => {
      const quality = s.find((x) => x.category === "quality");
      return quality ? `make it ${quality.match}` : "adjust the easing curve";
    },
  },
  {
    id: "timing.adjust",
    label: "Adjust timing",
    keywords: [
      { word: "faster", weight: 0.9, category: "modifier" },
      { word: "slower", weight: 0.9, category: "modifier" },
      { word: "duration", weight: 0.85, category: "target" },
      { word: "speed", weight: 0.7, category: "target" },
      { word: "quick", weight: 0.75, category: "quality" },
      { word: "slow", weight: 0.75, category: "quality" },
      { word: "timing", weight: 0.9, category: "action" },
      { word: "delay", weight: 0.8, category: "target" },
    ],
    toolPath: ["set_duration", "set_delay", "set_global_timing"],
    completionTemplate: (s) => {
      const mod = s.find((x) => x.category === "modifier");
      return mod ? `make it ${mod.match}` : "adjust the timing";
    },
  },
  {
    id: "layer.add",
    label: "Add a new layer",
    keywords: [
      { word: "add", weight: 0.7, category: "action" },
      { word: "create", weight: 0.7, category: "action" },
      { word: "new", weight: 0.6, category: "modifier" },
      { word: "layer", weight: 0.9, category: "target" },
      { word: "text", weight: 0.7, category: "target" },
      { word: "shape", weight: 0.7, category: "target" },
      { word: "image", weight: 0.7, category: "target" },
      { word: "button", weight: 0.7, category: "target" },
    ],
    toolPath: ["add_layer"],
    completionTemplate: (s) => {
      const target = s.find((x) => x.category === "target" && x.match !== "layer");
      return target ? `add a ${target.match} layer` : "add a new layer";
    },
  },
  {
    id: "rhythm.apply",
    label: "Apply a rhythm pattern",
    keywords: [
      { word: "rhythm", weight: 0.95, category: "action" },
      { word: "beat", weight: 0.8, category: "target" },
      { word: "swing", weight: 0.85, category: "quality" },
      { word: "waltz", weight: 0.9, category: "target" },
      { word: "heartbeat", weight: 0.9, category: "target" },
      { word: "stagger", weight: 0.85, category: "modifier" },
      { word: "syncopat", weight: 0.9, category: "quality" },
    ],
    toolPath: ["list_rhythm_patterns", "apply_rhythm"],
    completionTemplate: (s) => {
      const target = s.find((x) => x.category === "target" && ["waltz", "heartbeat", "beat"].includes(x.match));
      return target ? `apply a ${target.match} rhythm` : "apply a rhythm pattern";
    },
  },
  {
    id: "color.set",
    label: "Set colors",
    keywords: [
      { word: "color", weight: 0.9, category: "target" },
      { word: "colour", weight: 0.9, category: "target" },
      { word: "palette", weight: 0.85, category: "target" },
      { word: "red", weight: 0.7, category: "quality" },
      { word: "blue", weight: 0.7, category: "quality" },
      { word: "green", weight: 0.7, category: "quality" },
      { word: "dark", weight: 0.6, category: "modifier" },
      { word: "light", weight: 0.6, category: "modifier" },
      { word: "gradient", weight: 0.8, category: "target" },
    ],
    toolPath: ["set_color", "generate_palette"],
    completionTemplate: (s) => {
      const quality = s.find((x) => x.category === "quality");
      return quality ? `set the color to ${quality.match}` : "set the colors";
    },
  },
  {
    id: "variant.generate",
    label: "Generate variants",
    keywords: [
      { word: "variant", weight: 0.95, category: "action" },
      { word: "alternativ", weight: 0.85, category: "modifier" },
      { word: "option", weight: 0.7, category: "target" },
      { word: "explore", weight: 0.8, category: "action" },
      { word: "compare", weight: 0.75, category: "action" },
      { word: "a/b", weight: 0.9, category: "modifier" },
      { word: "different", weight: 0.6, category: "modifier" },
    ],
    toolPath: ["generate_variants"],
    completionTemplate: () => "generate variants to explore",
  },
  {
    id: "narrative.plan",
    label: "Plan a narrative sequence",
    keywords: [
      { word: "story", weight: 0.9, category: "target" },
      { word: "narrative", weight: 0.95, category: "action" },
      { word: "scene", weight: 0.8, category: "target" },
      { word: "sequence", weight: 0.75, category: "target" },
      { word: "arc", weight: 0.8, category: "target" },
      { word: "tell", weight: 0.7, category: "action" },
      { word: "journey", weight: 0.7, category: "target" },
    ],
    toolPath: ["plan_sequence", "list_narrative_arcs"],
    completionTemplate: (s) => {
      const target = s.find((x) => x.category === "target");
      return target ? `plan a ${target.match} sequence` : "plan a narrative sequence";
    },
  },
  {
    id: "accessibility.audit",
    label: "Audit accessibility",
    keywords: [
      { word: "accessib", weight: 0.95, category: "action" },
      { word: "a11y", weight: 0.95, category: "action" },
      { word: "wcag", weight: 0.95, category: "target" },
      { word: "reduced motion", weight: 0.9, category: "quality" },
      { word: "vestibular", weight: 0.85, category: "quality" },
      { word: "contrast", weight: 0.7, category: "target" },
    ],
    toolPath: ["audit_accessibility", "auto_fix_accessibility"],
    completionTemplate: () => "audit accessibility and fix issues",
  },
  {
    id: "export.render",
    label: "Export and render",
    keywords: [
      { word: "export", weight: 0.95, category: "action" },
      { word: "render", weight: 0.9, category: "action" },
      { word: "download", weight: 0.85, category: "action" },
      { word: "video", weight: 0.7, category: "target" },
      { word: "gif", weight: 0.85, category: "target" },
      { word: "lottie", weight: 0.85, category: "target" },
      { word: "code", weight: 0.6, category: "target" },
      { word: "html", weight: 0.7, category: "target" },
    ],
    toolPath: ["export_video", "export_lottie", "export_code"],
    completionTemplate: (s) => {
      const target = s.find((x) => x.category === "target" && ["video", "gif", "lottie", "code", "html"].includes(x.match));
      return target ? `export as ${target.match}` : "export the animation";
    },
  },
  {
    id: "evolve.optimize",
    label: "Evolve and optimize",
    keywords: [
      { word: "evolve", weight: 0.95, category: "action" },
      { word: "optimize", weight: 0.9, category: "action" },
      { word: "improve", weight: 0.8, category: "action" },
      { word: "breed", weight: 0.85, category: "action" },
      { word: "genetic", weight: 0.85, category: "modifier" },
      { word: "fitness", weight: 0.8, category: "target" },
      { word: "better", weight: 0.7, category: "quality" },
    ],
    toolPath: ["evolve_motion", "list_evolution_strategies"],
    completionTemplate: () => "evolve the motion for better fitness",
  },
  {
    id: "style.transfer",
    label: "Transfer style",
    keywords: [
      { word: "style", weight: 0.9, category: "target" },
      { word: "transfer", weight: 0.85, category: "action" },
      { word: "apply", weight: 0.6, category: "action" },
      { word: "feel", weight: 0.7, category: "target" },
      { word: "look", weight: 0.6, category: "target" },
      { word: "theme", weight: 0.75, category: "target" },
    ],
    toolPath: ["list_motion_themes", "apply_motion_theme", "transfer_style"],
    completionTemplate: () => "transfer a style onto this motion",
  },
  {
    id: "dream.generate",
    label: "Generate a dream sequence",
    keywords: [
      { word: "dream", weight: 0.95, category: "action" },
      { word: "surreal", weight: 0.85, category: "quality" },
      { word: "surprise", weight: 0.8, category: "action" },
      { word: "creative", weight: 0.7, category: "quality" },
      { word: "unexpected", weight: 0.75, category: "quality" },
      { word: "imagina", weight: 0.8, category: "action" },
    ],
    toolPath: ["generate_dream", "dream_from_prompt"],
    completionTemplate: () => "generate a surreal dream sequence",
  },
];

// ---------------------------------------------------------------------------
// Signal extraction
// ---------------------------------------------------------------------------

function extractSignals(input: string): TelepathySignal[] {
  const signals: TelepathySignal[] = [];
  const lower = input.toLowerCase();
  for (const intent of INTENT_VOCABULARY) {
    for (const kw of intent.keywords) {
      // Match as a word-boundary substring so "bounce" matches "bouncy" only
      // when the keyword itself is a prefix; we use a simple includes check
      // for prefix keywords (e.g. "syncopat" matches "syncopated").
      let idx = lower.indexOf(kw.word);
      while (idx !== -1) {
        signals.push({
          match: kw.word,
          category: kw.category,
          weight: kw.weight,
          start: idx,
        });
        idx = lower.indexOf(kw.word, idx + 1);
      }
    }
  }
  return signals;
}

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

/** Project-state priors bias prediction toward intents relevant to the spec. */
function projectPriors(spec: MotionSpec | null): Map<string, number> {
  const priors = new Map<string, number>();
  if (!spec) return priors;
  const components = spec.components ?? [];
  if (components.length === 0) {
    // Empty project — bias toward adding layers.
    priors.set("layer.add", 0.15);
    return priors;
  }
  // Many components → rhythm and variant generation become more relevant.
  if (components.length >= 5) {
    priors.set("rhythm.apply", 0.08);
    priors.set("variant.generate", 0.06);
  }
  // Long durations → timing adjustment is more likely.
  const avgDuration =
    components.reduce((sum, c) => sum + (c.durationMs ?? 800), 0) / components.length;
  if (avgDuration > 1200) {
    priors.set("timing.adjust", 0.07);
  }
  // No easing variation → easing adjustment is more likely.
  const easings = new Set(components.map((c) => serializeEasing(c.easing)));
  if (easings.size === 1 && components.length > 1) {
    priors.set("ease.adjust", 0.08);
  }
  return priors;
}

function serializeEasing(e: unknown): string {
  if (!e) return "none";
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown";
  }
}

/**
 * Predict the user's intent from partial input.
 *
 * @param partial The user's partial message (may be empty).
 * @param spec Optional current project spec, used as a prior.
 * @param topK How many predictions to return.
 */
export function predictIntent(
  partial: string,
  spec: MotionSpec | null = null,
  topK = 5,
): TelepathyReport {
  const signals = extractSignals(partial);
  const priors = projectPriors(spec);

  // Aggregate signal weight per intent.
  const scores = new Map<string, { weight: number; evidence: string[] }>();
  for (const signal of signals) {
    for (const intent of INTENT_VOCABULARY) {
      const kw = intent.keywords.find((k) => k.word === signal.match);
      if (!kw) continue;
      const prev = scores.get(intent.id) ?? { weight: 0, evidence: [] };
      // Diminishing returns for repeated signals of the same word.
      const delta = kw.weight / (1 + prev.evidence.filter((e) => e === signal.match).length);
      scores.set(intent.id, {
        weight: prev.weight + delta,
        evidence: [...prev.evidence, signal.match],
      });
    }
  }

  // Apply priors and normalize.
  const predictions: PredictedIntent[] = INTENT_VOCABULARY.map((intent) => {
    const score = scores.get(intent.id);
    const prior = priors.get(intent.id) ?? 0;
    const raw = (score?.weight ?? 0) + prior;
    // Confidence saturates near 1.0; uses a soft cap.
    const confidence = Math.min(1, raw / 2.5);
    const evidence = score?.evidence ?? [];
    const completion = intent.completionTemplate(signals);
    return {
      id: intent.id,
      label: intent.label,
      confidence,
      evidence: evidence.length > 0 ? evidence : ["prior"],
      completion,
      toolPath: intent.toolPath,
    };
  })
    .filter((p) => p.confidence > 0.001)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topK);

  const actionable = predictions.length > 0 && predictions[0].confidence >= 0.6;
  const suggestedPrompt =
    predictions.length > 0 && predictions[0].confidence >= 0.4
      ? predictions[0].completion
      : null;

  const summary = formatTelepathySummary(predictions, signals, partial);
  return {
    input: partial,
    predictions,
    signals,
    actionable,
    suggestedPrompt,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function formatTelepathySummary(
  predictions: PredictedIntent[],
  signals: TelepathySignal[],
  input: string,
): string {
  if (signals.length === 0) {
    return `Telepathy: no signals extracted from "${input || "(empty)"}".`;
  }
  const top = predictions[0];
  if (!top) {
    return `Telepathy: ${signals.length} signal(s) detected but no intent matched.`;
  }
  const pct = (top.confidence * 100).toFixed(0);
  return `Telepathy: top intent "${top.label}" at ${pct}% confidence (signals: ${top.evidence.join(", ")}). ${predictions.length} total predictions.`;
}

/** Format the full telepathy report as a readable multi-line string. */
export function formatTelepathyReport(report: TelepathyReport): string {
  const lines: string[] = [report.summary];
  if (report.predictions.length === 0) return lines.join("\n");
  lines.push("Predictions:");
  for (const p of report.predictions) {
    const pct = (p.confidence * 100).toFixed(0);
    lines.push(`  • ${p.label} — ${pct}% (tools: ${p.toolPath.join(" → ")})`);
    lines.push(`    completion: "${p.completion}"`);
  }
  if (report.suggestedPrompt) {
    lines.push(`Suggested prompt: "${report.suggestedPrompt}"`);
  }
  return lines.join("\n");
}

/**
 * Stream-style incremental prediction: given a previous report and new text,
 * return an updated report without recomputing from scratch. This is a thin
 * convenience wrapper; the underlying predictIntent is already fast enough
 * to call on every keystroke for typical inputs.
 */
export function updatePrediction(
  prev: TelepathyReport | null,
  fullInput: string,
  spec: MotionSpec | null = null,
  topK = 5,
): TelepathyReport {
  void prev; // stateless for now; reserved for future momentum smoothing
  return predictIntent(fullInput, spec, topK);
}
