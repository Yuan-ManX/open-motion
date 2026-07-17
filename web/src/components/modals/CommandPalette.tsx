import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useUiStore } from "../../store/uiStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import * as api from "../../api/endpoints.js";

interface Command {
  id: string;
  label: string;
  hint: string;
  group: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
}

/** Quick-access command palette opened with Cmd/Ctrl+K. */
export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setExportOpen = useUiStore((s) => s.setExportOpen);
  const setRightPanelTab = useUiStore((s) => s.setRightPanelTab);
  const setRightPanelCategory = useUiStore((s) => s.setRightPanelCategory);
  const setRightPanelCollapsed = useUiStore((s) => s.setRightPanelCollapsed);
  const rightPanelCollapsed = useUiStore((s) => s.rightPanelCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const setSnapToGrid = useUiStore((s) => s.setSnapToGrid);
  const snapToGrid = useUiStore((s) => s.snapToGrid);
  const setAutoKeyframe = useUiStore((s) => s.setAutoKeyframe);
  const autoKeyframe = useUiStore((s) => s.autoKeyframe);
  const setShowMotionPaths = useUiStore((s) => s.setShowMotionPaths);
  const showMotionPaths = useUiStore((s) => s.showMotionPaths);
  const resetCanvasView = useUiStore((s) => s.resetCanvasView);
  const setTimelineCommand = useUiStore((s) => s.setTimelineCommand);

  const projectId = useProjectStore((s) => s.projectId);
  const loadProject = useProjectStore((s) => s.loadProject);
  const reset = useProjectStore((s) => s.reset);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const components = useProjectStore((s) => s.components);
  const removeComponentLocal = useProjectStore((s) => s.removeComponentLocal);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleNewProject = useCallback(async () => {
    const p = await api.createProject({ name: "Untitled motion" });
    await loadProject(p.id);
  }, [loadProject]);

  const handleDuplicate = useCallback(async () => {
    if (!selectedId || !projectId) return;
    const comp = components.find((c) => c.id === selectedId);
    if (!comp) return;
    const clone = await api.createComponent(projectId, { name: `${comp.name} (copy)` });
    // Copy the original component's motion properties onto the clone
    await api.patchComponent(projectId, clone.id, {
      easing: comp.easing,
      durationMs: comp.durationMs,
      delayMs: comp.delayMs,
      iterationCount: comp.iterationCount,
      direction: comp.direction,
      keyframes: comp.keyframes,
      style: comp.style,
    });
  }, [selectedId, projectId, components]);

  const handleDelete = useCallback(async () => {
    if (!selectedId || !projectId) return;
    await api.removeComponent(projectId, selectedId);
    removeComponentLocal(selectedId);
    selectComponent(null);
  }, [selectedId, projectId, removeComponentLocal, selectComponent]);

  const commands = useMemo<Command[]>(() => {
    const hasProject = !!projectId;
    const hasSelection = !!selectedId;
    return [
      // --- Project ---
      { id: "new-project", label: "New Project", hint: "Create a blank motion project", group: "Project", action: () => void handleNewProject(), disabled: false },
      { id: "browse-templates", label: "Browse Templates", hint: "Open the template gallery", group: "Project", action: () => { setRightPanelCategory("assets"); setRightPanelTab("templates"); } },
      { id: "skills", label: "Open Skills", hint: "Browse AI-callable skills", group: "Project", action: () => { setRightPanelCategory("assets"); setRightPanelTab("skills"); } },
      { id: "export", label: "Export Project", hint: "Export as HTML, CSS, JSON, or React", group: "Project", shortcut: "⌘E", action: () => setExportOpen(true), disabled: !hasProject },
      { id: "close-project", label: "Close Project", hint: "Return to the home panel", group: "Project", action: () => reset(), disabled: !hasProject },

      // --- Navigate panels ---
      { id: "goto-layers", label: "Go to Layers", hint: "Open the layers panel", group: "Navigate", action: () => { setRightPanelCategory("design"); setRightPanelTab("layers"); } },
      { id: "goto-inspector", label: "Go to Inspector", hint: "Inspect the selected component", group: "Navigate", action: () => { setRightPanelCategory("design"); setRightPanelTab("inspector"); } },
      { id: "goto-graph", label: "Go to Graph", hint: "Node graph editor", group: "Navigate", action: () => { setRightPanelCategory("design"); setRightPanelTab("graph"); } },
      { id: "goto-code", label: "Go to Code", hint: "Generated code output", group: "Navigate", action: () => { setRightPanelCategory("design"); setRightPanelTab("code"); } },
      { id: "goto-shader", label: "Go to Shader Studio", hint: "Browse and apply shader effects", group: "Navigate", action: () => { setRightPanelCategory("design"); setRightPanelTab("shader"); } },
      { id: "goto-recipes", label: "Go to Recipes", hint: "Curated motion recipes", group: "Navigate", action: () => { setRightPanelCategory("motion"); setRightPanelTab("recipe"); } },
      { id: "goto-brand", label: "Go to Brand Packs", hint: "Brand identity presets", group: "Navigate", action: () => { setRightPanelCategory("design"); setRightPanelTab("brand"); } },
      { id: "goto-variants", label: "Go to Variants", hint: "Design variants explorer", group: "Navigate", action: () => { setRightPanelCategory("assets"); setRightPanelTab("variants"); } },
      { id: "goto-states", label: "Go to States", hint: "State machine editor", group: "Navigate", action: () => { setRightPanelCategory("motion"); setRightPanelTab("states"); } },
      { id: "goto-memory", label: "Go to Memory", hint: "Agent memory browser", group: "Navigate", action: () => { setRightPanelCategory("assets"); setRightPanelTab("memory"); } },
      { id: "goto-a11y", label: "Go to Accessibility", hint: "Motion accessibility report", group: "Navigate", action: () => { setRightPanelCategory("output"); setRightPanelTab("a11y"); } },
      { id: "goto-perf", label: "Go to Performance", hint: "Motion performance profile", group: "Navigate", action: () => { setRightPanelCategory("output"); setRightPanelTab("perf"); } },
      { id: "goto-lineage", label: "Go to Lineage", hint: "Session lineage graph", group: "Navigate", action: () => { setRightPanelCategory("output"); setRightPanelTab("lineage"); } },

      // --- View ---
      { id: "toggle-sidebar", label: "Toggle Sidebar", hint: sidebarCollapsed ? "Show the left sidebar" : "Hide the left sidebar", group: "View", action: () => setSidebarCollapsed(!sidebarCollapsed) },
      { id: "toggle-right-panel", label: "Toggle Right Panel", hint: rightPanelCollapsed ? "Expand the right panel" : "Collapse the right panel", group: "View", action: () => setRightPanelCollapsed(!rightPanelCollapsed) },
      { id: "toggle-snap", label: snapToGrid ? "Disable Snap to Grid" : "Enable Snap to Grid", hint: "Align drags to playhead and edges", group: "View", action: () => setSnapToGrid(!snapToGrid) },
      { id: "toggle-auto-keyframe", label: autoKeyframe ? "Disable Auto-Keyframe" : "Enable Auto-Keyframe", hint: "Record property changes as keyframes", group: "View", action: () => setAutoKeyframe(!autoKeyframe) },
      { id: "toggle-motion-paths", label: showMotionPaths ? "Hide Motion Paths" : "Show Motion Paths", hint: "Visualize motion trajectories on canvas", group: "View", action: () => setShowMotionPaths(!showMotionPaths) },
      { id: "reset-canvas", label: "Reset Canvas View", hint: "Reset zoom and pan to default", group: "View", action: () => resetCanvasView() },

      // --- Playback ---
      { id: "replay", label: "Replay Animation", hint: "Replay the current motion", group: "Playback", shortcut: "⇧R", action: () => triggerReplay(), disabled: !hasProject },
      { id: "play-pause", label: "Play / Pause", hint: "Toggle timeline playback", group: "Playback", shortcut: "P", action: () => setTimelineCommand("togglePlay"), disabled: !hasProject },
      { id: "step-forward", label: "Step Forward", hint: "Advance one frame", group: "Playback", shortcut: ".", action: () => setTimelineCommand("stepForward"), disabled: !hasProject },
      { id: "step-backward", label: "Step Backward", hint: "Go back one frame", group: "Playback", shortcut: ",", action: () => setTimelineCommand("stepBackward"), disabled: !hasProject },
      { id: "jump-start", label: "Jump to Start", hint: "Move playhead to beginning", group: "Playback", shortcut: "Home", action: () => setTimelineCommand("jumpStart"), disabled: !hasProject },
      { id: "jump-end", label: "Jump to End", hint: "Move playhead to end", group: "Playback", shortcut: "End", action: () => setTimelineCommand("jumpEnd"), disabled: !hasProject },
      { id: "fit-view", label: "Fit Timeline", hint: "Reset timeline zoom to fit", group: "Playback", shortcut: "F", action: () => setTimelineCommand("fitView"), disabled: !hasProject },
      { id: "add-marker", label: "Add Marker", hint: "Place a marker at the playhead", group: "Playback", shortcut: "M", action: () => setTimelineCommand("addMarker"), disabled: !hasProject },

      // --- Edit ---
      { id: "undo", label: "Undo", hint: "Undo the last change", group: "Edit", shortcut: "⌘Z", action: () => undo(), disabled: !canUndo },
      { id: "redo", label: "Redo", hint: "Redo the last undone change", group: "Edit", shortcut: "⌘⇧Z", action: () => redo(), disabled: !canRedo },

      // --- Component ---
      { id: "duplicate", label: "Duplicate Component", hint: "Clone the selected component", group: "Component", shortcut: "⌘D", action: () => void handleDuplicate(), disabled: !hasSelection },
      { id: "delete", label: "Delete Component", hint: "Remove the selected component", group: "Component", shortcut: "⌫", action: () => void handleDelete(), disabled: !hasSelection },
      { id: "deselect", label: "Deselect", hint: "Clear the current selection", group: "Component", shortcut: "Esc", action: () => selectComponent(null), disabled: !hasSelection },

      // --- Help ---
      { id: "shortcuts", label: "Keyboard Shortcuts", hint: "Show the shortcut reference", group: "Help", shortcut: "⌘/", action: () => setShortcutsOpen(true) },
    ];
  }, [projectId, selectedId, canUndo, canRedo, handleNewProject, setRightPanelTab, setRightPanelCategory, setExportOpen, triggerReplay, undo, redo, handleDuplicate, handleDelete, selectComponent, reset, setShortcutsOpen, sidebarCollapsed, setSidebarCollapsed, rightPanelCollapsed, setRightPanelCollapsed, snapToGrid, setSnapToGrid, autoKeyframe, setAutoKeyframe, showMotionPaths, setShowMotionPaths, resetCanvasView, setTimelineCommand]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd && !cmd.disabled) {
        cmd.action();
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  if (!open) return null;

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-panel border border-edge rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command…"
          className="w-full px-4 py-3 bg-transparent border-b border-edge text-sm text-gray-100 placeholder-gray-600 focus:outline-none"
          aria-label="Command palette search"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-gray-600">No commands found.</div>
          )}
          {filtered.map((cmd, i) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            return (
              <div key={cmd.id}>
                {showGroup && (
                  <div className="px-3 pt-2 pb-0.5 text-[9px] uppercase tracking-wide text-gray-600">
                    {cmd.group}
                  </div>
                )}
                <button
                  onClick={() => {
                    if (!cmd.disabled) {
                      cmd.action();
                      setOpen(false);
                    }
                  }}
                  disabled={cmd.disabled}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    i === activeIndex && !cmd.disabled
                      ? "bg-accent/15 text-accent"
                      : cmd.disabled
                        ? "text-gray-700 cursor-not-allowed"
                        : "text-gray-300 hover:bg-panel2"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{cmd.label}</div>
                    <div className="text-[10px] text-gray-600 truncate">{cmd.hint}</div>
                  </div>
                  {cmd.shortcut && (
                    <span className="text-[10px] text-gray-600 font-mono bg-panel2 px-1.5 py-0.5 rounded border border-edge">
                      {cmd.shortcut}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-1.5 border-t border-edge flex items-center gap-3 text-[9px] text-gray-600">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
