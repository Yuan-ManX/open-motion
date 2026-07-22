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

interface PersonaAdjustmentData {
  componentId: string;
  componentName: string;
  field: string;
  before: string;
  after: string;
  reason: string;
}

interface PersonaApplicationData {
  applied: boolean;
  personaId: string;
  personaName: string;
  adjustments: PersonaAdjustmentData[];
  componentCount: number;
  adjustedCount: number;
  skippedCount: number;
  summary: string;
}

interface PersonaMatchScoreData {
  personaId: string;
  personaName: string;
  score: number;
  reasons: string[];
}

interface PersonaDetectionData {
  bestMatch: PersonaMatchScoreData | null;
  allScores: PersonaMatchScoreData[];
  summary: string;
}

interface PersonaListItem {
  id: string;
  name: string;
  description: string;
  signatures: string[];
  restraintLevel: string;
  intensityCeiling: string;
}

interface CoachNarrationData {
  componentId: string;
  componentName: string;
  summary: string;
  explanation: string;
  principle: string;
  skillLevel: string;
}

interface CoachSuggestionData {
  tier: string;
  title: string;
  description: string;
  anchorComponentId?: string;
  anchorComponentName?: string;
  principle: string;
}

interface CoachLessonData {
  title: string;
  concept: string;
  example: string;
  anchorComponentId: string;
  anchorComponentName: string;
  exercise: string;
}

interface CoachData {
  proficiency: string;
  proficiencyReason: string;
  narrations: CoachNarrationData[];
  suggestions: CoachSuggestionData[];
  lessons: CoachLessonData[];
  summary: string;
}

interface GenomeDimensionData {
  dimension: string;
  uniqueRatio: number;
  entropy: number;
  distribution: Record<string, number>;
  monoculture: boolean;
  dominantValue?: string;
  dominantShare?: number;
}

interface GenomeTreeNodeData {
  componentId: string;
  componentName: string;
  cluster: number;
  distanceFromCentroid: number;
}

interface GenomeSuggestionData {
  dimension: string;
  message: string;
  componentIds: string[];
  componentNames: string[];
  recommendation: string;
}

interface GenomeData {
  componentCount: number;
  diversityScore: number;
  inbreedingCoefficient: number;
  dimensions: GenomeDimensionData[];
  tree: GenomeTreeNodeData[];
  familyCount: number;
  isMonoculture: boolean;
  monocultureAxes: string[];
  suggestions: GenomeSuggestionData[];
  summary: string;
}

interface ForecastTrendData {
  dimension: string;
  dominantValue: string;
  dominantShare: number;
  projectedShare: number;
  trendingToMonoculture: boolean;
  componentsToLockIn: number | null;
}

interface ForecastMissingAxisData {
  dimension: string;
  missingValues: string[];
  benefit: string;
}

interface ForecastNextMoveData {
  rank: number;
  title: string;
  description: string;
  expectedGain: number;
  action: string;
  primaryDimension: string;
}

interface ForecastRiskData {
  severity: string;
  dimension: string;
  message: string;
  projection: string;
  mitigation: string;
}

interface ForecastProjectedFinalFormData {
  description: string;
  dominantEasing: string;
  dominantTiming: string;
  dominantIntensity: string;
  dominantTransform: string;
  dominantLoop: string;
  healthScore: number;
}

interface ForecastData {
  componentCount: number;
  trends: ForecastTrendData[];
  missingAxes: ForecastMissingAxisData[];
  nextMoves: ForecastNextMoveData[];
  risks: ForecastRiskData[];
  projectedFinalForm: ForecastProjectedFinalFormData;
  summary: string;
}

interface ConstraintProfileData {
  name: string;
  maxDurationMs: number;
  minDurationMs: number;
  maxDisplacementPx: number;
  maxRotationDeg: number;
  maxScale: number;
  maxOpacityDelta: number;
  forbiddenEasings: string[];
  preferredEasings: string[];
  maxLoops: number;
  maxConcurrentAnimations: number;
}

interface NegotiationTradeoffData {
  axis: string;
  userWanted: string;
  constraint: string;
  negotiated: string;
  reason: string;
}

interface ParsedIntentData {
  rawIntent: string;
  speed?: string;
  intensity?: string;
  looping?: boolean;
  colorIntensity?: string;
  complexity?: string;
  extremeSignals: string[];
}

interface NegotiationData {
  applied: boolean;
  intent: string;
  parsedIntent: ParsedIntentData;
  constraintProfile: ConstraintProfileData;
  tradeoffs: NegotiationTradeoffData[];
  complianceScore: number;
  intentFidelityScore: number;
  intentWasCompatible: boolean;
  summary: string;
}

interface RemixChangeData {
  componentId: string;
  componentName: string;
  field: string;
  before: string;
  after: string;
  reason: string;
}

interface RemixData {
  applied: boolean;
  strategy: string;
  seed: number;
  sourceComponentCount: number;
  remixComponentCount: number;
  changeCount: number;
  changes: RemixChangeData[];
  summary: string;
}

type Section = "critique" | "dna" | "variations" | "style" | "story" | "lineage" | "synthesis" | "auto-fix" | "persona" | "coach" | "genome" | "forecast" | "negotiate" | "remix" | "emotion" | "rhythm" | "narrative";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "critique", label: "Critique" },
  { id: "dna", label: "DNA" },
  { id: "variations", label: "Variations" },
  { id: "style", label: "Style Transfer" },
  { id: "story", label: "Story" },
  { id: "lineage", label: "Lineage" },
  { id: "synthesis", label: "Synthesis" },
  { id: "auto-fix", label: "Auto-Fix" },
  { id: "persona", label: "Persona" },
  { id: "coach", label: "Coach" },
  { id: "genome", label: "Genome" },
  { id: "forecast", label: "Forecast" },
  { id: "negotiate", label: "Negotiate" },
  { id: "remix", label: "Remix" },
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
  const [personaList, setPersonaList] = useState<PersonaListItem[] | null>(null);
  const [personaDetection, setPersonaDetection] = useState<PersonaDetectionData | null>(null);
  const [personaApplication, setPersonaApplication] = useState<PersonaApplicationData | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("bauhaus");
  const [coach, setCoach] = useState<CoachData | null>(null);
  const [genome, setGenome] = useState<GenomeData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [negotiation, setNegotiation] = useState<NegotiationData | null>(null);
  const [negotiationIntent, setNegotiationIntent] = useState<string>("a really fast spin with bright rainbow flashing");
  const [negotiationProfile, setNegotiationProfile] = useState<string>("vestibular-safe");
  const [remix, setRemix] = useState<RemixData | null>(null);
  const [remixStrategy, setRemixStrategy] = useState<string>("shuffle");
  const [remixSeed, setRemixSeed] = useState<string>("");
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

  const loadPersonaList = useCallback(async () => {
    setLoading("persona");
    try {
      const resp = await fetch(`/api/personas`, { headers: { ...getAuthHeaders() } });
      if (resp.ok) {
        const data = await resp.json();
        setPersonaList(data.personas);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, []);

  const runPersonaDetection = useCallback(async () => {
    if (!projectId) return;
    setLoading("persona");
    try {
      const resp = await fetch(`/api/projects/${projectId}/persona-detection`, { headers: { ...getAuthHeaders() } });
      if (resp.ok) {
        const data = await resp.json();
        setPersonaDetection({
          bestMatch: data.bestMatch,
          allScores: data.allScores,
          summary: data.summary,
        });
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runPersonaApply = useCallback(async (personaId: string) => {
    if (!projectId) return;
    setLoading("persona");
    try {
      const resp = await fetch(`/api/projects/${projectId}/apply-persona`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ personaId, apply: true }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setPersonaApplication({
          applied: data.applied,
          personaId: data.personaId,
          personaName: data.personaName,
          adjustments: data.adjustments,
          componentCount: data.componentCount,
          adjustedCount: data.adjustedCount,
          skippedCount: data.skippedCount,
          summary: data.summary,
        });
        // Reload project to reflect applied persona on canvas.
        if (data.applied && data.adjustedCount > 0) {
          await loadProject(projectId);
        }
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId, loadProject]);

  const runCoach = useCallback(async () => {
    if (!projectId) return;
    setLoading("coach");
    try {
      const resp = await fetch(`/api/projects/${projectId}/coach`, { headers: { ...getAuthHeaders() } });
      if (resp.ok) {
        const data = await resp.json();
        setCoach({
          proficiency: data.proficiency,
          proficiencyReason: data.proficiencyReason,
          narrations: data.narrations,
          suggestions: data.suggestions,
          lessons: data.lessons,
          summary: data.summary,
        });
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runGenome = useCallback(async () => {
    if (!projectId) return;
    setLoading("genome");
    try {
      const resp = await fetch(`/api/projects/${projectId}/genome`, { headers: { ...getAuthHeaders() } });
      if (resp.ok) {
        const data = await resp.json();
        setGenome({
          componentCount: data.componentCount,
          diversityScore: data.diversityScore,
          inbreedingCoefficient: data.inbreedingCoefficient,
          dimensions: data.dimensions,
          tree: data.tree,
          familyCount: data.familyCount,
          isMonoculture: data.isMonoculture,
          monocultureAxes: data.monocultureAxes,
          suggestions: data.suggestions,
          summary: data.summary,
        });
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runForecast = useCallback(async () => {
    if (!projectId) return;
    setLoading("forecast");
    try {
      const resp = await fetch(`/api/projects/${projectId}/forecast`, { headers: { ...getAuthHeaders() } });
      if (resp.ok) {
        const data = await resp.json();
        setForecast({
          componentCount: data.componentCount,
          trends: data.trends,
          missingAxes: data.missingAxes,
          nextMoves: data.nextMoves,
          risks: data.risks,
          projectedFinalForm: data.projectedFinalForm,
          summary: data.summary,
        });
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  const runNegotiate = useCallback(async (apply: boolean) => {
    if (!projectId) return;
    if (!negotiationIntent.trim()) return;
    setLoading("negotiate");
    try {
      const resp = await fetch(`/api/projects/${projectId}/negotiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          intent: negotiationIntent,
          profile: negotiationProfile,
          apply,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setNegotiation({
          applied: data.applied,
          intent: data.intent,
          parsedIntent: data.parsedIntent,
          constraintProfile: data.constraintProfile,
          tradeoffs: data.tradeoffs,
          complianceScore: data.complianceScore,
          intentFidelityScore: data.intentFidelityScore,
          intentWasCompatible: data.intentWasCompatible,
          summary: data.summary,
        });
        // When the negotiated changes were applied, reload the project so the
        // canvas reflects them.
        if (data.applied) {
          await loadProject(projectId);
        }
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId, negotiationIntent, negotiationProfile, loadProject]);

  const runRemix = useCallback(async (apply: boolean) => {
    if (!projectId) return;
    setLoading("remix");
    try {
      const body: Record<string, unknown> = { strategy: remixStrategy, apply };
      if (remixSeed.trim()) {
        const seedNum = parseInt(remixSeed.trim(), 10);
        if (!isNaN(seedNum)) body.seed = seedNum;
      }
      const resp = await fetch(`/api/projects/${projectId}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        const data = await resp.json();
        setRemix({
          applied: data.applied,
          strategy: data.strategy,
          seed: data.seed,
          sourceComponentCount: data.sourceComponentCount,
          remixComponentCount: data.remixComponentCount,
          changeCount: data.changeCount,
          changes: data.changes,
          summary: data.summary,
        });
        // When the remixed changes were applied, reload the project so the
        // canvas reflects them.
        if (data.applied) {
          await loadProject(projectId);
        }
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(null);
    }
  }, [projectId, remixStrategy, remixSeed, loadProject]);

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

        {/* --- Persona --- */}
        {section === "persona" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Persona</span>
              <div className="flex gap-1">
                <button
                  onClick={loadPersonaList}
                  disabled={loading === "persona"}
                  className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
                >
                  {loading === "persona" ? "..." : "List"}
                </button>
                <button
                  onClick={runPersonaDetection}
                  disabled={loading === "persona" || components.length === 0}
                  className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
                >
                  Detect
                </button>
              </div>
            </div>

            {/* Persona list */}
            {personaList && (
              <div>
                <div className="text-[9px] text-gray-600 mb-0.5">Available Personas ({personaList.length})</div>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {personaList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPersonaId(p.id)}
                      className={`w-full text-left px-1.5 py-1 rounded text-[9px] ${
                        selectedPersonaId === p.id ? "bg-panel3 text-white" : "bg-panel2 text-gray-400 hover:bg-panel3"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{p.name}</span>
                        <span className="text-gray-600">{p.intensityCeiling} · {p.restraintLevel}</span>
                      </div>
                      <div className="text-gray-500 mt-0.5 leading-snug">{p.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Detection result */}
            {personaDetection && personaDetection.bestMatch && (
              <div className="px-1.5 py-1 bg-panel2 rounded">
                <div className="text-[9px] text-gray-600 mb-0.5">Detection</div>
                <div className="text-[10px] text-white font-bold">
                  Best: {personaDetection.bestMatch.personaName} ({personaDetection.bestMatch.score}/100)
                </div>
                <div className="space-y-0.5 mt-1">
                  {personaDetection.allScores.map((s) => (
                    <div key={s.personaId} className="flex items-center gap-1.5 text-[9px]">
                      <span className="text-gray-500 w-16 truncate">{s.personaName}</span>
                      <div className="flex-1 h-1 bg-panel3 rounded overflow-hidden">
                        <div className="h-full bg-white" style={{ width: `${s.score}%` }} />
                      </div>
                      <span className="text-gray-400 w-6 text-right">{s.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Apply */}
            <div className="flex items-center gap-1">
              <select
                value={selectedPersonaId}
                onChange={(e) => setSelectedPersonaId(e.target.value)}
                className="flex-1 px-1.5 py-0.5 text-[10px] bg-panel2 border border-panel3 rounded text-white"
              >
                <option value="bauhaus">Bauhaus</option>
                <option value="apple-hig">Apple HIG</option>
                <option value="material">Material</option>
                <option value="brutalist">Brutalist</option>
                <option value="memphis">Memphis</option>
                <option value="art-deco">Art Deco</option>
                <option value="swiss">Swiss</option>
                <option value="vaporwave">Vaporwave</option>
              </select>
              <button
                onClick={() => runPersonaApply(selectedPersonaId)}
                disabled={loading === "persona" || components.length === 0}
                className="px-2 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                Apply
              </button>
            </div>

            {/* Application result */}
            {personaApplication && (
              <div className="space-y-1">
                <div className="px-1.5 py-1 bg-panel2 rounded">
                  <div className="text-[10px] text-white font-bold">
                    {personaApplication.personaName}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">
                    {personaApplication.adjustedCount}/{personaApplication.componentCount} adjusted · {personaApplication.adjustments.length} change(s) · {personaApplication.applied ? "persisted" : "dry-run"}
                  </div>
                </div>
                {personaApplication.adjustments.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Adjustments</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {personaApplication.adjustments.slice(0, 30).map((adj, i) => (
                        <div key={i} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="text-gray-300 truncate">{adj.componentName} · {adj.field}</div>
                          <div className="text-gray-500 mt-0.5">
                            <span className="text-gray-400 line-through">{adj.before}</span>{" "}
                            <span className="text-gray-600">→</span>{" "}
                            <span className="text-white">{adj.after}</span>
                          </div>
                          <div className="text-gray-600 mt-0.5 leading-snug">{adj.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => projectId && send(projectId, `Apply the ${personaApplication.personaName} design persona across the project`)}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
                >
                  Ask Agent to re-apply {personaApplication.personaName}
                </button>
              </div>
            )}

            {!personaList && !personaDetection && !personaApplication && (
              <p className="text-[10px] text-gray-600">Apply a complete design philosophy — Bauhaus geometry, Apple HIG restraint, Material expressiveness, Brutalist rawness, Memphis playfulness, Art Deco symmetry, Swiss grid discipline, Vaporwave nostalgia. Each persona reshapes easing, timing, intensity, and properties to embody a named design language.</p>
            )}
          </div>
        )}

        {/* --- Coach --- */}
        {section === "coach" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Coach</span>
              <button
                onClick={runCoach}
                disabled={loading === "coach" || components.length === 0}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "coach" ? "..." : "Coach me"}
              </button>
            </div>

            {coach ? (
              <div className="space-y-2">
                {/* Proficiency */}
                <div className="px-1.5 py-1 bg-panel2 rounded">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-gray-500">Proficiency:</span>
                    <span className="text-white font-bold uppercase">{coach.proficiency}</span>
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5 leading-snug">{coach.proficiencyReason}</div>
                </div>

                {/* Narrations */}
                {coach.narrations.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Narrations ({coach.narrations.length})</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {coach.narrations.map((n) => (
                        <div key={n.componentId} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 font-bold truncate">{n.componentName}</span>
                            <span className="text-gray-600 uppercase">{n.skillLevel}</span>
                          </div>
                          <div className="text-gray-400 mt-0.5 leading-snug">{n.summary}</div>
                          <div className="text-gray-600 mt-0.5 italic">principle: {n.principle}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {coach.suggestions.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Suggestions ({coach.suggestions.length})</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {coach.suggestions.map((s, i) => (
                        <div key={i} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1 py-0.5 bg-panel3 rounded text-gray-400 uppercase">{s.tier}</span>
                            <span className="text-gray-300 font-bold">{s.title}</span>
                          </div>
                          <div className="text-gray-500 mt-0.5 leading-snug">{s.description}</div>
                          {s.anchorComponentName && (
                            <div className="text-gray-600 mt-0.5">anchored to: {s.anchorComponentName}</div>
                          )}
                          <div className="text-gray-600 mt-0.5 italic">{s.principle}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lessons */}
                {coach.lessons.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Lesson Plan ({coach.lessons.length})</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {coach.lessons.map((lesson, i) => (
                        <div key={i} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="text-gray-300 font-bold">{lesson.title}</div>
                          <div className="text-gray-500 mt-0.5 leading-snug">{lesson.concept}</div>
                          <div className="text-gray-600 mt-0.5 leading-snug">example: {lesson.example}</div>
                          <div className="text-gray-500 mt-0.5 leading-snug italic">exercise: {lesson.exercise}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => projectId && send(projectId, "Coach me through this project — explain what each animation does and suggest what I should try next")}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
                >
                  Ask Agent to re-coach
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Run a coaching pass: the Agent narrates each component in plain language, infers your proficiency from the project's complexity, suggests skill-tiered next steps, and builds a lesson plan anchored to real components you can study.</p>
            )}
          </div>
        )}

        {/* --- Genome --- */}
        {section === "genome" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Genome</span>
              <button
                onClick={runGenome}
                disabled={loading === "genome" || components.length < 2}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "genome" ? "..." : "Analyze"}
              </button>
            </div>

            {genome ? (
              <div className="space-y-2">
                {/* Population summary */}
                <div className="px-1.5 py-1 bg-panel2 rounded">
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div>
                      <span className="text-gray-500">Components:</span>{" "}
                      <span className="text-white">{genome.componentCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Families:</span>{" "}
                      <span className="text-white">{genome.familyCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Diversity:</span>{" "}
                      <span className={genome.diversityScore >= 60 ? "text-white" : "text-red-400"}>
                        {genome.diversityScore}/100
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Inbreeding:</span>{" "}
                      <span className={genome.inbreedingCoefficient <= 0.5 ? "text-white" : "text-red-400"}>
                        {genome.inbreedingCoefficient}
                      </span>
                    </div>
                  </div>
                  {genome.isMonoculture && (
                    <div className="text-[9px] text-red-400 mt-1">
                      MONOCULTURE on: {genome.monocultureAxes.join(", ")}
                    </div>
                  )}
                </div>

                {/* Per-dimension diversity */}
                {genome.dimensions.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Per-Dimension Diversity</div>
                    <div className="space-y-0.5">
                      {genome.dimensions.map((dim) => (
                        <div key={dim.dimension} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 uppercase">{dim.dimension}</span>
                            {dim.monoculture ? (
                              <span className="text-red-400">MONOCULTURE</span>
                            ) : (
                              <span className="text-gray-500">entropy {dim.entropy.toFixed(2)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex-1 h-1 bg-panel3 rounded overflow-hidden">
                              <div
                                className={dim.monoculture ? "h-full bg-red-400" : "h-full bg-white"}
                                style={{ width: `${Math.round(dim.entropy * 100)}%` }}
                              />
                            </div>
                            <span className="text-gray-500 w-6 text-right">{Math.round(dim.entropy * 100)}</span>
                          </div>
                          {dim.dominantValue && dim.dominantShare && (
                            <div className="text-gray-600 mt-0.5">
                              dominant: {dim.dominantValue} ({Math.round(dim.dominantShare * 100)}%)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evolutionary tree */}
                {genome.tree.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Evolutionary Tree ({genome.familyCount} families)</div>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                      {Array.from(new Set(genome.tree.map((n) => n.cluster))).sort((a, b) => a - b).map((cluster) => {
                        const members = genome.tree.filter((n) => n.cluster === cluster);
                        return (
                          <div key={cluster} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                            <div className="text-gray-400 font-bold">Family {cluster}</div>
                            {members.map((m) => (
                              <div key={m.componentId} className="text-gray-500 pl-2">
                                {m.componentName} <span className="text-gray-600">(dist {m.distanceFromCentroid})</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Diversification suggestions */}
                {genome.suggestions.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Diversification Suggestions</div>
                    <div className="space-y-1">
                      {genome.suggestions.map((s, i) => (
                        <div key={i} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="text-gray-300">[{s.dimension}] {s.message}</div>
                          <div className="text-gray-500 mt-0.5 leading-snug">{s.recommendation}</div>
                          <div className="text-gray-600 mt-0.5">vary: {s.componentNames.join(", ")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => projectId && send(projectId, "Analyze the genetic diversity of my project — compute the genome, detect monoculture, and suggest how to diversify")}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
                >
                  Ask Agent to re-analyze genome
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Analyze project-level population genetics: genetic diversity (Shannon entropy across easing, timing, intensity, transform, loop), inbreeding coefficient (average pairwise DNA similarity), evolutionary tree (clusters of related components), monoculture detection, and diversification suggestions anchored to specific components.</p>
            )}
          </div>
        )}

        {/* --- Forecast --- */}
        {section === "forecast" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Forecast</span>
              <button
                onClick={runForecast}
                disabled={loading === "forecast" || components.length === 0}
                className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
              >
                {loading === "forecast" ? "..." : "Forecast"}
              </button>
            </div>

            {forecast ? (
              <div className="space-y-2">
                {/* Projected final form */}
                <div className="px-1.5 py-1 bg-panel2 rounded">
                  <div className="text-[9px] text-gray-600 mb-0.5">Projected Final Form</div>
                  <div className="text-[10px] text-gray-300 leading-snug">{forecast.projectedFinalForm.description}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px]">
                    <span className="text-gray-500">Health:</span>
                    <span className={forecast.projectedFinalForm.healthScore >= 60 ? "text-white font-bold" : "text-red-400 font-bold"}>
                      {forecast.projectedFinalForm.healthScore}/100
                    </span>
                  </div>
                </div>

                {/* Trends */}
                {forecast.trends.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Trend Projections</div>
                    <div className="space-y-0.5">
                      {forecast.trends.map((t) => (
                        <div key={t.dimension} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 uppercase">{t.dimension}</span>
                            {t.trendingToMonoculture ? (
                              <span className="text-red-400">↑ TREND</span>
                            ) : (
                              <span className="text-gray-500">→</span>
                            )}
                          </div>
                          <div className="text-gray-400 mt-0.5">
                            {t.dominantValue}: {Math.round(t.dominantShare * 100)}% → {Math.round(t.projectedShare * 100)}%
                          </div>
                          {t.componentsToLockIn !== null && t.componentsToLockIn > 0 && (
                            <div className="text-gray-600 mt-0.5">{t.componentsToLockIn} more locks monoculture</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing axes */}
                {forecast.missingAxes.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Missing Axes ({forecast.missingAxes.length})</div>
                    <div className="space-y-0.5">
                      {forecast.missingAxes.map((axis, i) => (
                        <div key={i} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="text-gray-300">
                            {axis.dimension}: <span className="text-gray-400">{axis.missingValues.join(", ")}</span>
                          </div>
                          <div className="text-gray-500 mt-0.5 leading-snug">{axis.benefit}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next moves */}
                {forecast.nextMoves.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Recommended Next Moves</div>
                    <div className="space-y-0.5">
                      {forecast.nextMoves.slice(0, 5).map((move) => (
                        <div key={move.rank} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 font-bold">#{move.rank} {move.title}</span>
                            <span className="text-gray-500">+{move.expectedGain}</span>
                          </div>
                          <div className="text-gray-500 mt-0.5 leading-snug">{move.description}</div>
                          <div className="text-gray-600 mt-0.5 italic">action: {move.action}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks */}
                {forecast.risks.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Risk Assessment</div>
                    <div className="space-y-0.5">
                      {forecast.risks.map((risk, i) => (
                        <div key={i} className={`px-1.5 py-1 rounded text-[9px] ${risk.severity === "critical" ? "bg-panel2 border border-red-900" : "bg-panel2"}`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1 py-0.5 rounded uppercase ${risk.severity === "critical" ? "bg-red-900 text-red-200" : risk.severity === "warning" ? "bg-panel3 text-gray-300" : "bg-panel3 text-gray-500"}`}>
                              {risk.severity}
                            </span>
                            <span className="text-gray-300">{risk.dimension}</span>
                          </div>
                          <div className="text-gray-400 mt-0.5 leading-snug">{risk.message}</div>
                          <div className="text-gray-600 mt-0.5 leading-snug">projection: {risk.projection}</div>
                          <div className="text-gray-500 mt-0.5 leading-snug">mitigation: {risk.mitigation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => projectId && send(projectId, "Forecast where my project is trending — project the trajectory, flag risks, and recommend what I should add next")}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
                >
                  Ask Agent to re-forecast
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Project current trends forward: extrapolate dominant DNA traits, detect monoculture lock-in trajectory, identify missing axes the project hasn't explored, rank next moves by expected diversity gain, and flag risks if patterns continue unchecked.</p>
            )}
          </div>
        )}

        {/* --- Negotiate --- */}
        {section === "negotiate" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Negotiate</span>
              <div className="flex gap-1">
                <button
                  onClick={() => runNegotiate(false)}
                  disabled={loading === "negotiate" || !negotiationIntent.trim()}
                  className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
                >
                  {loading === "negotiate" ? "..." : "Dry Run"}
                </button>
                <button
                  onClick={() => runNegotiate(true)}
                  disabled={loading === "negotiate" || !negotiationIntent.trim() || components.length === 0}
                  className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Intent input */}
            <div>
              <div className="text-[9px] text-gray-600 mb-0.5">Intent</div>
              <input
                type="text"
                value={negotiationIntent}
                onChange={(e) => setNegotiationIntent(e.target.value)}
                placeholder="e.g., a really fast spin with bright rainbow flashing"
                className="w-full px-1.5 py-0.5 text-[10px] bg-panel2 border border-panel3 rounded text-white"
              />
            </div>

            {/* Profile selector */}
            <div>
              <div className="text-[9px] text-gray-600 mb-0.5">Constraint Profile</div>
              <select
                value={negotiationProfile}
                onChange={(e) => setNegotiationProfile(e.target.value)}
                className="w-full px-1.5 py-0.5 text-[10px] bg-panel2 border border-panel3 rounded text-white"
              >
                <option value="vestibular-safe">Vestibular-Safe</option>
                <option value="photosensitivity-safe">Photosensitivity-Safe</option>
                <option value="cognitive-safe">Cognitive-Safe</option>
                <option value="reduced-motion">Reduced-Motion</option>
                <option value="unconstrained">Unconstrained</option>
              </select>
            </div>

            {negotiation ? (
              <div className="space-y-2">
                {/* Scores */}
                <div className="px-1.5 py-1 bg-panel2 rounded">
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div>
                      <span className="text-gray-500">Compliance:</span>{" "}
                      <span className={negotiation.complianceScore >= 80 ? "text-white font-bold" : "text-red-400 font-bold"}>
                        {negotiation.complianceScore}/100
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fidelity:</span>{" "}
                      <span className={negotiation.intentFidelityScore >= 60 ? "text-white font-bold" : "text-red-400 font-bold"}>
                        {negotiation.intentFidelityScore}/100
                      </span>
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">
                    {negotiation.intentWasCompatible
                      ? "✓ Intent compatible — no negotiation needed"
                      : `${negotiation.tradeoffs.length} trade-off(s) · ${negotiation.applied ? "persisted" : "dry-run"}`}
                  </div>
                </div>

                {/* Parsed intent */}
                <div className="px-1.5 py-1 bg-panel2 rounded">
                  <div className="text-[9px] text-gray-600 mb-0.5">Parsed Intent</div>
                  <div className="grid grid-cols-2 gap-1 text-[9px]">
                    <div><span className="text-gray-500">speed:</span> <span className="text-gray-300">{negotiation.parsedIntent.speed ?? "default"}</span></div>
                    <div><span className="text-gray-500">intensity:</span> <span className="text-gray-300">{negotiation.parsedIntent.intensity ?? "default"}</span></div>
                    <div><span className="text-gray-500">looping:</span> <span className="text-gray-300">{negotiation.parsedIntent.looping ? "yes" : "no"}</span></div>
                    <div><span className="text-gray-500">color:</span> <span className="text-gray-300">{negotiation.parsedIntent.colorIntensity ?? "default"}</span></div>
                    <div><span className="text-gray-500">complexity:</span> <span className="text-gray-300">{negotiation.parsedIntent.complexity ?? "default"}</span></div>
                  </div>
                  {negotiation.parsedIntent.extremeSignals.length > 0 && (
                    <div className="text-[9px] text-red-400 mt-0.5">
                      extreme: {negotiation.parsedIntent.extremeSignals.join(", ")}
                    </div>
                  )}
                </div>

                {/* Trade-offs */}
                {negotiation.tradeoffs.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Trade-offs ({negotiation.tradeoffs.length})</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {negotiation.tradeoffs.map((t, i) => (
                        <div key={i} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="text-gray-300 font-bold uppercase">[{t.axis}]</div>
                          <div className="text-gray-500 mt-0.5">
                            <span className="text-gray-400 line-through">{t.userWanted}</span>{" "}
                            <span className="text-gray-600">→</span>{" "}
                            <span className="text-white">{t.negotiated}</span>
                          </div>
                          <div className="text-gray-600 mt-0.5 leading-snug">{t.constraint}</div>
                          <div className="text-gray-500 mt-0.5 leading-snug italic">{t.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => projectId && send(projectId, `Negotiate this intent against accessibility constraints and propose a safe compromise: ${negotiationIntent}`)}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
                >
                  Ask Agent to re-negotiate
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">When a creative intent conflicts with accessibility constraints (vestibular, photosensitivity, cognitive, reduced-motion), the Negotiator finds a compromise that preserves the user's creative direction while satisfying the constraints. Each trade-off is documented with the user's original want, the constraint that forced the negotiation, the negotiated value, and the reason.</p>
            )}
          </div>
        )}

        {/* --- Remix --- */}
        {section === "remix" && (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Remix</span>
              <div className="flex gap-1">
                <button
                  onClick={() => runRemix(false)}
                  disabled={loading === "remix" || components.length === 0}
                  className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
                >
                  {loading === "remix" ? "..." : "Dry Run"}
                </button>
                <button
                  onClick={() => runRemix(true)}
                  disabled={loading === "remix" || components.length === 0}
                  className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>

            {components.length === 0 && (
              <p className="text-[10px] text-red-400">Add at least one component before remixing.</p>
            )}

            {/* Strategy selector */}
            <div>
              <div className="text-[9px] text-gray-600 mb-0.5">Strategy</div>
              <select
                value={remixStrategy}
                onChange={(e) => setRemixStrategy(e.target.value)}
                className="w-full px-1.5 py-0.5 text-[10px] bg-panel2 border border-panel3 rounded text-white"
              >
                <option value="shuffle">Shuffle — randomize order</option>
                <option value="mirror">Mirror — invert directions</option>
                <option value="invert">Invert — swap intensity tiers</option>
                <option value="swap">Swap — exchange easings</option>
                <option value="cascade">Cascade — stagger delays</option>
                <option value="scatter">Scatter — randomize timing</option>
                <option value="hybridize">Hybridize — cross-pollinate keyframes</option>
                <option value="rephrase">Rephrase — change mood</option>
              </select>
            </div>

            {/* Seed input (optional) */}
            <div>
              <div className="text-[9px] text-gray-600 mb-0.5">Seed (optional — leave empty for random)</div>
              <input
                type="text"
                value={remixSeed}
                onChange={(e) => setRemixSeed(e.target.value)}
                placeholder="e.g., 12345 (for reproducibility)"
                className="w-full px-1.5 py-0.5 text-[10px] bg-panel2 border border-panel3 rounded text-white"
              />
            </div>

            {remix ? (
              <div className="space-y-2">
                {/* Summary */}
                <div className="px-1.5 py-1 bg-panel2 rounded">
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div>
                      <span className="text-gray-500">strategy:</span>{" "}
                      <span className="text-white font-bold">{remix.strategy}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">seed:</span>{" "}
                      <span className="text-white">{remix.seed}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">changes:</span>{" "}
                      <span className="text-white">{remix.changeCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">applied:</span>{" "}
                      <span className={remix.applied ? "text-white font-bold" : "text-gray-400"}>{remix.applied ? "yes" : "no (dry-run)"}</span>
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{remix.summary}</div>
                </div>

                {/* Changes */}
                {remix.changes.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 mb-0.5">Changes ({remix.changes.length})</div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {remix.changes.map((c, i) => (
                        <div key={i} className="px-1.5 py-1 bg-panel2 rounded text-[9px]">
                          <div className="text-gray-300 font-bold">{c.componentName}</div>
                          <div className="text-gray-500 mt-0.5">
                            <span className="text-gray-400">{c.field}:</span>{" "}
                            <span className="text-gray-400 line-through">{c.before}</span>{" "}
                            <span className="text-gray-600">→</span>{" "}
                            <span className="text-white">{c.after}</span>
                          </div>
                          <div className="text-gray-500 mt-0.5 leading-snug italic">{c.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => projectId && send(projectId, `Remix this project using the ${remixStrategy} strategy — give me a fresh take`)}
                  className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
                >
                  Ask Agent to re-remix
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">Remix produces a fresh interpretation of the project by recombining components using one of eight strategies: shuffle, mirror, invert, swap, cascade, scatter, hybridize, rephrase. Each remix is reproducible by seed and documented with a per-component change log.</p>
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
