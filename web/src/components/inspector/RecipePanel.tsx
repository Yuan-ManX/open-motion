import { useMemo, useState, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";

interface ProjectRecipeSummary {
  id: string;
  name: string;
  description: string;
  intentKeywords: string[];
  durationMs: number;
  easingType: string;
  trigger: string;
}

const RECIPES_KEY = "__projectRecipes";

function readRecipesFromTokens(tokens: Record<string, string | number> | undefined): ProjectRecipeSummary[] {
  if (!tokens) return [];
  const raw = tokens[RECIPES_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ProjectRecipeSummary[];
  } catch {
    return [];
  }
}

function sendAgentMessage(projectId: string, prompt: string) {
  useChatStore.getState().send(projectId, prompt);
}

type RecipeTab = "project" | "library";

export function RecipePanel() {
  const project = useProjectStore((s) => s.project);
  const projectId = useProjectStore((s) => s.projectId);
  const loadProject = useProjectStore((s) => s.loadProject);
  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<RecipeTab>("library");

  // Project recipes: per-project reusable motion captures stored on tokens.
  const recipes = useMemo(() => readRecipesFromTokens(project?.tokens), [project?.tokens]);

  // Built-in motion recipe library — fetched once on mount so the user can
  // browse and apply curated motion patterns directly without routing
  // through the agent. Applied via the `/projects/:id/recipes/:id/apply`
  // endpoint that resolves and runs the recipe's tool call sequence.
  const [libRecipes, setLibRecipes] = useState<api.MotionRecipe[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libQuery, setLibQuery] = useState("");
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  useEffect(() => {
    setLibLoading(true);
    api.listRecipes()
      .then(setLibRecipes)
      .catch(() => setLibRecipes([]))
      .finally(() => setLibLoading(false));
  }, []);

  // Debounced built-in library search — forwards the query to the backend's
  // category+search endpoint. Local fallback filtering handles the case when
  // the backend list is already loaded and the query is narrow.
  useEffect(() => {
    const q = libQuery.trim();
    if (!q) return;
    const handle = window.setTimeout(() => {
      api.listRecipes(undefined, q)
        .then((r) => r.length > 0 && setLibRecipes(r))
        .catch(() => {});
    }, 220);
    return () => window.clearTimeout(handle);
  }, [libQuery]);

  const libCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of libRecipes) {
      map.set(r.category, (map.get(r.category) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [libRecipes]);

  const [libCategory, setLibCategory] = useState<string>("all");

  // Built-in list — server search first, local category filter otherwise
  const libFiltered = useMemo(() => {
    const q = libQuery.trim().toLowerCase();
    const base = libCategory === "all" ? libRecipes : libRecipes.filter((r) => r.category === libCategory);
    if (!q) return base;
    return base.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.category.toLowerCase().includes(q),
    );
  }, [libRecipes, libCategory, libQuery]);

  const filtered = useMemo(() => {
    if (!query.trim()) return recipes;
    const lower = query.toLowerCase();
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.description.toLowerCase().includes(lower) ||
        r.intentKeywords.some((k) => k.toLowerCase().includes(lower)),
    );
  }, [recipes, query]);

  // Apply a built-in library recipe directly via the API (no LLM round trip).
  const applyBuiltIn = async (recipeId: string) => {
    if (!projectId || applyingId) return;
    setApplyingId(recipeId);
    try {
      const res = await api.applyRecipe(projectId, recipeId, selectedComponentId ?? undefined);
      if (res.applied) {
        await loadProject(projectId);
        setAppliedId(recipeId);
        setTimeout(() => setAppliedId((cur) => (cur === recipeId ? null : cur)), 1600);
      }
    } finally {
      setApplyingId(null);
    }
  };

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher — project (saved captures) vs library (built-in motion patterns) */}
      <div className="flex items-center gap-0.5 px-2 pt-1.5 pb-1 border-b border-edge flex-shrink-0">
        {(["library", "project"] as RecipeTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-[10px] px-2 py-1 rounded transition-colors ${
              tab === t ? "bg-panel3 text-gray-100" : "text-gray-500 hover:text-gray-300"
            }`}
            aria-pressed={tab === t}
          >
            {t === "library" ? "Recipe Library" : "Project Recipes"}
          </button>
        ))}
        {tab === "library" && (
          <span className="ml-auto text-[9px] text-gray-600 font-mono">{libRecipes.length} total</span>
        )}
        {tab === "project" && (
          <span className="ml-auto text-[9px] text-gray-600 font-mono">{recipes.length} saved</span>
        )}
      </div>

      {tab === "library" ? (
        <>
          {/* Library search */}
          <div className="px-2 pt-2 pb-1.5 flex-shrink-0 space-y-1">
            <div className="relative">
              <input
                type="text"
                value={libQuery}
                onChange={(e) => setLibQuery(e.target.value)}
                placeholder="Search recipe library — entrance, hover, exit, load…"
                className="w-full text-[11px] bg-ink border border-edge rounded-md pl-7 pr-7 py-1.5 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-accent transition-colors"
              />
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              {libQuery && (
                <button
                  onClick={() => setLibQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 text-xs w-4 h-4 flex items-center justify-center"
                  aria-label="Clear recipe search"
                >
                  ✕
                </button>
              )}
              {libLoading && (
                <div className="absolute right-7 top-1/2 -translate-y-1/2 w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            {/* Category chips — hidden when a search query is active */}
            {!libQuery && (
              <div className="flex gap-1 pt-1 flex-wrap">
                <button
                  onClick={() => setLibCategory("all")}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${
                    libCategory === "all" ? "border-accent text-accent" : "border-edge text-gray-500 hover:text-gray-300"
                  }`}
                >
                  All ({libRecipes.length})
                </button>
                {libCategories.map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => setLibCategory(cat)}
                    className={`text-[9px] px-1.5 py-0.5 rounded-full border capitalize transition-colors ${
                      libCategory === cat ? "border-accent text-accent" : "border-edge text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {cat} ({count})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recipe library list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
            {libFiltered.length === 0 ? (
              <div className="text-center text-[11px] text-gray-600 py-8">
                {libLoading ? "Loading recipe library…" : "No recipes match your search."}
              </div>
            ) : (
              libFiltered.map((r) => (
                <div
                  key={r.id}
                  className="group w-full rounded border border-edge bg-panel2 hover:border-accent transition-colors px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] px-1 py-0.5 rounded bg-edge text-gray-400 uppercase tracking-wide flex-shrink-0">
                      {r.category}
                    </span>
                    <span className="text-[11px] font-medium text-gray-200 group-hover:text-accent truncate flex-1">{r.name}</span>
                    <span className="text-[8px] text-gray-600 font-mono">
                      restraint {r.restraintCost}
                    </span>
                  </div>
                  <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {r.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[8px] px-1 py-0.5 rounded bg-bg text-gray-500 border border-edge font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      onClick={() => void applyBuiltIn(r.id)}
                      disabled={!!applyingId}
                      className={`flex-1 text-[9px] px-2 py-0.5 rounded border transition-colors ${
                        appliedId === r.id
                          ? "bg-accent/20 border-accent text-accent"
                          : "border-edge text-gray-400 hover:text-gray-100 hover:border-gray-400 disabled:opacity-40"
                      }`}
                      title={selectedComponentId ? "Apply recipe to the selected component" : "Apply recipe to the first component"}
                    >
                      {applyingId === r.id ? "Applying…" : appliedId === r.id ? "✓ Applied" : `Apply to ${selectedComponentId ? "selected" : "first"}`}
                    </button>
                    <button
                      onClick={() =>
                        sendAgentMessage(
                          projectId,
                          `Describe what the "${r.name}" recipe does and suggest which components it suits best.`,
                        )
                      }
                      className="text-[9px] px-2 py-0.5 rounded border border-edge text-gray-600 hover:text-gray-300 hover:border-gray-400 transition-colors"
                      title="Ask the agent about this recipe"
                    >
                      Ask
                    </button>
                  </div>
                  {r.avoidWhen.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.avoidWhen.slice(0, 3).map((a) => (
                        <span key={a} className="text-[8px] text-red-400/70" title={`Avoid when: ${a}`}>
                          ✕ {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Project recipes */}
          <div className="px-3 py-2 border-b border-edge flex-shrink-0">
            <div className="flex gap-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search saved recipes..."
                className="flex-1 bg-bg px-2 py-1 text-[10px] text-gray-300 border border-edge focus:border-gray-500 focus:outline-none"
              />
              <button
                onClick={() => sendAgentMessage(projectId, "Seed project recipes")}
                title="Load built-in recipe presets"
                aria-label="Seed recipe presets"
                className="px-2 py-1 text-[10px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
              >
                Seed
              </button>
            </div>
          </div>

          {/* Save current as recipe */}
          {selectedComponentId && (
            <div className="px-3 py-2 border-b border-edge flex-shrink-0">
              <button
                onClick={() =>
                  sendAgentMessage(
                    projectId,
                    `Save the selected component's motion as a recipe called "Captured Motion"`,
                  )
                }
                className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors"
                title="Capture the selected component's current motion as a reusable recipe"
              >
                + Save Selected as Recipe
              </button>
            </div>
          )}

          {/* Saved project recipe list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-[10px] text-gray-600">
                {recipes.length === 0
                  ? "No saved project recipes. Click Seed to load presets, or save a component's motion as a recipe."
                  : "No recipes match your search."}
              </div>
            ) : (
              <div className="divide-y divide-edge">
                {filtered.map((recipe) => (
                  <div key={recipe.id} className="px-3 py-2 hover:bg-panel2 transition-colors group">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[11px] font-medium text-gray-200 truncate flex-1">
                        {recipe.name}
                      </span>
                      <button
                        onClick={() =>
                          sendAgentMessage(
                            projectId,
                            `Delete the project recipe "${recipe.name}"`,
                          )
                        }
                        title="Delete recipe"
                        aria-label={`Delete recipe ${recipe.name}`}
                        className="text-[10px] text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                    {recipe.description && (
                      <p className="text-[9px] text-gray-500 mb-1.5 line-clamp-2">
                        {recipe.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {recipe.intentKeywords.slice(0, 4).map((kw) => (
                        <span
                          key={kw}
                          className="text-[8px] px-1 py-0.5 bg-bg text-gray-500 border border-edge font-mono"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-gray-600 font-mono mb-2">
                      <span>{recipe.durationMs}ms</span>
                      <span>·</span>
                      <span>{recipe.easingType}</span>
                      <span>·</span>
                      <span>{recipe.trigger}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (selectedComponentId) {
                          sendAgentMessage(
                            projectId,
                            `Apply the project recipe "${recipe.name}" to the selected component`,
                          );
                        } else {
                          sendAgentMessage(
                            projectId,
                            `Apply the project recipe "${recipe.name}" to the first component`,
                          );
                        }
                      }}
                      disabled={!project}
                      className="w-full px-2 py-1 text-[9px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Apply this recipe to the selected component"
                    >
                      Apply to {selectedComponentId ? "Selected" : "First"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
