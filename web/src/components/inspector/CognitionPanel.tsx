import { useCallback, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import {
  decideVolition,
  translateLexicon,
  reflectConsciousness,
  listGenesisKinds,
  runGenesis,
  forecastMotion,
  predictIntent,
  type VolitionReport,
  type LexiconReport,
  type ConsciousnessReport,
  type VolitionMode,
  type GenesisKind,
  type GenesisKindSummary,
  type GenesisReport,
  type ProphecyReport,
  type TelepathyReport,
} from "../../api/endpoints.js";

/**
 * Cognition panel — surfaces six AI-native cognition engines in one
 * place: Volition (act/ask/defer/refine), Lexicon (intent → motion
 * tokens), Consciousness (self-reflection), Genesis (mathematical
 * generators), Prophecy (era trajectory forecast), and Telepathy
 * (intent prediction from partial input). All engines are rule-based
 * and run on the backend; this panel only renders their reports.
 *
 * Styling follows the high-contrast minimalist palette: bg-panel, text-
 * gray-100/500, border-edge. Red is reserved exclusively for the DEFER
 * mode badge (a destructive-ish stall) — every other mode uses neutral
 * emphasis.
 */
export function CognitionPanel() {
  const projectId = useProjectStore((s) => s.projectId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <VolitionSection projectId={projectId} />
        <LexiconSection projectId={projectId} />
        <ConsciousnessSection projectId={projectId} />
        <GenesisSection projectId={projectId} />
        <ProphecySection projectId={projectId} />
        <TelepathySection projectId={projectId} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Volition
// ---------------------------------------------------------------------------

const VOLITION_MODE_COLORS: Record<VolitionMode, string> = {
  act: "text-gray-100 border-edge bg-panel2",
  ask: "text-gray-100 border-edge bg-panel2",
  defer: "text-red-400 border-red-900/60 bg-red-950/30",
  refine: "text-gray-100 border-edge bg-panel2",
};

function VolitionSection({ projectId }: { projectId: string | null }) {
  const [partial, setPartial] = useState("");
  const [report, setReport] = useState<VolitionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDecide = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await decideVolition(partial, projectId ?? undefined);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "volition request failed");
    } finally {
      setLoading(false);
    }
  }, [partial, projectId]);

  return (
    <section className="border-b border-edge p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Volition</h3>
        <span className="text-[10px] text-gray-600">act · ask · defer · refine</span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Decides whether the agent should act, ask one clarifying question, defer, or refine the intent before dispatching tools.
      </p>
      <textarea
        value={partial}
        onChange={(e) => setPartial(e.target.value)}
        placeholder="Type a partial intent — e.g. 'make it faster and slower' or 'delete it'"
        rows={2}
        className="w-full text-xs bg-panel2 border border-edge rounded px-2 py-1.5 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-accent resize-none"
      />
      <button
        onClick={onDecide}
        disabled={loading || partial.trim().length === 0}
        className="self-start text-xs px-3 py-1.5 rounded border border-edge bg-panel2 text-gray-100 hover:bg-panel3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Deciding…" : "Decide"}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {report && (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${VOLITION_MODE_COLORS[report.mode]}`}>
              {report.mode}
            </span>
            <span className="text-[11px] text-gray-500">regret {report.regretEstimate}</span>
          </div>
          <Meter label="Readiness" value={report.readiness} />
          <Meter label="Stall risk" value={report.stallRisk} />
          {report.ambiguities.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Ambiguities</span>
              {report.ambiguities.map((a) => (
                <div key={a.id} className="text-[11px] text-gray-400 leading-snug">
                  <span className="text-gray-200">· {a.label}</span>
                  <span className="text-gray-600"> — {a.observation}</span>
                </div>
              ))}
            </div>
          )}
          {report.clarifyingQuestion && (
            <div className="border border-edge rounded bg-panel2/50 px-2 py-1.5 flex flex-col gap-1">
              <span className="text-[11px] text-gray-100">? {report.clarifyingQuestion.question}</span>
              <span className="text-[10px] text-gray-500">
                options: {report.clarifyingQuestion.options.join(" · ")}
              </span>
            </div>
          )}
          {report.refinedIntent && (
            <div className="border border-edge rounded bg-panel2/50 px-2 py-1.5 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Refined intent</span>
              <span className="text-[11px] text-gray-100">→ {report.refinedIntent.refined}</span>
              {report.refinedIntent.changes.map((c, i) => (
                <span key={i} className="text-[10px] text-gray-500">· {c}</span>
              ))}
            </div>
          )}
          {report.suggestedTools.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {report.suggestedTools.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-panel2 border border-edge text-gray-400">
                  {t}
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-600 italic leading-snug">{report.rationale}</p>
        </div>
      )}
    </section>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-400 font-mono">{pct}%</span>
      </div>
      <div className="h-1 bg-panel2 rounded-full overflow-hidden">
        <div className="h-full bg-gray-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lexicon
// ---------------------------------------------------------------------------

function LexiconSection({ projectId }: { projectId: string | null }) {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<LexiconReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTranslate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await translateLexicon(input, projectId ?? undefined);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "lexicon request failed");
    } finally {
      setLoading(false);
    }
  }, [input, projectId]);

  return (
    <section className="border-b border-edge p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Lexicon</h3>
        <span className="text-[10px] text-gray-600">tokens · categories · bilingual</span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Translates intent (EN / 中) into a duration token, easing token, reduced-motion mode, and one of eleven motion categories.
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. '丝滑的高级入场' or 'cinematic entrance with snappy spring'"
        rows={2}
        className="w-full text-xs bg-panel2 border border-edge rounded px-2 py-1.5 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-accent resize-none"
      />
      <button
        onClick={onTranslate}
        disabled={loading || input.trim().length === 0}
        className="self-start text-xs px-3 py-1.5 rounded border border-edge bg-panel2 text-gray-100 hover:bg-panel3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Translating…" : "Translate"}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {report && (
        <div className="flex flex-col gap-2 mt-1">
          <TokenRow label="Category" value={report.category} />
          <TokenRow label="Duration" value={`${report.durationToken.label} (${report.durationToken.minMs}–${report.durationToken.maxMs}ms)`} />
          <TokenRow label="Easing" value={`${report.easingToken.label} — ${report.easingToken.signature}`} />
          <TokenRow label="Reduced motion" value={report.reducedMotionMode} />
          {report.matchedCues.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Matched cues</span>
              {report.matchedCues.map((c, i) => (
                <span key={i} className="text-[11px] text-gray-400">
                  <span className="text-gray-200">"{c.cue}"</span>
                  <span className="text-gray-600"> → {c.category}</span>
                </span>
              ))}
            </div>
          )}
          {report.suggestedTools.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {report.suggestedTools.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-panel2 border border-edge text-gray-400">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TokenRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-[11px] text-gray-100 font-mono">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consciousness
// ---------------------------------------------------------------------------

function ConsciousnessSection({ projectId }: { projectId: string | null }) {
  const [report, setReport] = useState<ConsciousnessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onReflect = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await reflectConsciousness(projectId);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "consciousness request failed");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return (
    <section className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Consciousness</h3>
        <span className="text-[10px] text-gray-600">self-reflection</span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        The composition observes its own design: self-beliefs, counter-questions, cognitive biases, and a stream-of-consciousness monologue.
      </p>
      <button
        onClick={onReflect}
        disabled={loading || !projectId}
        className="self-start text-xs px-3 py-1.5 rounded border border-edge bg-panel2 text-gray-100 hover:bg-panel3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {!projectId ? "Open a project" : loading ? "Reflecting…" : "Reflect"}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {report && (
        <div className="flex flex-col gap-2 mt-1">
          <Meter label="Metacognitive awareness" value={report.awareness} />
          {report.biases.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Cognitive biases</span>
              {report.biases.map((b) => (
                <div key={b.id} className="text-[11px] text-gray-400 leading-snug">
                  <span className="text-gray-200">! {b.label}</span>
                  <span className="text-gray-600"> — {b.observation}</span>
                </div>
              ))}
            </div>
          )}
          {report.monologue.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Stream of consciousness</span>
              {report.monologue.slice(0, 6).map((beat, i) => (
                <span key={i} className="text-[11px] text-gray-400 leading-snug">
                  <span className="text-gray-600">[{beat.tone}]</span> {beat.line}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Genesis — generative motion from mathematical curves
// ---------------------------------------------------------------------------

function GenesisSection({ projectId }: { projectId: string | null }) {
  const [kinds, setKinds] = useState<GenesisKindSummary[]>([]);
  const [kindsLoaded, setKindsLoaded] = useState(false);
  const [kind, setKind] = useState<GenesisKind | "">("");
  const [report, setReport] = useState<GenesisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLoadKinds = useCallback(async () => {
    if (kindsLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const r = await listGenesisKinds();
      setKinds(r.kinds);
      setKindsLoaded(true);
      if (r.kinds.length > 0 && kind === "") setKind(r.kinds[0].kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "genesis-kinds request failed");
    } finally {
      setLoading(false);
    }
  }, [kindsLoaded, kind]);

  const onGenerate = useCallback(async () => {
    if (!projectId || !kind) return;
    setLoading(true);
    setError(null);
    try {
      const r = await runGenesis(projectId, kind);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "genesis request failed");
    } finally {
      setLoading(false);
    }
  }, [projectId, kind]);

  const selected = kinds.find((k) => k.kind === kind);

  return (
    <section className="border-b border-edge p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Genesis</h3>
        <span className="text-[10px] text-gray-600">math → motion</span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Generates original motion components from mathematical curves (Lissajous, golden spiral, wave interference, etc.). Each run persists real components in the project.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onLoadKinds}
          disabled={loading && !kindsLoaded}
          className="text-xs px-2 py-1 rounded border border-edge bg-panel2 text-gray-300 hover:bg-panel3 disabled:opacity-40 transition-colors"
        >
          {kindsLoaded ? "Reload kinds" : "Load kinds"}
        </button>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as GenesisKind)}
          disabled={kinds.length === 0}
          className="flex-1 text-xs bg-panel2 border border-edge rounded px-2 py-1 text-gray-100 focus:outline-none focus:border-accent disabled:opacity-40"
        >
          {kinds.length === 0 && <option value="">Load kinds first</option>}
          {kinds.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.kind}
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <p className="text-[10px] text-gray-600 leading-snug">{selected.description}</p>
      )}
      <button
        onClick={onGenerate}
        disabled={loading || !projectId || !kind}
        className="self-start text-xs px-3 py-1.5 rounded border border-edge bg-panel2 text-gray-100 hover:bg-panel3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {!projectId ? "Open a project" : loading ? "Generating…" : "Generate"}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {report && (
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-edge bg-panel2 text-gray-100">
              {report.kind}
            </span>
            <span className="text-[11px] text-gray-500">{report.count} component{report.count === 1 ? "" : "s"} created</span>
          </div>
          <span className="text-[11px] text-gray-300 leading-snug">{report.summary}</span>
          {report.componentIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {report.componentIds.slice(0, 8).map((id) => (
                <span key={id} className="text-[10px] px-1.5 py-0.5 rounded bg-panel2 border border-edge text-gray-500 font-mono">
                  {id}
                </span>
              ))}
              {report.componentIds.length > 8 && (
                <span className="text-[10px] text-gray-600 self-center">
                  +{report.componentIds.length - 8} more
                </span>
              )}
            </div>
          )}
          <p className="text-[10px] text-gray-600 italic leading-snug whitespace-pre-line">{report.description}</p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Prophecy — forecast the trajectory of a composition
// ---------------------------------------------------------------------------

function ProphecySection({ projectId }: { projectId: string | null }) {
  const [report, setReport] = useState<ProphecyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onForecast = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await forecastMotion(projectId);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "prophecy request failed");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return (
    <section className="border-b border-edge p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Prophecy</h3>
        <span className="text-[10px] text-gray-600">era · trajectory · avant-garde</span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Forecasts where the composition is heading: current design era, likely next eras with probabilities, and avant-garde divergent directions.
      </p>
      <button
        onClick={onForecast}
        disabled={loading || !projectId}
        className="self-start text-xs px-3 py-1.5 rounded border border-edge bg-panel2 text-gray-100 hover:bg-panel3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {!projectId ? "Open a project" : loading ? "Forecasting…" : "Forecast"}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {report && (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-500">Current era</span>
            <span className="text-[11px] text-gray-100 font-mono">{report.currentEra.label}</span>
          </div>
          <Meter label="Novelty score" value={report.noveltyScore} />
          {report.prophecies.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Trajectory</span>
              {report.prophecies.slice(0, 4).map((p) => (
                <div key={p.eraId} className="flex flex-col gap-0.5 text-[11px] leading-snug">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-200">{p.eraLabel}</span>
                    <span className="text-gray-500 font-mono">{Math.round(p.probability * 100)}%</span>
                  </div>
                  <span className="text-gray-600">{p.rationale}</span>
                </div>
              ))}
            </div>
          )}
          {report.avantGarde.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Avant-garde</span>
              {report.avantGarde.slice(0, 3).map((a) => (
                <div key={a.id} className="border border-edge rounded bg-panel2/50 px-2 py-1.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-100">{a.label}</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      nov {Math.round(a.novelty * 100)}% · risk {Math.round(a.risk * 100)}%
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 leading-snug">{a.description}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-600 italic leading-snug">{report.summary}</p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Telepathy — predict user intent from partial input
// ---------------------------------------------------------------------------

function TelepathySection({ projectId }: { projectId: string | null }) {
  const [partial, setPartial] = useState("");
  const [report, setReport] = useState<TelepathyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPredict = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await predictIntent(partial, projectId ?? undefined);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "telepathy request failed");
    } finally {
      setLoading(false);
    }
  }, [partial, projectId]);

  return (
    <section className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Telepathy</h3>
        <span className="text-[10px] text-gray-600">partial → intent</span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Predicts the user's full intent from a partial message: ranked predictions, extracted signals, and a suggested completion prompt.
      </p>
      <textarea
        value={partial}
        onChange={(e) => setPartial(e.target.value)}
        placeholder="Type a partial intent — e.g. 'add a slow fade' or 'make the logo'"
        rows={2}
        className="w-full text-xs bg-panel2 border border-edge rounded px-2 py-1.5 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-accent resize-none"
      />
      <button
        onClick={onPredict}
        disabled={loading || partial.trim().length === 0}
        className="self-start text-xs px-3 py-1.5 rounded border border-edge bg-panel2 text-gray-100 hover:bg-panel3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Predicting…" : "Predict"}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {report && (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${
                report.actionable
                  ? "text-gray-100 border-edge bg-panel2"
                  : "text-gray-400 border-edge bg-panel2/50"
              }`}
            >
              {report.actionable ? "actionable" : "needs input"}
            </span>
          </div>
          {report.predictions.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Predicted intents</span>
              {report.predictions.slice(0, 4).map((p) => (
                <div key={p.id} className="flex flex-col gap-0.5 text-[11px] leading-snug">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-200">{p.label}</span>
                    <span className="text-gray-500 font-mono">{Math.round(p.confidence * 100)}%</span>
                  </div>
                  {p.completion && (
                    <span className="text-gray-400">→ {p.completion}</span>
                  )}
                  {p.toolPath.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {p.toolPath.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-panel2 border border-edge text-gray-500">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {report.signals.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Signals</span>
              {report.signals.slice(0, 6).map((s, i) => (
                <span key={i} className="text-[11px] text-gray-400 leading-snug">
                  <span className="text-gray-200">"{s.match}"</span>
                  <span className="text-gray-600"> · {s.category} · weight {Math.round(s.weight * 100)}%</span>
                </span>
              ))}
            </div>
          )}
          {report.suggestedPrompt && (
            <div className="border border-edge rounded bg-panel2/50 px-2 py-1.5 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Suggested prompt</span>
              <span className="text-[11px] text-gray-100">{report.suggestedPrompt}</span>
            </div>
          )}
          <p className="text-[10px] text-gray-600 italic leading-snug">{report.summary}</p>
        </div>
      )}
    </section>
  );
}
