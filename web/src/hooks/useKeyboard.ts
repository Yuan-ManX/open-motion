import { useEffect } from "react";
import { useUiStore } from "../store/uiStore.js";
import { useProjectStore } from "../store/projectStore.js";
import { useClipboardStore } from "../store/clipboardStore.js";
import * as api from "../api/endpoints.js";
import { splitComponentAtTime, rectOf, distributeEvenly } from "../motion/timelineSplit.js";

/**
 * Global keyboard shortcuts for the editor surface. The full key map is also
 * shown in the in-app Keyboard shortcuts help panel.
 */
export function useKeyboard() {
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const setExportOpen = useUiStore((s) => s.setExportOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectedIds = useUiStore((s) => s.selectedIds);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const setSelectedIds = useUiStore((s) => s.setSelectedIds);
  const setSpaceHeld = useUiStore((s) => s.setSpaceHeld);
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
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

      // Space key — toggle canvas pan mode (only when not typing)
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCommandPaletteOpen(!useUiStore.getState().commandPaletteOpen);
        return;
      }
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
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D") && selectedId && projectId) {
        e.preventDefault();
        const comp = components.find((c) => c.id === selectedId);
        if (comp) {
          void api
            .createComponent(projectId, { name: `${comp.name} (copy)` })
            .then((clone) =>
              api.patchComponent(projectId, clone.id, {
                easing: comp.easing,
                durationMs: comp.durationMs,
                delayMs: comp.delayMs,
                iterationCount: comp.iterationCount,
                direction: comp.direction,
                keyframes: comp.keyframes,
                style: comp.style,
              }),
            )
            .then(() => useProjectStore.getState().loadProject(projectId))
            .catch(() => {});
        }
        return;
      }
      // Cmd/Ctrl+Shift+D: split selected component at the playhead
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "d" || e.key === "D") && selectedId && projectId) {
        e.preventDefault();
        const comp = components.find((c) => c.id === selectedId);
        if (comp) {
          const playheadMs = useUiStore.getState().playheadMs;
          const { before, after } = splitComponentAtTime(comp, playheadMs);
          // Remove the original, insert the two siblings
          void (async () => {
            try {
              await api.removeComponent(projectId, comp.id);
              useProjectStore.getState().removeComponentLocal(comp.id);
              const b = await api.createComponent(projectId, { name: before.name });
              await api.patchComponent(projectId, b.id, {
                easing: before.easing, durationMs: before.durationMs, delayMs: before.delayMs,
                iterationCount: before.iterationCount, direction: before.direction,
                keyframes: before.keyframes, style: before.style,
              } as Partial<import("@openmotion/shared").MotionComponent>);
              useProjectStore.getState().addComponentLocal({ ...b, ...{ easing: before.easing, durationMs: before.durationMs, delayMs: before.delayMs, iterationCount: before.iterationCount, direction: before.direction, keyframes: before.keyframes, style: before.style } } as never);
              const a = await api.createComponent(projectId, { name: after.name });
              await api.patchComponent(projectId, a.id, {
                easing: after.easing, durationMs: after.durationMs, delayMs: after.delayMs,
                iterationCount: after.iterationCount, direction: after.direction,
                keyframes: after.keyframes, style: after.style,
              } as Partial<import("@openmotion/shared").MotionComponent>);
              useProjectStore.getState().addComponentLocal({ ...a, ...{ easing: after.easing, durationMs: after.durationMs, delayMs: after.delayMs, iterationCount: after.iterationCount, direction: after.direction, keyframes: after.keyframes, style: after.style } } as never);
              await useProjectStore.getState().loadProject(projectId);
              useUiStore.getState().selectComponent(a.id);
            } catch { /* split failed — leave untouched */ }
          })();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A") && projectId) {
        e.preventDefault();
        setSelectedIds(components.map((c) => c.id));
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
      // Cmd/Ctrl+S: save the current project (reload from server to confirm persistence)
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (projectId) {
          void useProjectStore.getState().loadProject(projectId);
        }
        return;
      }
      // Cmd/Ctrl+G: group selected components
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "g" || e.key === "G") && selectedIds.size >= 2) {
        e.preventDefault();
        const groupId = `grp-${Date.now()}`;
        useProjectStore.getState().groupComponentsLocal([...selectedIds], groupId);
        return;
      }
      // Cmd/Ctrl+Shift+G: ungroup — clear parentId on all selected components
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "g" || e.key === "G") && selectedIds.size > 0) {
        e.preventDefault();
        for (const id of selectedIds) {
          useProjectStore.getState().ungroupComponentLocal(id);
        }
        return;
      }
      // Cmd/Ctrl+Shift+H: distribute selected components horizontally
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "h" || e.key === "H") && selectedIds.size >= 3 && projectId) {
        e.preventDefault();
        const rects = Array.from(selectedIds).map((id) => {
          const c = components.find((x) => x.id === id)!;
          return rectOf(c, 0, 0);
        });
        const patches = distributeEvenly(rects, "x");
        for (const p of patches) {
          const comp = components.find((c) => c.id === p.id);
          if (!comp) continue;
          const newStyle = { ...(comp.style as Record<string, unknown>), ...p.stylePatch } as Record<string, string | number>;
          useProjectStore.getState().updateComponentLive(p.id, newStyle);
          void api.patchComponent(projectId, p.id, { style: newStyle }).catch(() => {});
        }
        return;
      }
      // Cmd/Ctrl+Shift+V: distribute selected components vertically
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "v" || e.key === "V") && selectedIds.size >= 3 && projectId) {
        e.preventDefault();
        const rects = Array.from(selectedIds).map((id) => {
          const c = components.find((x) => x.id === id)!;
          return rectOf(c, 0, 0);
        });
        const patches = distributeEvenly(rects, "y");
        for (const p of patches) {
          const comp = components.find((c) => c.id === p.id);
          if (!comp) continue;
          const newStyle = { ...(comp.style as Record<string, unknown>), ...p.stylePatch } as Record<string, string | number>;
          useProjectStore.getState().updateComponentLive(p.id, newStyle);
          void api.patchComponent(projectId, p.id, { style: newStyle }).catch(() => {});
        }
        return;
      }
      // Cmd/Ctrl+B: toggle the left sidebar
      if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        const s = useUiStore.getState();
        s.setSidebarCollapsed(!s.sidebarCollapsed);
        return;
      }
      // Alt+ArrowUp/Down: navigate between components in the timeline
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && components.length > 0) {
        e.preventDefault();
        const sorted = [...components].sort((a, b) => a.delayMs - b.delayMs);
        const currentIdx = selectedId ? sorted.findIndex((c) => c.id === selectedId) : -1;
        if (e.key === "ArrowDown") {
          const nextIdx = currentIdx < sorted.length - 1 ? currentIdx + 1 : 0;
          selectComponent(sorted[nextIdx].id);
        } else {
          const prevIdx = currentIdx > 0 ? currentIdx - 1 : sorted.length - 1;
          selectComponent(sorted[prevIdx].id);
        }
        return;
      }
      // Arrow key nudge (with selection) or timeline stepping (without selection)
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (selectedIds.size > 0 && projectId) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          const ids = Array.from(selectedIds);
          ids.forEach((id) => {
            const comp = components.find((c) => c.id === id);
            if (!comp) return;
            const s = comp.style as Record<string, string | number> | undefined;
            const left = typeof s?.left === "number" ? s.left : parseFloat(String(s?.left ?? "0")) || 0;
            const top = typeof s?.top === "number" ? s.top : parseFloat(String(s?.top ?? "0")) || 0;
            const newStyle = { ...s, left: left + dx, top: top + dy };
            useProjectStore.getState().updateComponentLive(id, newStyle);
            void api.patchComponent(projectId, id, { style: newStyle }).catch(() => {});
          });
        } else {
          e.preventDefault();
          useUiStore.getState().setTimelineCommand(e.key === "ArrowLeft" || e.key === "ArrowUp" ? "stepBackward" : "stepForward");
        }
        return;
      }
      // Timeline playback controls
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        useUiStore.getState().setTimelineCommand("togglePlay");
        return;
      }
      if (e.key === "," || e.key === "<") {
        e.preventDefault();
        useUiStore.getState().setTimelineCommand("stepBackward");
        return;
      }
      if (e.key === "." || e.key === ">") {
        e.preventDefault();
        useUiStore.getState().setTimelineCommand("stepForward");
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        useUiStore.getState().setTimelineCommand("jumpStart");
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        useUiStore.getState().setTimelineCommand("jumpEnd");
        return;
      }
      // Fit timeline to view — resets zoom to 1x
      if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        useUiStore.getState().setTimelineCommand("fitView");
        return;
      }
      if (e.key === "m" || e.key === "M") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          useUiStore.getState().setTimelineCommand("addMarker");
          return;
        }
      }
      // Split at playhead — splits the selected component at the current playhead
      if ((e.key === "s" || e.key === "S") && !e.metaKey && !e.ctrlKey && selectedId && projectId) {
        e.preventDefault();
        const comp = components.find((c) => c.id === selectedId);
        if (comp) {
          const playheadMs = useUiStore.getState().playheadMs ?? 0;
          const splitMs = playheadMs - comp.delayMs;
          if (splitMs > 0 && splitMs < comp.durationMs) {
            const splitOffset = splitMs / comp.durationMs;
            const firstKeyframes = comp.keyframes
              .filter((kf) => kf.offset <= splitOffset)
              .map((kf) => ({ ...kf, offset: kf.offset / splitOffset }));
            void api.patchComponent(projectId, comp.id, {
              durationMs: splitMs,
              keyframes: firstKeyframes.length > 0 ? firstKeyframes : comp.keyframes,
            }).then(() =>
              api.createComponent(projectId, { name: `${comp.name} (split)` }).then((clone) =>
                api.patchComponent(projectId, clone.id, {
                  easing: comp.easing,
                  durationMs: comp.durationMs - splitMs,
                  delayMs: comp.delayMs + splitMs,
                  iterationCount: comp.iterationCount,
                  direction: comp.direction,
                  keyframes: comp.keyframes
                    .filter((kf) => kf.offset >= splitOffset)
                    .map((kf) => ({ ...kf, offset: (kf.offset - splitOffset) / (1 - splitOffset) })),
                  style: comp.style,
                  trigger: comp.trigger,
                }),
              ),
            ).then(() => useProjectStore.getState().loadProject(projectId)).catch(() => {});
          }
        }
        return;
      }
      // Copy / Cut
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C") && selectedIds.size > 0) {
        e.preventDefault();
        const selectedComps = components.filter((c) => selectedIds.has(c.id));
        useClipboardStore.getState().copy(selectedComps);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "x" || e.key === "X") && selectedIds.size > 0 && projectId) {
        e.preventDefault();
        const selectedComps = components.filter((c) => selectedIds.has(c.id));
        useClipboardStore.getState().copy(selectedComps);
        selectedComps.forEach((c) => {
          void api.removeComponent(projectId, c.id).then(() => {
            useProjectStore.getState().removeComponentLocal(c.id);
          }).catch(() => {});
        });
        selectComponent(null);
        return;
      }
      // Paste
      if ((e.metaKey || e.ctrlKey) && (e.key === "v" || e.key === "V") && projectId) {
        e.preventDefault();
        const entries = useClipboardStore.getState().entries;
        if (entries.length === 0) return;
        entries.forEach(async (entry) => {
          const clone = await api.createComponent(projectId, { name: `${entry.name} (paste)` });
          const newStyle = { ...entry.style };
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
          });
          useProjectStore.getState().addComponentLocal(clone);
          selectComponent(clone.id);
        });
        return;
      }
      if (e.key === "Escape") {
        selectComponent(null);
        useUiStore.getState().setContextMenu(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && projectId) {
        e.preventDefault();
        // Shift+Delete: ripple delete — remove and shift subsequent components left
        if (e.shiftKey) {
          const comp = components.find((c) => c.id === selectedId);
          if (comp) {
            const iters = comp.iterationCount === "infinite" ? 1 : Number(comp.iterationCount) || 1;
            const removedSpan = comp.delayMs + comp.durationMs * iters;
            const removedDelay = comp.delayMs;
            const toShift = components.filter((c) => c.id !== selectedId && c.delayMs >= removedDelay);
            void api.removeComponent(projectId, selectedId)
              .then(async () => {
                for (const c of toShift) {
                  const newDelay = Math.max(0, c.delayMs - removedSpan);
                  await api.patchComponent(projectId, c.id, { delayMs: newDelay });
                }
                useProjectStore.getState().removeComponentLocal(selectedId);
                selectComponent(null);
                await useProjectStore.getState().loadProject(projectId);
              })
              .catch(() => {});
          }
        } else if (selectedIds.size > 1) {
          // Batch delete when multiple components are selected
          const ids = Array.from(selectedIds);
          void api.batchRemoveComponents(projectId, ids)
            .then(() => {
              ids.forEach((id) => useProjectStore.getState().removeComponentLocal(id));
              selectComponent(null);
            })
            .catch(() => {});
        } else {
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
      }
    };
    window.addEventListener("keydown", onKey);
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        setSpaceHeld(false);
      }
    };
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [triggerReplay, setExportOpen, setShortcutsOpen, setCommandPaletteOpen, selectComponent, selectedId, selectedIds, setSelectedIds, projectId, components, undo, redo, setSpaceHeld]);
}
