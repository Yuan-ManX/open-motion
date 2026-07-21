import { useState, useCallback, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import type { MotionComponent } from "@openmotion/shared";

interface IntelligenceReport {
  emotion?: {
    journey: { time: number; emotion: string; intensity: number }[];
    dominantEmotion: string;
    emotionalArc: string;
    peakIntensity: number;
  };
  rhythm?: {
    beats: { time: number; intensity: number }[];
    tempoBpm: number;
    rhythmType: string;
    regularity: number;
    groove: number;
  };
  narrative?: {
    segments: { act: string; startMs: number; endMs: number; intensity: number }[];
    hasCompleteArc: boolean;
    missingActs: string[];
    pacingScore: number;
    coherenceScore: number;
  };
}

interface CritiqueData {
  overallScore: number;
  dimensions: Record<string, { score: number; findings: Array<{ severity: string; message: string; componentName?: string }> }>;
  recommendations: string[];
  componentCount: number;
}

interface DnaData {
  easingFamily: string;
  timingProfile: { durationMs: number; delayMs: number };
  transformSignature: string[];
  triggerSemantics: string;
  intensity: string;
  signature: string;
}

interface VariationItem {
  label: string;
  axis: string;
  delta: string;
  component: MotionComponent;
}

interface StyleTransferData {
  transferred: string[];
  preserved: string[];
  component: MotionComponent;
}

type Section = "critique" | "dna" | "variations" | "style" | "emotion" | "rhythm" | "narrative";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "critique", label: "Critique" },
  { id: "dna", label: "DNA" },
  { id: "variations", label: "Variations" },
  { id: "style", label: "Style Transfer" },
  { id: "emotion", label: "Emotion" },
  { id: "rhythm", label: "Rhythm" },
  { id: "narrative", label: "Narrative" },
];

/**
 * Motion Intelligence panel — surfaces the Variation Engine, DNA Extraction,
 * Style Transfer, Critique, and the original emotion/rhythm/narrative
 * analysis systems. Each section calls the backend REST endpoints directly
 * and offers one-click Agent triggers.
 */
export function MotionIntelligencePanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const send = useChatStore((s) => s.send);
  const [section, setSection] = useState<Section>("critique");
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const [critique, setCritique] = useState<CritiqueData | null>(null);
  const [dna, setDna] = useState<DnaData | null>(null);
  const [variations, setVariations] = useState<VariationItem[] | null>(null);
  const [styleResult, setStyleResult] = useState<StyleTransferData | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [sourceComponentId, setSourceComponentId] = useState<string>("");
  const [targetComponentId, setTargetComponentId] = useState<string>("");

  const firstComponent = components[0];
  const lastComponent = components[components.length - 1];

  // Auto-select the latest component when the panel opens or components change.
  useEffect(() => {
    if (!selectedComponentId && lastComponent) setSelectedComponentId(lastComponent.id);
    if (!sourceComponentId && firstComponent) setSourceComponentId(firstComponent.id);
    if (!targetComponentId && lastComponent) setTargetComponentId(lastComponent.id);
  }, [firstComponent, lastComponent, selectedComponentId, sourceComponentId, targetComponentId]);

  const runCritique = useCallback(async () => {
    if (!projectId) return;
    setLoading("critique");
    try {
      const resp = await fetch(`/api/projects/${projectId}/critique`, {
        headers: { ...getAuthHeaders() },
      });
      if (resp.ok) {
        const data = await resp.json();
        setCritique(data);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runDna = useCallback(async (componentId: string) => {
    if (!projectId || !componentId) return;
    setLoading("dna");
    try {
      const resp = await fetch(`/api/projects/${projectId}/components/${componentId}/dna`, {
        headers: { ...getAuthHeaders() },
      });
      if (resp.ok) {
        const data = await resp.json();
        setDna(data.dna);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runVariations = useCallback(async (componentId: string) => {
    if (!projectId || !componentId) return;
    setLoading("variations");
    try {
      const resp = await fetch(`/api/projects/${projectId}/variations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ componentId, countPerAxis: 3 }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setVariations(data.variations);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runStyleTransfer = useCallback(async (sourceId: string, targetId: string) => {
    if (!projectId || !sourceId || !targetId) return;
    setLoading("style");
    try {
      const resp = await fetch(`/api/projects/${projectId}/style-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ sourceComponentId: sourceId, targetComponentId: targetId }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setStyleResult({ transferred: data.transferred, preserved: data.preserved, component: data.component });
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runAnalysis = useCallback(async (type: "emotion" | "rhythm" | "narrative") => {
    if (!projectId) return;
    setLoading(type);
    try {
      const resp = await fetch(`/api/projects/${projectId}/chat?stream=false`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ message: `Analyze the ${type} of this motion composition` }),
      });
      const data = await resp.json();
      if (data.toolResults) {
        for (const tr of data.toolResults) {
          if (tr.tool === `analyze_${type}` && tr.result?.data) {
            setReport((prev) => ({ ...prev, [type]: tr.result.data }));
          }
        }
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        Open a project to analyze motion intelligence.
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        Add components to analyze motion intelligence.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col text-xs text-gray-300">
      {/* Section tabs */}
      <div className="flex flex-wrap gap-px border-b border-edge bg-panel">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              section === s.id ? "bg-panel3 text-white border-b border-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* --- Critique --- */}
        {section === "critique" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Critique</span>
              <button
                onClick={runCritique}
                disabled={loading === "critique"}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "critique" ? "..." : "Run"}
              </button>
            </div>
            {critique ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">{critique.overallScore}</span>
                  <span className="text-gray-500">/100</span>
                </div>
                <div className="space-y-1">
                  {Object.entries(critique.dimensions).map(([name, dim]) => (
                    <div key={name} className="flex items-center gap-2">
                      <span className="w-20 text-[10px] text-gray-500 capitalize">{name}</span>
                      <div className="flex-1 h-1.5 bg-panel2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white"
                          style={{ width: `${dim.score}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[10px] text-gray-400">{dim.score}</span>
                    </div>
                  ))}
                </div>
                {critique.recommendations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Recommendations</div>
                    {critique.recommendations.map((r, i) => (
                      <div key={i} className="text-[10px] text-gray-400 leading-snug">• {r}</div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => projectId && send(projectId, "Critique this motion design and suggest improvements")}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400 mt-1"
                >
                  Ask Agent for detailed critique
                </button>
              </>
            ) : (
              <p className="text-[10px] text-gray-600">Click Run to evaluate accessibility, performance, aesthetic, and consistency.</p>
            )}
          </div>
        )}

        {/* --- DNA --- */}
        {section === "dna" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Motion DNA</span>
              <button
                onClick={() => runDna(selectedComponentId)}
                disabled={loading === "dna" || !selectedComponentId}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "dna" ? "..." : "Extract"}
              </button>
            </div>
            <select
              value={selectedComponentId}
              onChange={(e) => { setSelectedComponentId(e.target.value); setDna(null); }}
              className="w-full bg-panel2 text-gray-300 text-[10px] px-1.5 py-1 rounded border border-edge"
            >
              {components.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {dna ? (
              <div className="space-y-1">
                <DnaRow label="Easing Family" value={dna.easingFamily} />
                <DnaRow label="Intensity" value={dna.intensity} />
                <DnaRow label="Trigger" value={dna.triggerSemantics} />
                <DnaRow label="Duration" value={`${dna.timingProfile.durationMs}ms`} />
                {dna.timingProfile.delayMs > 0 && <DnaRow label="Delay" value={`${dna.timingProfile.delayMs}ms`} />}
                <div>
                  <div className="text-[9px] text-gray-600 mb-0.5">Transform Signature</div>
                  <div className="flex flex-wrap gap-1">
                    {dna.transformSignature.map((s, i) => (
                      <span key={i} className="px-1 py-0.5 text-[9px] bg-panel2 rounded text-gray-400">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-1 px-1.5 py-1 bg-panel2 rounded">
                  <div className="text-[9px] text-gray-600 mb-0.5">Signature</div>
                  <code className="text-[9px] text-gray-300 break-all">{dna.signature.slice(0, 80)}…</code>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Select a component and click Extract to decompose its motion DNA.</p>
            )}
          </div>
        )}

        {/* --- Variations --- */}
        {section === "variations" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Variations</span>
              <button
                onClick={() => runVariations(selectedComponentId)}
                disabled={loading === "variations" || !selectedComponentId}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "variations" ? "..." : "Generate"}
              </button>
            </div>
            <select
              value={selectedComponentId}
              onChange={(e) => { setSelectedComponentId(e.target.value); setVariations(null); }}
              className="w-full bg-panel2 text-gray-300 text-[10px] px-1.5 py-1 rounded border border-edge"
            >
              {components.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {variations && variations.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[9px] text-gray-600">{variations.length} variations generated</div>
                {variations.map((v, i) => (
                  <div key={i} className="px-1.5 py-1 bg-panel2 rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-300">{v.label}</span>
                      <span className="text-[9px] text-gray-600 uppercase">{v.axis}</span>
                    </div>
                    <div className="text-[9px] text-gray-500">{v.delta}</div>
                  </div>
                ))}
                <button
                  onClick={() => projectId && send(projectId, `Generate more variations of ${components.find(c => c.id === selectedComponentId)?.name ?? "the latest component"} and pick the best one`)}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400 mt-1"
                >
                  Ask Agent to explore further
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Generate variations along easing, duration, intensity, and direction axes.</p>
            )}
          </div>
        )}

        {/* --- Style Transfer --- */}
        {section === "style" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Style Transfer</span>
              <button
                onClick={() => runStyleTransfer(sourceComponentId, targetComponentId)}
                disabled={loading === "style" || !sourceComponentId || !targetComponentId || sourceComponentId === targetComponentId}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "style" ? "..." : "Transfer"}
              </button>
            </div>
            <div className="space-y-1">
              <div>
                <label className="text-[9px] text-gray-600">Source (donor)</label>
                <select
                  value={sourceComponentId}
                  onChange={(e) => { setSourceComponentId(e.target.value); setStyleResult(null); }}
                  className="w-full bg-panel2 text-gray-300 text-[10px] px-1.5 py-1 rounded border border-edge"
                >
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-gray-600">Target (recipient)</label>
                <select
                  value={targetComponentId}
                  onChange={(e) => { setTargetComponentId(e.target.value); setStyleResult(null); }}
                  className="w-full bg-panel2 text-gray-300 text-[10px] px-1.5 py-1 rounded border border-edge"
                >
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {styleResult ? (
              <div className="space-y-1">
                <div>
                  <div className="text-[9px] text-gray-600 mb-0.5">Transferred ({styleResult.transferred.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {styleResult.transferred.map((t, i) => (
                      <span key={i} className="px-1 py-0.5 text-[9px] bg-panel2 rounded text-gray-300">{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-600 mb-0.5">Preserved ({styleResult.preserved.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {styleResult.preserved.map((p, i) => (
                      <span key={i} className="px-1 py-0.5 text-[9px] bg-panel2 rounded text-gray-500">{p}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => projectId && send(projectId, `Transfer the motion style from ${components.find(c => c.id === sourceComponentId)?.name ?? "source"} to ${components.find(c => c.id === targetComponentId)?.name ?? "target"} and apply it`)}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400 mt-1"
                >
                  Ask Agent to apply the transfer
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Transfer easing, timing, and intensity from one component to another.</p>
            )}
          </div>
        )}

        {/* --- Emotion --- */}
        {section === "emotion" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Emotion</span>
              <button
                onClick={() => runAnalysis("emotion")}
                disabled={loading === "emotion"}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "emotion" ? "..." : "Analyze"}
              </button>
            </div>
            {report?.emotion ? (
              <div className="space-y-1">
                <DnaRow label="Dominant" value={report.emotion.dominantEmotion} />
                <DnaRow label="Arc" value={report.emotion.emotionalArc} />
                <DnaRow label="Peak" value={`${Math.round(report.emotion.peakIntensity * 100)}%`} />
                <div className="mt-1">
                  <div className="text-[9px] text-gray-600 mb-0.5">Journey</div>
                  <div className="flex h-4 gap-px">
                    {report.emotion.journey.map((j, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-gray-600"
                        style={{ opacity: 0.2 + j.intensity * 0.8 }}
                        title={`${j.emotion} at ${Math.round(j.time)}ms`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Click Analyze to decode the emotional journey.</p>
            )}
          </div>
        )}

        {/* --- Rhythm --- */}
        {section === "rhythm" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rhythm</span>
              <button
                onClick={() => runAnalysis("rhythm")}
                disabled={loading === "rhythm"}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "rhythm" ? "..." : "Analyze"}
              </button>
            </div>
            {report?.rhythm ? (
              <div className="space-y-1">
                <DnaRow label="Tempo" value={`${Math.round(report.rhythm.tempoBpm)} BPM`} />
                <DnaRow label="Type" value={report.rhythm.rhythmType} />
                <DnaRow label="Regularity" value={`${Math.round(report.rhythm.regularity * 100)}%`} />
                <DnaRow label="Groove" value={`${Math.round(report.rhythm.groove * 100)}%`} />
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Click Analyze to detect the visual rhythm.</p>
            )}
          </div>
        )}

        {/* --- Narrative --- */}
        {section === "narrative" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Narrative</span>
              <button
                onClick={() => runAnalysis("narrative")}
                disabled={loading === "narrative"}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "narrative" ? "..." : "Analyze"}
              </button>
            </div>
            {report?.narrative ? (
              <div className="space-y-1">
                <DnaRow label="Pacing" value={`${report.narrative.pacingScore}/100`} />
                <DnaRow label="Coherence" value={`${report.narrative.coherenceScore}/100`} />
                <DnaRow label="Arc" value={report.narrative.hasCompleteArc ? "Complete" : "Incomplete"} />
                {report.narrative.missingActs.length > 0 && (
                  <div className="text-[10px] text-gray-600">Missing: {report.narrative.missingActs.join(", ")}</div>
                )}
                <div className="mt-1">
                  <div className="text-[9px] text-gray-600 mb-0.5">5-Act Structure</div>
                  <div className="flex h-3 gap-px">
                    {report.narrative.segments.map((seg, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-gray-500"
                        style={{ opacity: 0.2 + seg.intensity * 0.8 }}
                        title={`${seg.act}: ${seg.startMs}-${seg.endMs}ms`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Click Analyze to evaluate the story arc.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DnaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 min-w-[70px]">{label}:</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}

function getAuthHeaders(): Record<string, string> {
  const key = typeof localStorage !== "undefined" ? localStorage.getItem("openmotion_api_key") : null;
  return key ? { "X-API-Key": key } : {};
}
