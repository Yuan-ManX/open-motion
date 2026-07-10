import { useUiStore } from "../../store/uiStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { LayersPanel } from "../inspector/LayersPanel.js";
import { ComponentInspector } from "../inspector/ComponentInspector.js";
import { TemplatesPanel } from "../inspector/TemplatesPanel.js";
import { SkillsPanel } from "../inspector/SkillsPanel.js";
import { StateMachinePanel } from "../inspector/StateMachinePanel.js";
import { MemoryPanel } from "../inspector/MemoryPanel.js";

type TabId = "layers" | "inspector" | "templates" | "skills" | "states" | "memory";

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: "layers", label: "Layers", icon: "≡" },
  { id: "inspector", label: "Inspect", icon: "◐" },
  { id: "templates", label: "Templates", icon: "▦" },
  { id: "skills", label: "Skills", icon: "✦" },
  { id: "states", label: "States", icon: "⚙" },
  { id: "memory", label: "Memory", icon: "◆" },
];

/**
 * Tabbed right sidebar with six tabs: Layers, Inspector, Templates, Skills, States, Memory.
 * Templates and Skills are always available (for creating new projects);
 * Layers, Inspector, States, and Memory require an open project.
 */
export function RightPanel() {
  const tab = useUiStore((s) => s.rightPanelTab);
  const setTab = useUiStore((s) => s.setRightPanelTab);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const componentCount = useProjectStore((s) => s.components.length);
  const projectId = useProjectStore((s) => s.projectId);

  return (
    <div className="w-72 border-l border-edge flex flex-col flex-shrink-0 bg-panel">
      {/* Tab header */}
      <div className="flex border-b border-edge flex-shrink-0">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          const showBadge = t.id === "layers" && componentCount > 0;
          const showDot = t.id === "inspector" && !!selectedId;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-0.5 py-2 text-[9px] font-medium transition-colors relative flex flex-col items-center gap-0.5 ${
                isActive
                  ? "text-gray-100 bg-panel2"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              aria-pressed={isActive}
              title={t.label}
            >
              <span className="text-xs">{t.icon}</span>
              <span>{t.label}</span>
              {showBadge && (
                <span className="absolute top-1 right-1 text-[8px] text-gray-600 font-mono">{componentCount}</span>
              )}
              {showDot && (
                <span className="absolute top-1.5 right-1.5 inline-block w-1.5 h-1.5 rounded-full bg-accent" />
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "templates" ? (
          <TemplatesPanel />
        ) : tab === "skills" ? (
          <SkillsPanel />
        ) : !projectId ? (
          <div className="px-4 py-6 text-center text-xs text-gray-600">
            {tab === "layers" ? "No project loaded." : tab === "states" ? "No project loaded." : tab === "memory" ? "No project loaded." : "Open a project to inspect layers."}
          </div>
        ) : tab === "layers" ? (
          <LayersPanel />
        ) : tab === "states" ? (
          <StateMachinePanel />
        ) : tab === "memory" ? (
          <MemoryPanel projectId={projectId} />
        ) : (
          <ComponentInspector />
        )}
      </div>
    </div>
  );
}
