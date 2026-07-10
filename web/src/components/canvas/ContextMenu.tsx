import { useEffect, useRef, useCallback } from "react";
import { useUiStore } from "../../store/uiStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useClipboardStore } from "../../store/clipboardStore.js";
import * as api from "../../api/endpoints.js";
import type { MotionComponent } from "@openmotion/shared";

interface MenuItem {
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
  danger?: boolean;
}

export function ContextMenu() {
  const menu = useUiStore((s) => s.contextMenu);
  const setMenu = useUiStore((s) => s.setContextMenu);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const setSelectedIds = useUiStore((s) => s.setSelectedIds);
  const setRightPanelTab = useUiStore((s) => s.setRightPanelTab);
  const toggleLock = useUiStore((s) => s.toggleLock);
  const lockedIds = useUiStore((s) => s.lockedIds);
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const loadProject = useProjectStore((s) => s.loadProject);
  const addComponentLocal = useProjectStore((s) => s.addComponentLocal);
  const removeComponentLocal = useProjectStore((s) => s.removeComponentLocal);
  const copyToClipboard = useClipboardStore((s) => s.copy);
  const clipboardEntries = useClipboardStore((s) => s.entries);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setMenu(null), [setMenu]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menu, close]);

  if (!menu) return null;

  const comp = menu.componentId ? components.find((c) => c.id === menu.componentId) : null;
  const isLocked = comp ? lockedIds.has(comp.id) : false;

  const handleCopy = () => {
    if (comp) {
      copyToClipboard([comp]);
    }
    close();
  };

  const handlePaste = async () => {
    if (!projectId || clipboardEntries.length === 0) { close(); return; }
    for (const entry of clipboardEntries) {
      const clone = await api.createComponent(projectId, { name: `${entry.name} (paste)` });
      const newStyle = { ...entry.style };
      // Offset pasted component
      const left = typeof newStyle.left === "number" ? newStyle.left : parseFloat(String(newStyle.left ?? "0")) || 0;
      const top = typeof newStyle.top === "number" ? newStyle.top : parseFloat(String(newStyle.top ?? "0")) || 0;
      newStyle.left = left + 20;
      newStyle.top = top + 20;
      await api.patchComponent(projectId, clone.id, {
        easing: entry.easing,
        durationMs: entry.durationMs,
        delayMs: entry.delayMs,
        iterationCount: entry.iterationCount,
        direction: entry.direction,
        keyframes: entry.keyframes,
        style: newStyle,
        trigger: entry.trigger,
      } as Partial<MotionComponent>);
      addComponentLocal(clone);
    }
    await loadProject(projectId);
    close();
  };

  const handleDuplicate = async () => {
    if (!projectId || !comp) { close(); return; }
    const clone = await api.duplicateComponent(projectId, comp.id);
    addComponentLocal(clone);
    selectComponent(clone.id);
    close();
  };

  const handleDelete = async () => {
    if (!projectId || !comp) { close(); return; }
    await api.removeComponent(projectId, comp.id);
    removeComponentLocal(comp.id);
    selectComponent(null);
    close();
  };

  const handleBringToFront = async () => {
    if (!projectId || !comp) { close(); return; }
    const orderedIds = [...components].sort((a, b) => a.orderIndex - b.orderIndex).map((c) => c.id);
    const idx = orderedIds.indexOf(comp.id);
    if (idx !== -1 && idx < orderedIds.length - 1) {
      orderedIds.splice(idx, 1);
      orderedIds.push(comp.id);
      const updated = await api.reorderComponents(projectId, orderedIds);
      useProjectStore.getState().applySpecUpdate(updated);
    }
    close();
  };

  const handleSendToBack = async () => {
    if (!projectId || !comp) { close(); return; }
    const orderedIds = [...components].sort((a, b) => a.orderIndex - b.orderIndex).map((c) => c.id);
    const idx = orderedIds.indexOf(comp.id);
    if (idx > 0) {
      orderedIds.splice(idx, 1);
      orderedIds.unshift(comp.id);
      const updated = await api.reorderComponents(projectId, orderedIds);
      useProjectStore.getState().applySpecUpdate(updated);
    }
    close();
  };

  const handleLock = () => {
    if (comp) toggleLock(comp.id);
    close();
  };

  const handleSelectAll = () => {
    setSelectedIds(components.map((c) => c.id));
    close();
  };

  const handleProperties = () => {
    setRightPanelTab("inspector");
    close();
  };

  const items: MenuItem[] = comp
    ? [
        { label: "Copy", icon: "⎘", shortcut: "⌘C", action: handleCopy },
        { label: "Duplicate", icon: "⧉", shortcut: "⌘D", action: handleDuplicate },
        { label: "Delete", icon: "✕", shortcut: "Del", action: handleDelete, danger: true },
        { label: "—", icon: "", action: () => {} },
        { label: "Bring to Front", icon: "⤒", action: handleBringToFront },
        { label: "Send to Back", icon: "⤓", action: handleSendToBack },
        { label: isLocked ? "Unlock" : "Lock", icon: isLocked ? "🔒" : "🔓", action: handleLock },
        { label: "—", icon: "", action: () => {} },
        { label: "Properties", icon: "◐", action: handleProperties },
      ]
    : [
        { label: "Paste", icon: "⎘", shortcut: "⌘V", action: handlePaste },
        { label: "Select All", icon: "▭", shortcut: "⌘A", action: handleSelectAll },
      ];

  // Filter out separators for keyboard nav, but keep for rendering
  const menuItems = items.filter((item) => item.label !== "—");
  const separatorIndices = items.map((item, i) => (item.label === "—" ? i : -1)).filter((i) => i !== -1);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[160px] py-1 bg-panel border border-edge rounded-lg shadow-2xl"
      style={{ left: menu.x, top: menu.y }}
    >
      {items.map((item, i) => {
        if (item.label === "—") {
          return <div key={i} className="h-px bg-edge my-1" />;
        }
        return (
          <button
            key={i}
            onClick={item.action}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-panel2 transition-colors ${
              item.danger ? "text-red-400" : "text-gray-200"
            }`}
          >
            <span className="w-4 text-center text-[10px] text-gray-500">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="text-[9px] text-gray-600 font-mono">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
