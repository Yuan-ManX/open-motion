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
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const selectedId = useUiStore((s) => s.selectedComponentId);

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
      { id: "new-project", label: "New Project", hint: "Create a blank motion project", group: "Project", action: () => void handleNewProject(), disabled: false },
      { id: "browse-templates", label: "Browse Templates", hint: "Open the template gallery", group: "Project", action: () => setRightPanelTab("templates") },
      { id: "skills", label: "Open Skills", hint: "Browse AI-callable skills", group: "Project", action: () => setRightPanelTab("skills") },
      { id: "export", label: "Export Project", hint: "Export as HTML, CSS, JSON, or React", group: "Project", shortcut: "⌘E", action: () => setExportOpen(true), disabled: !hasProject },
      { id: "replay", label: "Replay Animation", hint: "Replay the current motion", group: "Playback", shortcut: "⇧R", action: () => triggerReplay(), disabled: !hasProject },
      { id: "undo", label: "Undo", hint: "Undo the last change", group: "Edit", shortcut: "⌘Z", action: () => undo(), disabled: !canUndo },
      { id: "redo", label: "Redo", hint: "Redo the last undone change", group: "Edit", shortcut: "⌘⇧Z", action: () => redo(), disabled: !canRedo },
      { id: "duplicate", label: "Duplicate Component", hint: "Clone the selected component", group: "Component", shortcut: "⌘D", action: () => void handleDuplicate(), disabled: !hasSelection },
      { id: "delete", label: "Delete Component", hint: "Remove the selected component", group: "Component", shortcut: "⌫", action: () => void handleDelete(), disabled: !hasSelection },
      { id: "deselect", label: "Deselect", hint: "Clear the current selection", group: "Component", shortcut: "Esc", action: () => selectComponent(null), disabled: !hasSelection },
      { id: "close-project", label: "Close Project", hint: "Return to the home panel", group: "Project", action: () => reset(), disabled: !hasProject },
      { id: "shortcuts", label: "Keyboard Shortcuts", hint: "Show the shortcut reference", group: "Help", shortcut: "⌘/", action: () => setShortcutsOpen(true) },
    ];
  }, [projectId, selectedId, canUndo, canRedo, handleNewProject, setRightPanelTab, setExportOpen, triggerReplay, undo, redo, handleDuplicate, handleDelete, selectComponent, reset, setShortcutsOpen]);

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
