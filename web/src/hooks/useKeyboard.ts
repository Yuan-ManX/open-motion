import { useEffect } from "react";
import { useUiStore } from "../store/uiStore.js";
import { useProjectStore } from "../store/projectStore.js";
import * as api from "../api/endpoints.js";

/**
 * Global keyboard shortcuts for the editor surface:
 * - Cmd/Ctrl+Z: undo last agent/local change
 * - Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y: redo
 * - Shift+R: replay the current animation
 * - Cmd/Ctrl+E: open the export dialog
 * - Cmd/Ctrl+/: toggle the keyboard shortcuts help
 * - Escape: clear component selection
 * - Delete/Backspace: remove the selected component (skipped while typing)
 */
export function useKeyboard() {
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const setExportOpen = useUiStore((s) => s.setExportOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const projectId = useProjectStore((s) => s.projectId);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      if (typing) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(!useUiStore.getState().shortcutsOpen);
        return;
      }
      if (e.shiftKey && (e.key === "R" || e.key === "r")) {
        e.preventDefault();
        triggerReplay();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setExportOpen(true);
        return;
      }
      if (e.key === "Escape") {
        selectComponent(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && projectId) {
        e.preventDefault();
        void api
          .removeComponent(projectId, selectedId)
          .then(() => {
            useProjectStore.getState().removeComponentLocal(selectedId);
            selectComponent(null);
          })
          .catch(() => {
            /* ignore — selection stays as-is */
          });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [triggerReplay, setExportOpen, setShortcutsOpen, selectComponent, selectedId, projectId, undo, redo]);
}
