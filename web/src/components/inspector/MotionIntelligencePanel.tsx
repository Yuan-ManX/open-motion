import { useState, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";

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

/**
 * Motion Intelligence panel — displays emotional, rhythmic, and narrative
 * analysis of the current motion composition. Offers one-click Agent triggers
 * for each analysis dimension.
 */
export function MotionIntelligencePanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const send = useChatStore((s) => s.send);
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

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
      // Silently handle — the panel can work offline with mock data
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
    <div className="h-full overflow-y-auto text-xs text-gray-300">
      <div className="px-3 py-2 border-b border-edge">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Motion Intelligence</h3>
      </div>

      {/* Emotion Analysis */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="flex items-center justify-between mb-1">
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
            <div className="flex gap-2">
              <span className="text-gray-500">Dominant:</span>
              <span className="text-gray-200">{report.emotion.dominantEmotion}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">Arc:</span>
              <span className="text-gray-200">{report.emotion.emotionalArc}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">Peak:</span>
              <span className="text-gray-200">{Math.round(report.emotion.peakIntensity * 100)}%</span>
            </div>
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

      {/* Rhythm Analysis */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="flex items-center justify-between mb-1">
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
            <div className="flex gap-2">
              <span className="text-gray-500">Tempo:</span>
              <span className="text-gray-200">{Math.round(report.rhythm.tempoBpm)} BPM</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">Type:</span>
              <span className="text-gray-200">{report.rhythm.rhythmType}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">Regularity:</span>
              <span className="text-gray-200">{Math.round(report.rhythm.regularity * 100)}%</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">Groove:</span>
              <span className="text-gray-200">{Math.round(report.rhythm.groove * 100)}%</span>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-gray-600">Click Analyze to detect the visual rhythm.</p>
        )}
      </div>

      {/* Narrative Analysis */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="flex items-center justify-between mb-1">
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
            <div className="flex gap-2">
              <span className="text-gray-500">Pacing:</span>
              <span className="text-gray-200">{report.narrative.pacingScore}/100</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">Coherence:</span>
              <span className="text-gray-200">{report.narrative.coherenceScore}/100</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">Arc:</span>
              <span className="text-gray-200">{report.narrative.hasCompleteArc ? "Complete" : "Incomplete"}</span>
            </div>
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

      {/* Quick prompts */}
      <div className="px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Quick Prompts</div>
        <div className="space-y-1">
          <button
            onClick={() => projectId && send(projectId, "What emotion does this motion convey?")}
            className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
          >
            "What emotion does this convey?"
          </button>
          <button
            onClick={() => projectId && send(projectId, "Analyze the rhythm of this motion")}
            className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
          >
            "Analyze the rhythm"
          </button>
          <button
            onClick={() => projectId && send(projectId, "Does this motion tell a story?")}
            className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
          >
            "Does this tell a story?"
          </button>
        </div>
      </div>
    </div>
  );
}

function getAuthHeaders(): Record<string, string> {
  const key = typeof localStorage !== "undefined" ? localStorage.getItem("openmotion_api_key") : null;
  return key ? { "X-API-Key": key } : {};
}
