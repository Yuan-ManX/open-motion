import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import { useUiStore } from "../../store/uiStore.js";

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

export function RecipePanel() {
  const project = useProjectStore((s) => s.project);
  const projectId = useProjectStore((s) => s.projectId);
  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const [query, setQuery] = useState("");

  const recipes = useMemo(() => readRecipesFromTokens(project?.tokens), [project?.tokens]);

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

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Project Recipes
          </span>
          <span className="text-[9px] text-gray-600 font-mono">{recipes.length}</span>
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes..."
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

      {/* Recipe list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-[10px] text-gray-600">
            {recipes.length === 0
              ? "No project recipes yet. Click Seed to load presets, or save a component's motion as a recipe."
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
                  Apply to Selected
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
