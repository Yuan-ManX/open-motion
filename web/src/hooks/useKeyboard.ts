import { useEffect } from "react";
import { useUiStore } from "../store/uiStore.js";
import { useProjectStore } from "../store/projectStore.js";
import * as api from "../api/endpoints.js";

/**
 * Global keyboard shortcuts for the editor surface:
 * - Shift+R: replay the current animation
 * - Cmd/Ctrl+E: open the export dialog
 * - Escape: clear component selection
 * - Delete/Backspace: remove the selected component (skipped while typing)
 */
export function useKeyboard() {
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const setExportOpen = useUiStore((s) => s.setExportOpen);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const projectId = useProjectStore((s) => s.projectId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
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
  }, [triggerReplay, setExportOpen, selectComponent, selectedId, projectId]);
}
