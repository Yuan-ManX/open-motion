import { useMemo } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";

interface BrandPackSummary {
  id: string;
  name: string;
  description: string;
  energy: number;
  formality: number;
  playfulness: number;
  precision: number;
  defaultTrigger: string;
  loopPhilosophy: string;
}

const PACKS_KEY = "__brandPacks";

function readPacksFromTokens(tokens: Record<string, string | number> | undefined): BrandPackSummary[] {
  if (!tokens) return [];
  const raw = tokens[PACKS_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as BrandPackSummary[];
  } catch {
    return [];
  }
}

function sendAgentMessage(projectId: string, prompt: string) {
  useChatStore.getState().send(projectId, prompt);
}

function PersonalityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] text-gray-600 w-12 font-mono uppercase">{label}</span>
      <div className="flex-1 h-1 bg-bg border border-edge">
        <div className="h-full bg-gray-400" style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-[8px] text-gray-600 font-mono w-4 text-right">{value}</span>
    </div>
  );
}

export function BrandPackPanel() {
  const project = useProjectStore((s) => s.project);
  const projectId = useProjectStore((s) => s.projectId);

  const packs = useMemo(() => readPacksFromTokens(project?.tokens), [project?.tokens]);

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
            Brand Packs
          </span>
          <span className="text-[9px] text-gray-600 font-mono">{packs.length}</span>
        </div>
        <button
          onClick={() => sendAgentMessage(projectId, "Seed brand packs")}
          title="Load built-in brand pack presets"
          aria-label="Seed brand pack presets"
          className="w-full px-2 py-1 text-[10px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
        >
          + Seed Presets
        </button>
      </div>

      {/* Pack list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {packs.length === 0 ? (
          <div className="px-4 py-6 text-center text-[10px] text-gray-600">
            No brand packs yet. Click Seed Presets to load 5 built-in motion identities:
            Minimal Reserve, Material Expressive, Playful Dynamic, Cinematic Flow, Technical
            Precision.
          </div>
        ) : (
          <div className="divide-y divide-edge">
            {packs.map((pack) => (
              <div key={pack.id} className="px-3 py-2.5 hover:bg-panel2 transition-colors group">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-[11px] font-medium text-gray-200">{pack.name}</span>
                  <button
                    onClick={() =>
                      sendAgentMessage(projectId, `Delete the brand pack "${pack.name}"`)
                    }
                    title="Delete brand pack"
                    aria-label={`Delete brand pack ${pack.name}`}
                    className="text-[10px] text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
                {pack.description && (
                  <p className="text-[9px] text-gray-500 mb-2 line-clamp-2">{pack.description}</p>
                )}
                {/* Personality bars */}
                <div className="space-y-1 mb-2">
                  <PersonalityBar label="Energy" value={pack.energy} />
                  <PersonalityBar label="Formal" value={pack.formality} />
                  <PersonalityBar label="Play" value={pack.playfulness} />
                  <PersonalityBar label="Precis" value={pack.precision} />
                </div>
                {/* Meta */}
                <div className="flex items-center gap-2 text-[9px] text-gray-600 font-mono mb-2">
                  <span title="Default trigger">{pack.defaultTrigger}</span>
                  <span>·</span>
                  <span title="Loop philosophy">{pack.loopPhilosophy}</span>
                </div>
                <button
                  onClick={() =>
                    sendAgentMessage(
                      projectId,
                      `Apply the "${pack.name}" brand pack to all components`,
                    )
                  }
                  className="w-full px-2 py-1 text-[9px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors"
                  title="Apply this brand pack to all components"
                >
                  Apply to All
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
