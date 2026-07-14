import { useState, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";

interface StoryBeat {
  id: string;
  name: string;
  act: string;
  startMs: number;
  durationMs: number;
  emotionalTone: string;
  intensity: number;
}

interface StoryArcData {
  id: string;
  name: string;
  genre: string;
  beats: StoryBeat[];
  totalDurationMs: number;
  climaxPosition: number;
  pacingScore: number;
}

interface PacingData {
  avgTempo: number;
  overallScore: number;
  recommendations: string[];
  slowSegments: { reason: string }[];
  fastSegments: { reason: string }[];
}

const GENRES = [
  { id: "hero", name: "Hero's Journey" },
  { id: "mystery", name: "Mystery" },
  { id: "romance", name: "Romance" },
  { id: "comedy", name: "Comedy" },
  { id: "thriller", name: "Thriller" },
  { id: "documentary", name: "Documentary" },
  { id: "fantasy", name: "Fantasy" },
  { id: "horror", name: "Horror" },
];

/**
 * Storytelling panel — create story arcs, visualize beats, analyze pacing,
 * and apply narrative timing to components via the Agent.
 */
export function StorytellingPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const send = useChatStore((s) => s.send);
  const [arc, setArc] = useState<StoryArcData | null>(null);
  const [pacing, setPacing] = useState<PacingData | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>("hero");
  const [loading, setLoading] = useState(false);

  const createArc = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/chat?stream=false`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ message: `Create a ${selectedGenre} story arc` }),
      });
      const data = await resp.json();
      if (data.toolResults) {
        for (const tr of data.toolResults) {
          if (tr.tool === "create_story_arc" && tr.result?.data?.arc) {
            setArc(tr.result.data.arc);
          }
        }
      }
    } catch {
      // Offline mode — generate a mock arc
      setArc({
        id: "mock_arc",
        name: GENRES.find((g) => g.id === selectedGenre)?.name || "Story Arc",
        genre: selectedGenre,
        totalDurationMs: 10000,
        climaxPosition: 0.5,
        pacingScore: 75,
        beats: [
          { id: "b1", name: "Opening", act: "setup", startMs: 0, durationMs: 1500, emotionalTone: "calm", intensity: 0.2 },
          { id: "b2", name: "Building Tension", act: "rising", startMs: 1500, durationMs: 2000, emotionalTone: "curious", intensity: 0.5 },
          { id: "b3", name: "The Peak", act: "climax", startMs: 3500, durationMs: 2500, emotionalTone: "triumphant", intensity: 1.0 },
          { id: "b4", name: "Aftermath", act: "falling", startMs: 6000, durationMs: 1500, emotionalTone: "contemplative", intensity: 0.6 },
          { id: "b5", name: "Conclusion", act: "resolution", startMs: 7500, durationMs: 2500, emotionalTone: "calm", intensity: 0.3 },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedGenre]);

  const runPacingAnalysis = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/chat?stream=false`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ message: "Analyze the pacing of the story arc" }),
      });
      const data = await resp.json();
      if (data.toolResults) {
        for (const tr of data.toolResults) {
          if (tr.tool === "analyze_pacing" && tr.result?.data) {
            setPacing(tr.result.data);
          }
        }
      }
    } catch {
      setPacing({
        avgTempo: 85,
        overallScore: 72,
        recommendations: ["Pacing is well-balanced — the story flows naturally."],
        slowSegments: [],
        fastSegments: [],
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        Open a project to create story arcs.
      </div>
    );
  }

  const actColors: Record<string, string> = {
    setup: "bg-gray-600",
    rising: "bg-gray-500",
    climax: "bg-white",
    falling: "bg-gray-400",
    resolution: "bg-gray-700",
  };

  return (
    <div className="h-full overflow-y-auto text-xs text-gray-300">
      <div className="px-3 py-2 border-b border-edge">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Storytelling</h3>
      </div>

      {/* Genre selector */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Genre</div>
        <div className="grid grid-cols-2 gap-1">
          {GENRES.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGenre(g.id)}
              className={`px-1.5 py-1 text-[9px] rounded ${
                selectedGenre === g.id
                  ? "bg-white text-black font-medium"
                  : "bg-panel2 hover:bg-panel3 text-gray-400"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
        <button
          onClick={createArc}
          disabled={loading}
          className="w-full mt-2 px-2 py-1 text-[10px] bg-white text-black font-medium rounded hover:bg-gray-200 disabled:opacity-40"
        >
          {loading ? "Creating..." : "Create Story Arc"}
        </button>
      </div>

      {/* Arc visualization */}
      {arc && (
        <div className="px-3 py-2 border-b border-edge">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Arc: {arc.name}</div>
          <div className="flex gap-2 text-[10px] mb-2">
            <span className="text-gray-500">Duration:</span>
            <span className="text-gray-200">{(arc.totalDurationMs / 1000).toFixed(1)}s</span>
            <span className="text-gray-500">Climax:</span>
            <span className="text-gray-200">{Math.round(arc.climaxPosition * 100)}%</span>
            <span className="text-gray-500">Score:</span>
            <span className="text-gray-200">{arc.pacingScore}/100</span>
          </div>

          {/* Beat timeline */}
          <div className="space-y-1">
            {arc.beats.map((beat) => (
              <div key={beat.id} className="flex items-center gap-1">
                <div
                  className={`${actColors[beat.act] || "bg-gray-600"} flex-shrink-0 w-1.5 h-4 rounded-sm`}
                  style={{ opacity: 0.3 + beat.intensity * 0.7 }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-gray-300 truncate">{beat.name}</div>
                  <div className="text-[9px] text-gray-600">
                    {beat.act} · {beat.emotionalTone} · {Math.round(beat.intensity * 100)}%
                  </div>
                </div>
                <div className="text-[9px] text-gray-600 font-mono">
                  {(beat.startMs / 1000).toFixed(1)}s
                </div>
              </div>
            ))}
          </div>

          {/* Intensity bar */}
          <div className="mt-2">
            <div className="text-[9px] text-gray-600 mb-0.5">Intensity Curve</div>
            <div className="flex h-6 gap-px items-end">
              {arc.beats.map((beat, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gray-400"
                  style={{ height: `${beat.intensity * 100}%` }}
                  title={`${beat.name}: ${Math.round(beat.intensity * 100)}%`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pacing analysis */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Pacing</span>
          <button
            onClick={runPacingAnalysis}
            disabled={loading}
            className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
          >
            {loading ? "..." : "Analyze"}
          </button>
        </div>
        {pacing ? (
          <div className="space-y-1">
            <div className="flex gap-2">
              <span className="text-gray-500">Score:</span>
              <span className="text-gray-200">{pacing.overallScore}/100</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">Avg Tempo:</span>
              <span className="text-gray-200">{Math.round(pacing.avgTempo)} BPM</span>
            </div>
            {pacing.slowSegments.length > 0 && (
              <div className="text-[10px] text-gray-600">Slow: {pacing.slowSegments.length} segment(s)</div>
            )}
            {pacing.fastSegments.length > 0 && (
              <div className="text-[10px] text-gray-600">Fast: {pacing.fastSegments.length} segment(s)</div>
            )}
            <div className="mt-1 space-y-0.5">
              {pacing.recommendations.map((rec, i) => (
                <div key={i} className="text-[10px] text-gray-400">· {rec}</div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-gray-600">Click Analyze to evaluate pacing.</p>
        )}
      </div>

      {/* Apply plan */}
      {arc && (
        <div className="px-3 py-2 border-b border-edge">
          <button
            onClick={() => projectId && send(projectId, `Apply the ${selectedGenre} story plan to align component timing with story beats`)}
            className="w-full px-2 py-1 text-[10px] bg-white text-black font-medium rounded hover:bg-gray-200"
          >
            Apply Plan to Components
          </button>
        </div>
      )}

      {/* Quick prompts */}
      <div className="px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Quick Prompts</div>
        <div className="space-y-1">
          <button
            onClick={() => projectId && send(projectId, "Create a hero journey story arc")}
            className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
          >
            "Create a hero journey"
          </button>
          <button
            onClick={() => projectId && send(projectId, "Build a thriller story structure")}
            className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
          >
            "Build a thriller structure"
          </button>
          <button
            onClick={() => projectId && send(projectId, "Analyze the pacing of the story")}
            className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
          >
            "Analyze the pacing"
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
