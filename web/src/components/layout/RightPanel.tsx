import { useUiStore } from "../../store/uiStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { LayersPanel } from "../inspector/LayersPanel.js";
import { ComponentInspector } from "../inspector/ComponentInspector.js";
import { EffectsPanel } from "../inspector/EffectsPanel.js";
import { TemplatesPanel } from "../inspector/TemplatesPanel.js";
import { SkillsPanel } from "../inspector/SkillsPanel.js";
import { StateMachinePanel } from "../inspector/StateMachinePanel.js";
import { MemoryPanel } from "../inspector/MemoryPanel.js";
import { VersionHistoryPanel } from "../inspector/VersionHistoryPanel.js";
import { NodeGraphPanel } from "../inspector/NodeGraphPanel.js";
import { CodeMirrorPanel } from "../inspector/CodeMirrorPanel.js";
import { ShaderStudioPanel } from "../inspector/ShaderStudioPanel.js";
import { RecipePanel } from "../inspector/RecipePanel.js";
import { BrandPackPanel } from "../inspector/BrandPackPanel.js";
import { MotionCapturePanel } from "../inspector/MotionCapturePanel.js";
import { ExportPresetsPanel } from "../inspector/ExportPresetsPanel.js";
import { SessionLineagePanel } from "../inspector/SessionLineagePanel.js";
import { StoryboardPanel } from "../inspector/StoryboardPanel.js";
import { HealthDashboard } from "../inspector/HealthDashboard.js";
import { VariantComparison } from "../inspector/VariantComparison.js";
import { TimelineSequencer } from "../inspector/TimelineSequencer.js";
import { MotionSandbox } from "../inspector/MotionSandbox.js";
import { MotionIntelligencePanel } from "../inspector/MotionIntelligencePanel.js";
import { StorytellingPanel } from "../inspector/StorytellingPanel.js";
import { AdaptivePanel } from "../inspector/AdaptivePanel.js";
import { AccessibilityPanel } from "../inspector/AccessibilityPanel.js";
import { PerformancePanel } from "../inspector/PerformancePanel.js";

type TabId =
  | "layers" | "inspector" | "effects" | "graph" | "code" | "shader" | "recipe" | "brand"
  | "capture" | "export" | "lineage" | "a11y" | "perf"
  | "storyboard" | "health" | "variants" | "sequencer" | "sandbox"
  | "intelligence" | "storytelling" | "adaptive" | "templates" | "skills"
  | "states" | "memory" | "versions";

type CategoryId = "design" | "motion" | "intel" | "assets" | "output";

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

interface CategoryDef {
  id: CategoryId;
  label: string;
  icon: string;
  tabs: TabDef[];
}

// Inspector panels organised into five functional groups. Low-value panels
// are pruned so each group stays focused and legible.
const CATEGORIES: CategoryDef[] = [
  {
    id: "design",
    label: "Design",
    icon: "▣",
    tabs: [
      { id: "layers", label: "Layers", icon: "≡" },
      { id: "inspector", label: "Inspect", icon: "◐" },
      { id: "effects", label: "Effects", icon: "◈" },
      { id: "graph", label: "Graph", icon: "⬡" },
      { id: "code", label: "Code", icon: "</>" },
      { id: "shader", label: "Shader", icon: "◉" },
      { id: "brand", label: "Brand", icon: "▣" },
    ],
  },
  {
    id: "motion",
    label: "Motion",
    icon: "◈",
    tabs: [
      { id: "recipe", label: "Recipes", icon: "◈" },
      { id: "capture", label: "Capture", icon: "✎" },
      { id: "sequencer", label: "Sequence", icon: "▤" },
      { id: "sandbox", label: "Sandbox", icon: "◇" },
      { id: "states", label: "States", icon: "⚙" },
    ],
  },
  {
    id: "intel",
    label: "Intel",
    icon: "◊",
    tabs: [
      { id: "intelligence", label: "Intel", icon: "◊" },
      { id: "storytelling", label: "Arc", icon: "★" },
      { id: "adaptive", label: "Adapt", icon: "⬡" },
      { id: "storyboard", label: "Story", icon: "▤" },
      { id: "health", label: "Health", icon: "♥" },
    ],
  },
  {
    id: "assets",
    label: "Assets",
    icon: "▦",
    tabs: [
      { id: "templates", label: "Templates", icon: "▦" },
      { id: "skills", label: "Skills", icon: "✦" },
      { id: "memory", label: "Memory", icon: "◆" },
      { id: "variants", label: "Variants", icon: "⇄" },
    ],
  },
  {
    id: "output",
    label: "Output",
    icon: "↗",
    tabs: [
      { id: "export", label: "Export", icon: "↗" },
      { id: "lineage", label: "Lineage", icon: "⬥" },
      { id: "versions", label: "History", icon: "⌛" },
      { id: "a11y", label: "A11y", icon: "♿" },
      { id: "perf", label: "Perf", icon: "⚡" },
    ],
  },
];

/** Resolve which category owns a given tab id. */
function categoryOfTab(tabId: TabId): CategoryId {
  for (const c of CATEGORIES) {
    if (c.tabs.some((t) => t.id === tabId)) return c.id;
  }
  return "design";
}

/**
 * Grouped right sidebar. Panels are organised into five functional
 * categories displayed as a vertical icon rail on the left edge, with
 * sub-tabs in a horizontal strip. Collapsible via the toggle at the top.
 * Templates and Skills are always available; Layers, Inspector, States,
 * and Memory require an open project.
 */
export function RightPanel() {
  const tab = useUiStore((s) => s.rightPanelTab);
  const setTab = useUiStore((s) => s.setRightPanelTab);
  const setCategory = useUiStore((s) => s.setRightPanelCategory);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const componentCount = useProjectStore((s) => s.components.length);
  const projectId = useProjectStore((s) => s.projectId);
  const collapsed = useUiStore((s) => s.rightPanelCollapsed);
  const setCollapsed = useUiStore((s) => s.setRightPanelCollapsed);

  const activeCategory = categoryOfTab(tab as TabId);
  const currentCategory = CATEGORIES.find((c) => c.id === activeCategory) ?? CATEGORIES[0];

  // Collapsed state: thin vertical icon rail — click any icon to expand and jump to that category
  if (collapsed) {
    return (
      <div className="w-8 border-l border-edge flex flex-col items-center py-2 flex-shrink-0 bg-panel">
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-500 hover:text-gray-200 transition-colors text-sm mb-2"
          title="Show panel"
          aria-label="Show right panel"
          aria-expanded={false}
        >
          ◀
        </button>
        <div className="flex flex-col items-center gap-1">
          {CATEGORIES.map((c) => {
            const isActive = activeCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setCategory(c.id);
                  setTab(c.tabs[0].id);
                  setCollapsed(false);
                }}
                className={`w-7 h-7 flex items-center justify-center text-sm rounded transition-colors ${
                  isActive
                    ? "text-gray-100 bg-panel3"
                    : "text-gray-700 hover:text-gray-300 hover:bg-panel2"
                }`}
                title={c.label}
                aria-label={`Open ${c.label}`}
              >
                {c.icon}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-edge flex flex-col flex-shrink-0 bg-panel">
      {/* Sub-tab row — panels within the active category, with collapse toggle */}
      <div className="flex items-stretch border-b border-edge flex-shrink-0 bg-panel2/50">
        <div className="flex flex-1 min-w-0 overflow-x-auto scrollbar-thin">
          {currentCategory.tabs.map((t) => {
            const isActive = tab === t.id;
            const showBadge = t.id === "layers" && componentCount > 0;
            const showDot = t.id === "inspector" && !!selectedId;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-xs font-medium transition-colors relative flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? "text-gray-100"
                    : "text-gray-500 hover:text-gray-300"
                }`}
                aria-pressed={isActive}
                title={t.label}
              >
                <span className="text-sm">{t.icon}</span>
                <span>{t.label}</span>
                {showBadge && (
                  <span className="text-[9px] text-gray-600 font-mono bg-panel2 rounded px-1">{componentCount}</span>
                )}
                {showDot && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="flex-shrink-0 w-8 flex items-center justify-center text-gray-500 hover:text-gray-100 hover:bg-panel3 transition-colors border-l border-edge"
          title="Hide panel"
          aria-label="Hide right panel"
          aria-expanded={true}
        >
          ▶
        </button>
      </div>

      {/* Category rail — five large icons in a horizontal strip */}
      <div className="flex border-b border-edge flex-shrink-0">
        {CATEGORIES.map((c) => {
          const isActive = activeCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => {
                setCategory(c.id);
                if (!c.tabs.some((t) => t.id === (tab as TabId))) {
                  setTab(c.tabs[0].id);
                }
              }}
              className={`flex-1 py-2.5 transition-colors relative flex flex-col items-center gap-1 ${
                isActive
                  ? "text-gray-100"
                  : "text-gray-600 hover:text-gray-400"
              }`}
              aria-pressed={isActive}
              title={c.label}
            >
              <span className="text-base">{c.icon}</span>
              <span className="text-[10px] font-medium tracking-wide">{c.label}</span>
              {isActive && (
                <span className="absolute top-0 left-3 right-3 h-0.5 bg-accent rounded-full" />
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
        ) : tab === "code" ? (
          <CodeMirrorPanel />
        ) : tab === "shader" ? (
          <ShaderStudioPanel />
        ) : tab === "recipe" ? (
          <RecipePanel />
        ) : tab === "brand" ? (
          <BrandPackPanel />
        ) : tab === "capture" ? (
          <MotionCapturePanel />
        ) : tab === "export" ? (
          <ExportPresetsPanel />
        ) : tab === "lineage" ? (
          <SessionLineagePanel />
        ) : tab === "a11y" ? (
          <AccessibilityPanel />
        ) : tab === "perf" ? (
          <PerformancePanel />
        ) : tab === "storyboard" ? (
          <StoryboardPanel />
        ) : tab === "health" ? (
          <HealthDashboard />
        ) : tab === "variants" ? (
          <VariantComparison />
        ) : tab === "sequencer" ? (
          <TimelineSequencer />
        ) : tab === "sandbox" ? (
          <MotionSandbox />
        ) : tab === "intelligence" ? (
          <MotionIntelligencePanel />
        ) : tab === "storytelling" ? (
          <StorytellingPanel />
        ) : tab === "adaptive" ? (
          <AdaptivePanel />
        ) : !projectId ? (
          <div className="px-4 py-8 text-center text-xs text-gray-600">
            {tab === "layers" || tab === "states" || tab === "memory" || tab === "versions" || tab === "graph" || tab === "effects"
              ? "No project loaded."
              : "Open a project to inspect layers."}
          </div>
        ) : tab === "layers" ? (
          <LayersPanel />
        ) : tab === "effects" ? (
          <EffectsPanel />
        ) : tab === "graph" ? (
          <NodeGraphPanel />
        ) : tab === "states" ? (
          <StateMachinePanel />
        ) : tab === "memory" ? (
          <MemoryPanel projectId={projectId} />
        ) : tab === "versions" ? (
          <VersionHistoryPanel projectId={projectId} />
        ) : (
          <ComponentInspector />
        )}
      </div>
    </div>
  );
}
