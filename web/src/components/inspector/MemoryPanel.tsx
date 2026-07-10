import { useCallback, useEffect, useState } from "react";
import {
  listMemory,
  saveMemory,
  searchMemory,
  deleteMemory,
  updateMemoryRelevance,
  listRecipes,
  listGeneratedSkills,
  getProjectRestraint,
  type AgentMemoryEntry,
  type MotionRecipe,
  type GeneratedSkill,
  type RestraintReport,
} from "../../api/endpoints.js";

type Section = "restraint" | "memory" | "recipes" | "skills";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "restraint", label: "Restraint", icon: "◉" },
  { id: "memory", label: "Memory", icon: "◆" },
  { id: "recipes", label: "Recipes", icon: "▦" },
  { id: "skills", label: "Learned", icon: "✦" },
];

function scoreColor(score: number): string {
  if (score >= 80) return "text-gray-100";
  if (score >= 60) return "text-gray-300";
  if (score >= 40) return "text-gray-400";
  return "text-red-400";
}

function scoreBar(score: number): string {
  if (score >= 80) return "bg-gray-100";
  if (score >= 60) return "bg-gray-300";
  if (score >= 40) return "bg-gray-500";
  return "bg-red-500";
}

function warningIcon(level: "info" | "warn" | "critical"): string {
  if (level === "critical") return "▲";
  if (level === "warn") return "△";
  return "i";
}

/** Restraint indicator section — shows motion density score and warnings. */
function RestraintSection({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<RestraintReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getProjectRestraint(projectId);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load restraint analysis");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <div className="p-3 text-[11px] text-gray-500">Analyzing motion density…</div>;
  if (error) return (
    <div className="p-3 text-[11px] text-red-400">
      {error}
      <button onClick={() => void refresh()} className="ml-2 underline text-gray-400">retry</button>
    </div>
  );
  if (!report) return <div className="p-3 text-[11px] text-gray-600">No analysis available.</div>;

  const { analysis } = report;

  return (
    <div className="p-2.5 space-y-2">
      {/* Score badge */}
      <div className="flex items-center gap-3">
        <div className={`text-3xl font-mono font-bold ${scoreColor(analysis.score)}`}>
          {analysis.score}
        </div>
        <div className="flex-1">
          <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Restraint Score</div>
          <div className="h-1.5 bg-edge rounded-full overflow-hidden">
            <div
              className={`h-full ${scoreBar(analysis.score)} transition-all`}
              style={{ width: `${analysis.score}%` }}
            />
          </div>
          <div className="text-[9px] text-gray-600 mt-0.5">/ 100</div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="bg-panel2 rounded px-2 py-1">
          <span className="text-gray-500">Components</span>
          <span className="text-gray-200 ml-1.5 font-mono">{analysis.componentCount}</span>
        </div>
        <div className="bg-panel2 rounded px-2 py-1">
          <span className="text-gray-500">Peak overlap</span>
          <span className="text-gray-200 ml-1.5 font-mono">{analysis.peakSimultaneous}</span>
        </div>
      </div>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] uppercase tracking-wide text-gray-500">Warnings</div>
          {analysis.warnings.map((w, i) => (
            <div key={i} className="flex gap-1.5 text-[10px] leading-snug">
              <span className={w.level === "critical" ? "text-red-400" : w.level === "warn" ? "text-gray-300" : "text-gray-500"}>
                {warningIcon(w.level)}
              </span>
              <span className="text-gray-400">{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] uppercase tracking-wide text-gray-500">Recommendations</div>
          {analysis.recommendations.map((r, i) => (
            <div key={i} className="text-[10px] text-gray-400 leading-snug pl-3 border-l border-edge">
              {r}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => void refresh()}
        className="w-full text-[10px] text-gray-500 hover:text-gray-300 py-1 border border-edge rounded"
      >
        ↻ Reanalyze
      </button>
    </div>
  );
}

/** Memory section — persistent project memory entries with save/search. */
function MemorySection({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<AgentMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newTags, setNewTags] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = query.trim()
        ? await searchMemory(projectId, query.trim())
        : await listMemory(projectId);
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    setBusy(true);
    try {
      const tags = newTags.split(",").map((t) => t.trim()).filter(Boolean);
      await saveMemory(projectId, { key: newKey.trim(), value: newValue.trim(), tags });
      setNewKey("");
      setNewValue("");
      setNewTags("");
      setShowForm(false);
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMemory(id);
    void refresh();
  };

  const handleRelevance = async (id: string, relevance: number) => {
    await updateMemoryRelevance(id, relevance);
    void refresh();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search bar */}
      <div className="p-2 flex gap-1 flex-shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memory…"
          className="flex-1 bg-panel border border-edge rounded px-2 py-1 text-[11px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
        />
        <button
          onClick={() => setShowForm(!showForm)}
          title="Add memory"
          aria-label="Add memory"
          aria-expanded={showForm}
          className={`px-2 py-1 rounded border border-edge text-[11px] ${showForm ? "bg-panel2 text-gray-200" : "text-gray-400 hover:text-gray-200"}`}
        >
          +
        </button>
      </div>

      {/* Save form */}
      {showForm && (
        <div className="px-2 pb-2 space-y-1.5 flex-shrink-0 border-b border-edge/50">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Key (e.g., brand-tone)"
            className="w-full bg-panel border border-edge rounded px-2 py-1 text-[10px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
          />
          <textarea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value — what should the agent remember?"
            rows={2}
            className="w-full bg-panel border border-edge rounded px-2 py-1 text-[10px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-500 resize-none"
          />
          <input
            type="text"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="tags (comma-separated)"
            className="w-full bg-panel border border-edge rounded px-2 py-1 text-[10px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
          />
          <button
            onClick={handleSave}
            disabled={busy || !newKey.trim() || !newValue.trim()}
            className="w-full px-2 py-1 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-black text-[10px] font-medium"
          >
            {busy ? "Saving…" : "Save Memory"}
          </button>
        </div>
      )}

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-3 text-[11px] text-gray-500">Loading…</div>}
        {!loading && entries.length === 0 && (
          <div className="p-3 text-[11px] text-gray-600">
            {query.trim() ? "No matches found." : "No memory entries yet. Save context for the agent to recall across sessions."}
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="px-2.5 py-2 border-b border-edge/50 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-gray-200 truncate">{e.key}</span>
              <span className="text-[8px] uppercase text-gray-600 ml-1.5">{e.layer}</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{e.value}</div>
            {e.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {e.tags.map((t) => (
                  <span key={t} className="text-[8px] px-1 py-0.5 rounded bg-edge text-gray-500">{t}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={e.relevance}
                onChange={(ev) => void handleRelevance(e.id, Number(ev.target.value))}
                className="flex-1 h-1 accent-gray-300"
                title={`Relevance: ${e.relevance.toFixed(1)}`}
                aria-label="Relevance"
              />
              <button
                onClick={() => void handleDelete(e.id)}
                className="text-[9px] text-red-400 hover:text-red-300"
                title="Delete"
                aria-label="Delete memory"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Recipe browser section — curated motion recipes with avoidance metadata. */
function RecipesSection() {
  const [recipes, setRecipes] = useState<MotionRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listRecipes(category || undefined, query.trim() || undefined);
      setRecipes(list);
    } catch {
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [category, query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categories = Array.from(new Set(recipes.map((r) => r.category)));

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="p-2 space-y-1.5 flex-shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes…"
          className="w-full bg-panel border border-edge rounded px-2 py-1 text-[11px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
        />
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setCategory("")}
              className={`text-[9px] px-1.5 py-0.5 rounded border ${!category ? "bg-panel2 text-gray-200 border-gray-500" : "border-edge text-gray-500 hover:text-gray-300"}`}
            >
              all
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-[9px] px-1.5 py-0.5 rounded border ${category === c ? "bg-panel2 text-gray-200 border-gray-500" : "border-edge text-gray-500 hover:text-gray-300"}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recipe list */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-3 text-[11px] text-gray-500">Loading recipes…</div>}
        {!loading && recipes.length === 0 && (
          <div className="p-3 text-[11px] text-gray-600">No recipes found.</div>
        )}
        {recipes.map((r) => (
          <div key={r.id} className="border-b border-edge/50">
            <button
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              className="w-full text-left px-2.5 py-2 hover:bg-panel2"
              aria-expanded={expandedId === r.id}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-200">{r.name}</span>
                <span className="text-[9px] text-gray-600 font-mono">cost {r.restraintCost}</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{r.description}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[8px] px-1 py-0.5 rounded bg-edge text-gray-500">{r.category}</span>
                {r.tags.slice(0, 2).map((t) => (
                  <span key={t} className="text-[8px] text-gray-600">#{t}</span>
                ))}
              </div>
            </button>

            {expandedId === r.id && (
              <div className="px-2.5 pb-2.5 space-y-2 bg-panel2/30">
                {r.avoidWhen.length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Avoid when</div>
                    <div className="flex flex-wrap gap-1">
                      {r.avoidWhen.map((a) => (
                        <span key={a} className="text-[9px] px-1 py-0.5 rounded border border-red-900/50 text-red-400/80">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Recipe spec</div>
                  <pre className="bg-ink border border-edge rounded p-1.5 text-[9px] text-gray-400 overflow-x-auto font-mono max-h-24">
                    {JSON.stringify(r.recipe, null, 2)}
                  </pre>
                </div>
                <div className="text-[9px] text-gray-600 italic">
                  Ask the agent: "apply recipe {r.id}" to use this pattern.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generated skills section — auto-learned skill patterns from agent actions. */
function GeneratedSkillsSection({ projectId }: { projectId: string }) {
  const [skills, setSkills] = useState<GeneratedSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listGeneratedSkills(projectId, 30);
      setSkills(list);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <div className="p-3 text-[11px] text-gray-500">Loading learned skills…</div>;

  if (skills.length === 0) {
    return (
      <div className="p-3 text-[11px] text-gray-600 leading-relaxed">
        No auto-generated skills yet. The agent synthesizes skill patterns after performing repeated spec-changing operations in this project.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {skills.map((s) => (
        <div key={s.id} className="border-b border-edge/50">
          <button
            onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
            className="w-full text-left px-2.5 py-2 hover:bg-panel2"
            aria-expanded={expandedId === s.id}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-gray-200">{s.name}</span>
              <span className="text-[9px] text-gray-600 font-mono">×{s.usageCount}</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{s.description}</div>
            <div className="text-[9px] text-gray-600 mt-0.5 font-mono">{s.triggerPattern}</div>
          </button>
          {expandedId === s.id && (
            <div className="px-2.5 pb-2.5 space-y-1.5 bg-panel2/30">
              <div>
                <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Tool sequence</div>
                <code className="block bg-ink border border-edge rounded p-1.5 text-[9px] text-gray-400 font-mono">
                  {s.toolSequence}
                </code>
              </div>
              {s.skillMarkdown && (
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Skill document</div>
                  <pre className="bg-ink border border-edge rounded p-1.5 text-[9px] text-gray-400 overflow-x-auto whitespace-pre-wrap font-mono max-h-32">
                    {s.skillMarkdown}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Memory panel — aggregates agent intelligence surfaces:
 * restraint score, persistent memory, motion recipes, and auto-generated skills.
 */
export function MemoryPanel({ projectId }: { projectId: string }) {
  const [section, setSection] = useState<Section>("restraint");

  return (
    <div className="h-full flex flex-col">
      {/* Section sub-tabs */}
      <div className="flex border-b border-edge flex-shrink-0">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex-1 py-1.5 text-[9px] font-medium transition-colors flex flex-col items-center gap-0.5 ${
              section === s.id ? "text-gray-100 bg-panel2" : "text-gray-500 hover:text-gray-300"
            }`}
            aria-pressed={section === s.id}
            title={s.label}
          >
            <span className="text-[11px]">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {section === "restraint" ? (
          <div className="h-full overflow-y-auto">
            <RestraintSection projectId={projectId} />
          </div>
        ) : section === "memory" ? (
          <MemorySection projectId={projectId} />
        ) : section === "recipes" ? (
          <RecipesSection />
        ) : (
          <GeneratedSkillsSection projectId={projectId} />
        )}
      </div>
    </div>
  );
}
