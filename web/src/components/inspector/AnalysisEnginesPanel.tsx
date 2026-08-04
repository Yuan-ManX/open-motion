import { useState, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import type { AnalyzeAllResult } from "../../api/endpoints.js";

// Engine definitions — each maps to an original OpenMotion analysis module.
type EngineId =
  | "physics" | "linguistics" | "cinema"
  | "astronomy" | "chemistry" | "musicology" | "botany" | "geology"
  | "alchemy" | "architecture" | "cartography" | "genealogy"
  | "calligraphy" | "mythology" | "weather";

interface EngineDef {
  id: EngineId;
  label: string;
  icon: string;
  blurb: string;
  group: "science" | "nature" | "humanities";
}

const ENGINES: EngineDef[] = [
  // Science lenses
  { id: "physics", label: "Physics", icon: "⚛", group: "science", blurb: "Kinematics, dynamics, energy, momentum, collisions, equilibrium" },
  { id: "chemistry", label: "Chemistry", icon: "⚗", group: "science", blurb: "Atoms, molecules, bonds, reactions, catalysts, pH, enthalpy" },
  { id: "astronomy", label: "Astronomy", icon: "✦", group: "science", blurb: "Celestial bodies, spectra, constellations, cosmic events" },
  { id: "geology", label: "Geology", icon: "⛏", group: "science", blurb: "Strata, rocks, tectonics, faults, minerals, epochs, landforms" },
  { id: "musicology", label: "Musicology", icon: "♪", group: "science", blurb: "Notes, chords, melody, rhythm, dynamics, form, tonality" },
  // Nature lenses
  { id: "botany", label: "Botany", icon: "☘", group: "nature", blurb: "Organs, branching, canopy, roots, phenology, growth rhythms" },
  { id: "weather", label: "Weather", icon: "☁", group: "nature", blurb: "Pressure, fronts, precipitation, wind, visibility, climate" },
  { id: "cartography", label: "Cartography", icon: "◈", group: "nature", blurb: "Elevation, contours, landmarks, paths, biomes, compass" },
  { id: "genealogy", label: "Genealogy", icon: "⌳", group: "nature", blurb: "Traits, ancestry, phylogeny, evolution, genetic diversity" },
  // Humanities lenses
  { id: "linguistics", label: "Linguistics", icon: "Ƭ", group: "humanities", blurb: "Phonemes, morphemes, syntax, semantics, pragmatics, discourse" },
  { id: "cinema", label: "Cinema", icon: "▣", group: "humanities", blurb: "Shots, cuts, camera, mise-en-scène, narrative, montage, genre" },
  { id: "alchemy", label: "Alchemy", icon: "✷", group: "humanities", blurb: "Prima materia, philosopher's stone, four phases, hermetic principles" },
  { id: "architecture", label: "Architecture", icon: "▤", group: "humanities", blurb: "Structural roles, proportion, hierarchy, spatial organization" },
  { id: "calligraphy", label: "Calligraphy", icon: "✎", group: "humanities", blurb: "Strokes, brush dynamics, rhythm, balance, composition" },
  { id: "mythology", label: "Mythology", icon: "✧", group: "humanities", blurb: "Archetypes, hero journey, symbols, rituals, pantheon" },
];

const GROUP_LABELS: Record<EngineDef["group"], string> = {
  science: "Science",
  nature: "Nature",
  humanities: "Humanities",
};

interface AnalysisResult {
  summary?: string;
  report?: string;
  description?: string;
  [key: string]: unknown;
}

/** Render a structured analysis value as compact readable text. */
function renderValue(val: unknown, depth = 0): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val;
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(2);
  if (typeof val === "boolean") return val ? "yes" : "no";
  if (Array.isArray(val)) {
    if (val.length === 0) return "none";
    if (val.length <= 3) return val.map((v) => renderValue(v, depth + 1)).join(", ");
    return `${val.length} items`;
  }
  if (typeof val === "object") {
    const entries = Object.entries(val as Record<string, unknown>);
    if (entries.length === 0) return "—";
    if (depth >= 2) return "{…}";
    return entries
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${renderValue(v, depth + 1)}`)
      .join("; ");
  }
  return String(val);
}

/** Extract key metrics from a structured analysis result for quick display. */
function extractMetrics(result: AnalysisResult): Array<{ label: string; value: string }> {
  const skip = new Set(["summary", "report", "description", "kind", "projectId", "componentId", "componentName", "id"]);
  const metrics: Array<{ label: string; value: string }> = [];
  for (const [key, val] of Object.entries(result)) {
    if (skip.has(key)) continue;
    if (val === null || val === undefined) continue;
    const rendered = renderValue(val);
    if (rendered && rendered !== "—" && rendered !== "none") {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .trim();
      metrics.push({ label, value: rendered });
    }
  }
  return metrics.slice(0, 12);
}

function getAuthHeaders(): Record<string, string> {
  const key = typeof localStorage !== "undefined" ? localStorage.getItem("openmotion_api_key") : null;
  return key ? { "X-API-Key": key } : {};
}

/**
 * AnalysisEnginesPanel — unified entry point for OpenMotion's original
 * metaphor-based motion analysis engines. Each engine interprets a motion
 * composition through a distinct disciplinary lens, producing a structured
 * report and a human-readable summary.
 *
 * Users can run any engine directly, or ask the Agent to invoke one through
 * natural language (e.g. "analyze the physics of the motion").
 */
export function AnalysisEnginesPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const send = useChatStore((s) => s.send);
  const [active, setActive] = useState<EngineId | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [allResults, setAllResults] = useState<AnalyzeAllResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (id: EngineId) => {
    if (!projectId) return;
    setActive(id);
    setAllResults(null);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch(`/api/projects/${projectId}/${id}`, {
        headers: { ...getAuthHeaders() },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as AnalysisResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run analysis");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  /** Run every cross-disciplinary engine in one batch call. */
  const runAll = useCallback(async () => {
    if (!projectId) return;
    setActive(null);
    setResult(null);
    setAllResults(null);
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/projects/${projectId}/analyze-all`, {
        headers: { ...getAuthHeaders() },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as AnalyzeAllResult;
      setAllResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run all analyses");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const askAgent = useCallback((id: EngineId) => {
    if (!projectId) return;
    const prompt = `analyze the ${id} of the motion`;
    send(projectId, prompt);
  }, [projectId, send]);

  const grouped: Record<EngineDef["group"], EngineDef[]> = {
    science: [],
    nature: [],
    humanities: [],
  };
  for (const e of ENGINES) grouped[e.group].push(e);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text)" }}>
            Analysis Engines
          </div>
          <button
            onClick={runAll}
            disabled={!projectId || components.length === 0 || loading}
            title="Run all 15 cross-disciplinary engines in one batch"
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 3,
              border: "1px solid var(--text)",
              background: "var(--text)",
              color: "var(--bg)",
              cursor: loading ? "wait" : "pointer",
              opacity: (!projectId || components.length === 0) ? 0.4 : 1,
            }}
          >
            {loading && allResults === null && result === null ? "Running…" : "Run All"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary, var(--accent2))", marginTop: 2 }}>
          {ENGINES.length} original disciplinary lenses for motion interpretation
        </div>
      </div>

      {/* Engine grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        {(Object.keys(grouped) as EngineDef["group"][]).map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent2)", marginBottom: 6 }}>
              {GROUP_LABELS[g]}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              {grouped[g].map((e) => {
                const isActive = active === e.id && !loading;
                return (
                  <button
                    key={e.id}
                    onClick={() => run(e.id)}
                    disabled={!projectId || components.length === 0 || loading}
                    title={e.blurb}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                      padding: "8px 10px",
                      borderRadius: 4,
                      border: `1px solid ${isActive ? "var(--text)" : "var(--border)"}`,
                      background: isActive ? "var(--text)" : "var(--panel2, var(--bg))",
                      color: isActive ? "var(--bg)" : "var(--text)",
                      cursor: loading ? "wait" : "pointer",
                      textAlign: "left",
                      transition: "border-color 120ms, background 120ms",
                      opacity: (!projectId || components.length === 0) ? 0.4 : 1,
                    }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1 }}>{e.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{e.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Result area */}
      {(loading || error || result || allResults) && (
        <div style={{ borderTop: "1px solid var(--border)", flex: "0 0 auto", maxHeight: "45%", overflowY: "auto", padding: "10px 12px" }}>
          {loading && (
            <div style={{ fontSize: 11, color: "var(--accent2)" }}>
              {allResults === null && result === null && active === null
                ? "Running all analyses…"
                : `Running ${active} analysis…`}
            </div>
          )}
          {error && (
            <div style={{ fontSize: 11, color: "var(--danger, #e5484d)" }}>Error: {error}</div>
          )}
          {allResults && !loading && !error && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
                  All Engines Report
                </span>
                <span style={{ fontSize: 10, color: "var(--accent2)", fontFamily: "var(--font-mono, monospace)" }}>
                  {allResults.summary.succeeded}/{allResults.summary.total} ok
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {allResults.engines.map((eng) => {
                  const def = ENGINES.find((e) => e.id === eng.name);
                  return (
                    <div key={eng.name} style={{ border: "1px solid var(--border)", borderRadius: 3, padding: "6px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 12 }}>{def?.icon ?? "•"}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text)" }}>
                          {def?.label ?? eng.name}
                        </span>
                        {eng.error && (
                          <span style={{ fontSize: 9, color: "var(--danger, #e5484d)" }}>failed</span>
                        )}
                      </div>
                      {eng.report && !eng.error && (
                        <pre style={{
                          fontSize: 9,
                          lineHeight: 1.4,
                          color: "var(--accent2)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          margin: 0,
                          fontFamily: "var(--font-mono, monospace)",
                          maxHeight: 80,
                          overflowY: "auto",
                        }}>
                          {eng.report}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {result && !loading && !error && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
                  {ENGINES.find((e) => e.id === active)?.label} Report
                </span>
                {active && (
                  <button
                    onClick={() => askAgent(active)}
                    title="Ask the Agent to follow up on this analysis"
                    style={{
                      fontSize: 10,
                      padding: "3px 8px",
                      borderRadius: 3,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--text)",
                      cursor: "pointer",
                    }}
                  >
                    Ask Agent ↗
                  </button>
                )}
              </div>
              {(result.summary || result.description) && (
                <div style={{ fontSize: 11, color: "var(--text)", marginBottom: 8, lineHeight: 1.5 }}>
                  {result.summary || result.description}
                </div>
              )}
              {extractMetrics(result).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
                  {extractMetrics(result).map((m) => (
                    <div key={m.label} style={{ display: "flex", gap: 8, fontSize: 10, lineHeight: 1.4 }}>
                      <span style={{ color: "var(--accent2)", minWidth: 88, flexShrink: 0 }}>{m.label}</span>
                      <span style={{ color: "var(--text)", wordBreak: "break-word" }}>{m.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.report && (
                <pre style={{
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: "var(--accent2)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  {result.report}
                </pre>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty state hint */}
      {!projectId && (
        <div style={{ padding: "0 12px 12px", fontSize: 10, color: "var(--accent2)" }}>
          Open a project to run analysis engines.
        </div>
      )}
      {projectId && components.length === 0 && (
        <div style={{ padding: "0 12px 12px", fontSize: 10, color: "var(--accent2)" }}>
          Add motion components to enable analysis.
        </div>
      )}
    </div>
  );
}
