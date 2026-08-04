import { useCallback, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import {
  decideVolition,
  translateLexicon,
  reflectConsciousness,
  type VolitionReport,
  type LexiconReport,
  type ConsciousnessReport,
  type VolitionMode,
} from "../../api/endpoints.js";

/**
 * Cognition panel — surfaces three AI-native cognition engines in one
 * place: Volition (act/ask/defer/refine), Lexicon (intent → motion
 * tokens), and Consciousness (self-reflection of the composition). All
 * three are rule-based and run on the backend; this panel only renders
 * their reports.
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
        <LexiconSection />
        <ConsciousnessSection projectId={projectId} />
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

function LexiconSection() {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<LexiconReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTranslate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await translateLexicon(input);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "lexicon request failed");
    } finally {
      setLoading(false);
    }
  }, [input]);

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
