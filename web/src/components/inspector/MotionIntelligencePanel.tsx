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

interface StoryBeatData {
  act: string;
  orderIndex: number;
  label: string;
  description: string;
  emotionalTone: string;
  intensity: number;
  durationMs: number;
  delayMs: number;
  templateId: string;
  transformHint: string;
}

interface StoryData {
  intent: string;
  title: string;
  summary: string;
  themes: string[];
  totalDurationMs: number;
  beats: StoryBeatData[];
  intensityCurve: number[];
}

interface LineageRecordData {
  componentId: string;
  componentName: string;
  operation: string;
  generation: number;
  parentIds: string[];
  label: string;
  createdAt: string;
}

interface LineageSummaryData {
  totalComponents: number;
  rootCount: number;
  maxGeneration: number;
  averageGeneration: number;
  operationBreakdown: Record<string, number>;
}

interface LineageReportData {
  componentId: string;
  componentName: string;
  operation: string;
  generation: number;
  ancestorChain: LineageRecordData[];
  descendantCount: number;
  siblingCount: number;
  summary: string;
}

interface TraitAttributionData {
  trait: string;
  sourceIndex: number;
  value: string;
}

interface SynthesisData {
  strategy: string;
  sourceCount: number;
  sourceNames: string[];
  summary: string;
  attributions: TraitAttributionData[];
  dna: {
    easingFamily: string;
    intensity: string;
    signature: string;
    timingProfile: { durationBucket: string; hasDelay: boolean; isLooping: boolean };
    transformSignature: string[];
    triggerSemantics: string;
  };
}

interface AutoFixActionData {
  componentId: string;
  componentName: string;
  category: string;
  issue: string;
  fix: string;
  field: string;
  before: string;
  after: string;
}

interface AutoFixData {
  applied: boolean;
  beforeScore: number;
  afterScore: number;
  beforeIssueCount: number;
  afterIssueCount: number;
  fixedCount: number;
  skippedCount: number;
  fixes: AutoFixActionData[];
  summary: string;
}

type Section = "critique" | "dna" | "variations" | "style" | "story" | "lineage" | "synthesis" | "auto-fix" | "emotion" | "rhythm" | "narrative";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "critique", label: "Critique" },
  { id: "dna", label: "DNA" },
  { id: "variations", label: "Variations" },
  { id: "style", label: "Style Transfer" },
  { id: "story", label: "Story" },
  { id: "lineage", label: "Lineage" },
  { id: "synthesis", label: "Synthesis" },
  { id: "auto-fix", label: "Auto-Fix" },
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
  const loadProject = useProjectStore((s) => s.loadProject);
  const send = useChatStore((s) => s.send);
  const [section, setSection] = useState<Section>("critique");
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const [critique, setCritique] = useState<CritiqueData | null>(null);
  const [dna, setDna] = useState<DnaData | null>(null);
  const [variations, setVariations] = useState<VariationItem[] | null>(null);
  const [styleResult, setStyleResult] = useState<StyleTransferData | null>(null);
  const [story, setStory] = useState<StoryData | null>(null);
  const [storyIntent, setStoryIntent] = useState<string>("hero-entrance");
  const [lineageSummary, setLineageSummary] = useState<LineageSummaryData | null>(null);
  const [lineageReport, setLineageReport] = useState<LineageReportData | null>(null);
  const [synthesis, setSynthesis] = useState<SynthesisData | null>(null);
  const [synthStrategy, setSynthStrategy] = useState<string>("blend");
  const [synthSourceA, setSynthSourceA] = useState<string>("");
  const [synthSourceB, setSynthSourceB] = useState<string>("");
  const [autoFix, setAutoFix] = useState<AutoFixData | null>(null);
  const [autoFixApply, setAutoFixApply] = useState<boolean>(true);
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

  const runStory = useCallback(async (intent: string) => {
    if (!projectId || !intent) return;
    setLoading("story");
    try {
      const resp = await fetch(`/api/projects/${projectId}/story`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ intent }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setStory({
          intent: data.intent,
          title: data.title,
          summary: data.summary,
          themes: data.themes,
          totalDurationMs: data.totalDurationMs,
          beats: data.beats,
          intensityCurve: data.intensityCurve,
        });
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runLineageSummary = useCallback(async () => {
    if (!projectId) return;
    setLoading("lineage");
    try {
      const resp = await fetch(`/api/projects/${projectId}/lineage/summary`, {
        headers: { ...getAuthHeaders() },
      });
      if (resp.ok) {
        const data = await resp.json();
        setLineageSummary(data.summary);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runLineageReport = useCallback(async (componentId: string) => {
    if (!projectId || !componentId) return;
    setLoading("lineage-report");
    try {
      const resp = await fetch(`/api/projects/${projectId}/lineage/${componentId}`, {
        headers: { ...getAuthHeaders() },
      });
      if (resp.ok) {
        const data = await resp.json();
        setLineageReport(data.report);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runSynthesis = useCallback(async (sourceA: string, sourceB: string, strategy: string) => {
    if (!projectId || !sourceA || !sourceB) return;
    setLoading("synthesis");
    try {
      const resp = await fetch(`/api/projects/${projectId}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ componentIds: [sourceA, sourceB], strategy }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setSynthesis({
          strategy: data.strategy,
          sourceCount: data.sourceCount,
          sourceNames: data.sourceNames,
          summary: data.summary,
          attributions: data.attributions,
          dna: data.dna,
        });
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runAutoFix = useCallback(async (apply: boolean) => {
    if (!projectId) return;
    setLoading("auto-fix");
    try {
      const resp = await fetch(`/api/projects/${projectId}/auto-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ apply }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setAutoFix({
          applied: data.applied,
          beforeScore: data.beforeScore,
          afterScore: data.afterScore,
          beforeIssueCount: data.beforeIssueCount,
          afterIssueCount: data.afterIssueCount,
          fixedCount: data.fixedCount,
          skippedCount: data.skippedCount,
          fixes: data.fixes,
          summary: data.summary,
        });
        // When fixes were applied, reload the project so the canvas reflects them.
        if (data.applied && data.fixedCount > 0) {
          await loadProject(projectId);
        }
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId, loadProject]);

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

        {/* --- Story --- */}
        {section === "story" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Story Sequence</span>
              <button
                onClick={() => runStory(storyIntent)}
                disabled={loading === "story" || !storyIntent}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "story" ? "..." : "Generate"}
              </button>
            </div>
            <select
              value={storyIntent}
              onChange={(e) => { setStoryIntent(e.target.value); setStory(null); }}
              className="w-full bg-panel2 text-gray-300 text-[10px] px-1.5 py-1 rounded border border-edge"
            >
              <option value="hero-entrance">Hero Entrance</option>
              <option value="celebration">Celebration</option>
              <option value="dramatic-reveal">Dramatic Reveal</option>
              <option value="conflict">Conflict</option>
              <option value="transformation">Transformation</option>
              <option value="journey">Journey</option>
              <option value="resolution">Resolution</option>
            </select>
            {story ? (
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] font-bold text-white">{story.title}</div>
                  <div className="text-[9px] text-gray-500 leading-snug">{story.summary}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {story.themes.map((t, i) => (
                    <span key={i} className="px-1 py-0.5 text-[9px] bg-panel2 rounded text-gray-400">{t}</span>
                  ))}
                  <span className="px-1 py-0.5 text-[9px] text-gray-600">{story.totalDurationMs}ms total</span>
                </div>
                {/* Intensity curve sparkline */}
                <div>
                  <div className="text-[9px] text-gray-600 mb-0.5">Intensity Curve</div>
                  <div className="flex items-end h-8 gap-1">
                    {story.intensityCurve.map((v, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-gray-400"
                        style={{ height: `${Math.max(8, v * 100)}%`, opacity: 0.3 + v * 0.7 }}
                        title={`Act ${i + 1}: ${Math.round(v * 100)}%`}
                      />
                    ))}
                  </div>
                </div>
                {/* 5-Act beats */}
                <div className="space-y-1">
                  {story.beats.map((beat, i) => (
                    <div key={i} className="px-1.5 py-1 bg-panel2 rounded">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-300">{beat.label}</span>
                        <span className="text-[9px] text-gray-600 uppercase">{beat.emotionalTone}</span>
                      </div>
                      <div className="text-[9px] text-gray-500 leading-snug mt-0.5">{beat.description}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-gray-600">{beat.durationMs}ms</span>
                        <div className="flex-1 h-1 bg-panel3 rounded-full overflow-hidden">
                          <div className="h-full bg-white" style={{ width: `${beat.intensity * 100}%` }} />
                        </div>
                        <span className="text-[9px] text-gray-500">{Math.round(beat.intensity * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => projectId && send(projectId, `Create a ${storyIntent.replace("-", " ")} story sequence and apply it to the canvas`)}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400 mt-1"
                >
                  Ask Agent to build this sequence
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Select a narrative intent and generate a 5-act story sequence.</p>
            )}
          </div>
        )}

        {/* --- Lineage --- */}
        {section === "lineage" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Lineage</span>
              <button
                onClick={runLineageSummary}
                disabled={loading === "lineage"}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "lineage" ? "..." : "Summary"}
              </button>
            </div>
            {lineageSummary ? (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  <div className="px-1.5 py-1 bg-panel2 rounded">
                    <div className="text-[9px] text-gray-600">Components</div>
                    <div className="text-[14px] font-bold text-white">{lineageSummary.totalComponents}</div>
                  </div>
                  <div className="px-1.5 py-1 bg-panel2 rounded">
                    <div className="text-[9px] text-gray-600">Roots</div>
                    <div className="text-[14px] font-bold text-white">{lineageSummary.rootCount}</div>
                  </div>
                  <div className="px-1.5 py-1 bg-panel2 rounded">
                    <div className="text-[9px] text-gray-600">Max Gen</div>
                    <div className="text-[14px] font-bold text-white">{lineageSummary.maxGeneration}</div>
                  </div>
                  <div className="px-1.5 py-1 bg-panel2 rounded">
                    <div className="text-[9px] text-gray-600">Avg Gen</div>
                    <div className="text-[14px] font-bold text-white">{lineageSummary.averageGeneration.toFixed(1)}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-600 mb-0.5">Operations</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(lineageSummary.operationBreakdown)
                      .filter(([, count]) => count > 0)
                      .map(([op, count]) => (
                        <span key={op} className="px-1 py-0.5 text-[9px] bg-panel2 rounded text-gray-400">
                          {op}: {count}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Click Summary to see the project lineage overview.</p>
            )}

            {/* Component lineage report */}
            <div className="mt-2 border-t border-edge pt-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Component Report</div>
              <select
                value={selectedComponentId}
                onChange={(e) => { setSelectedComponentId(e.target.value); setLineageReport(null); }}
                className="w-full bg-panel2 text-gray-300 text-[10px] px-1.5 py-1 rounded border border-edge mb-1"
              >
                {components.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => runLineageReport(selectedComponentId)}
                disabled={loading === "lineage-report" || !selectedComponentId}
                className="w-full px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40 mb-1"
              >
                {loading === "lineage-report" ? "Querying..." : "Query Lineage"}
              </button>
              {lineageReport ? (
                <div className="space-y-1">
                  <div className="px-1.5 py-1 bg-panel2 rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-300">{lineageReport.componentName}</span>
                      <span className="text-[9px] text-gray-600">gen {lineageReport.generation}</span>
                    </div>
                    <div className="text-[9px] text-gray-500 mt-0.5">{lineageReport.operation}</div>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-[9px] text-gray-600">Anc: {lineageReport.ancestorChain.length}</span>
                      <span className="text-[9px] text-gray-600">Desc: {lineageReport.descendantCount}</span>
                      <span className="text-[9px] text-gray-600">Sib: {lineageReport.siblingCount}</span>
                    </div>
                  </div>
                  {lineageReport.ancestorChain.length > 0 && (
                    <div>
                      <div className="text-[9px] text-gray-600 mb-0.5">Ancestor Chain</div>
                      <div className="space-y-0.5">
                        {lineageReport.ancestorChain.map((a, i) => (
                          <div key={i} className="flex items-center gap-1 text-[9px]">
                            <span className="text-gray-600">gen {a.generation}</span>
                            <span className="text-gray-400">{a.componentName}</span>
                            <span className="text-gray-600">({a.operation})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => projectId && send(projectId, `Show me the full lineage tree of this project`)}
                    className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400 mt-1"
                  >
                    Ask Agent for full tree
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-gray-600">Select a component and query its lineage.</p>
              )}
            </div>
          </div>
        )}

        {/* --- Synthesis --- */}
        {section === "synthesis" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">DNA Synthesis</span>
              <button
                onClick={() => runSynthesis(synthSourceA, synthSourceB, synthStrategy)}
                disabled={loading === "synthesis" || !synthSourceA || !synthSourceB}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "synthesis" ? "..." : "Synthesize"}
              </button>
            </div>
            <div className="space-y-1">
              <div>
                <label className="text-[9px] text-gray-600">Source A</label>
                <select
                  value={synthSourceA}
                  onChange={(e) => { setSynthSourceA(e.target.value); setSynthesis(null); }}
                  className="w-full bg-panel2 text-gray-300 text-[10px] px-1.5 py-1 rounded border border-edge"
                >
                  <option value="">Select...</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-gray-600">Source B</label>
                <select
                  value={synthSourceB}
                  onChange={(e) => { setSynthSourceB(e.target.value); setSynthesis(null); }}
                  className="w-full bg-panel2 text-gray-300 text-[10px] px-1.5 py-1 rounded border border-edge"
                >
                  <option value="">Select...</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-gray-600">Strategy</label>
                <select
                  value={synthStrategy}
                  onChange={(e) => setSynthStrategy(e.target.value)}
                  className="w-full bg-panel2 text-gray-300 text-[10px] px-1.5 py-1 rounded border border-edge"
                >
                  <option value="blend">Blend (average all traits)</option>
                  <option value="dominant">Dominant (70/30 split)</option>
                  <option value="crossover">Crossover (random per trait)</option>
                  <option value="mutation">Mutation (blend + random)</option>
                </select>
              </div>
            </div>
            {synthesis ? (
              <div className="space-y-2">
                <div className="px-1.5 py-1 bg-panel2 rounded">
                  <div className="text-[10px] text-gray-300">{synthesis.strategy.toUpperCase()}</div>
                  <div className="text-[9px] text-gray-500 leading-snug mt-0.5">{synthesis.summary}</div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {synthesis.sourceNames.map((n, i) => (
                      <span key={i} className="px-1 py-0.5 text-[9px] bg-panel3 rounded text-gray-400">{n}</span>
                    ))}
                  </div>
                </div>
                {/* Trait attribution */}
                <div>
                  <div className="text-[9px] text-gray-600 mb-0.5">Trait Attribution</div>
                  <div className="space-y-0.5">
                    {synthesis.attributions.map((attr, i) => {
                      const sourceLabel = attr.sourceIndex === -1 ? "blend/mut" : synthesis.sourceNames[attr.sourceIndex] ?? "?";
                      return (
                        <div key={i} className="flex items-center gap-1 text-[9px]">
                          <span className="text-gray-500 w-20 truncate">{attr.trait}</span>
                          <span className="text-gray-600">←</span>
                          <span className="text-gray-400 w-16 truncate">{sourceLabel}</span>
                          <span className="text-gray-600 truncate">{attr.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Synthesized DNA */}
                <div className="px-1.5 py-1 bg-panel2 rounded">
                  <div className="text-[9px] text-gray-600 mb-0.5">Synthesized DNA</div>
                  <div className="grid grid-cols-2 gap-1 text-[9px]">
                    <div><span className="text-gray-600">Easing:</span> <span className="text-gray-300">{synthesis.dna.easingFamily}</span></div>
                    <div><span className="text-gray-600">Intensity:</span> <span className="text-gray-300">{synthesis.dna.intensity}</span></div>
                    <div><span className="text-gray-600">Bucket:</span> <span className="text-gray-300">{synthesis.dna.timingProfile.durationBucket}</span></div>
                    <div><span className="text-gray-600">Trigger:</span> <span className="text-gray-300">{synthesis.dna.triggerSemantics}</span></div>
                  </div>
                  <div className="text-[9px] text-gray-600 mt-0.5">Signature: <span className="text-gray-400 font-mono">{synthesis.dna.signature}</span></div>
                </div>
                <button
                  onClick={() => projectId && send(projectId, `Synthesize a hybrid motion from ${synthesis.sourceNames.join(" and ")} using ${synthStrategy} strategy and apply it to the canvas`)}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
                >
                  Ask Agent to apply synthesized DNA
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Select two source components and a synthesis strategy.</p>
            )}
          </div>
        )}

        {/* --- Auto-Fix --- */}
        {section === "auto-fix" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Auto-Fix</span>
              <button
                onClick={() => runAutoFix(autoFixApply)}
                disabled={loading === "auto-fix"}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "auto-fix" ? "..." : autoFixApply ? "Run & Apply" : "Dry Run"}
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <input
                type="checkbox"
                checked={autoFixApply}
                onChange={(e) => setAutoFixApply(e.target.checked)}
                className="w-3 h-3 accent-white"
              />
              <span>Apply fixes to project (uncheck for dry-run preview)</span>
            </label>
            {autoFix ? (
              <div className="space-y-2">
                {/* Before / After score */}
                <div className="px-1.5 py-1 bg-panel2 rounded">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-gray-500">Score:</span>
                    <span className="text-gray-400">{autoFix.beforeScore}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-white font-bold">{autoFix.afterScore}</span>
                    <span className="text-gray-500">/100</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] mt-0.5">
                    <span className="text-gray-500">Issues:</span>
                    <span className="text-gray-400">{autoFix.beforeIssueCount}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-white font-bold">{autoFix.afterIssueCount}</span>
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">
                    {autoFix.fixedCount} fix(es) applied · {autoFix.skippedCount} skipped · {autoFix.applied ? "persisted" : "dry-run"}
                  </div>
                </div>

                {/* Fix list */}
                {autoFix.fixes.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Applied Fixes</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {autoFix.fixes.map((fix, i) => (
                        <div key={i} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-0.5 bg-panel3 rounded text-gray-400 uppercase">{fix.category}</span>
                            <span className="text-gray-300 truncate">{fix.componentName}</span>
                          </div>
                          <div className="text-gray-500 mt-0.5 leading-snug">{fix.fix}</div>
                          <div className="text-gray-600 mt-0.5">
                            <span className="text-gray-500">{fix.field}:</span>{" "}
                            <span className="text-gray-400 line-through">{fix.before}</span>{" "}
                            <span className="text-gray-600">→</span>{" "}
                            <span className="text-white">{fix.after}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agent trigger */}
                <button
                  onClick={() => projectId && send(projectId, "Auto-fix accessibility issues across the project and apply the remediations")}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
                >
                  Ask Agent to re-run auto-fix
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Run an accessibility auto-fix pass across the project. Capped displacement, rotation, and loop counts; stretched flashing below the 3Hz threshold; staggered simultaneous animations; normalized timing tiers; and unified easing families.</p>
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
