import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";

function parsePx(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

/**
 * Floating quick-action toolbar that appears above the selected component.
 * Provides one-click access to duplicate, delete, lock, z-order, and solo.
 */
export function QuickActionBar() {
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const canvasZoom = useUiStore((s) => s.canvasZoom);
  const lockedIds = useUiStore((s) => s.lockedIds);
  const toggleLock = useUiStore((s) => s.toggleLock);
  const soloedId = useUiStore((s) => s.soloedId);
  const setSoloedId = useUiStore((s) => s.setSoloedId);
  const selectComponent = useUiStore((s) => s.selectComponent);

  if (!selectedId || !projectId) return null;

  const component = components.find((c) => c.id === selectedId);
  if (!component) return null;

  const left = parsePx(component.style.left);
  const top = parsePx(component.style.top);
  const width = parsePx(component.style.width, 100);

  // Position above the component in canvas coordinates.
  // The parent canvas div already applies pan/zoom transform,
  // so we use raw canvas coordinates and counter-scale to keep constant size.
  const barLeft = left + width / 2;
  const barTop = top - 36;

  // If the bar would go above the canvas, place it below the component instead
  const effectiveTop = barTop < 0 ? top + parsePx(component.style.height, 100) + 4 : barTop;

  const isLocked = lockedIds.has(selectedId);
  const isSoloed = soloedId === selectedId;

  const handleDuplicate = async () => {
    if (!projectId || !selectedId) return;
    try {
      const dup = await api.duplicateComponent(projectId, selectedId);
      selectComponent(dup.id);
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async () => {
    if (!projectId || !selectedId) return;
    try {
      await api.removeComponent(projectId, selectedId);
      selectComponent(null);
    } catch {
      /* ignore */
    }
  };

  const handleZOrder = async (action: "to-front" | "to-back" | "forward" | "backward") => {
    if (!projectId || !selectedId) return;
    const ids = components.map((c) => c.id);
    const idx = ids.indexOf(selectedId);
    if (idx === -1) return;

    let newIds = [...ids];
    if (action === "to-front") {
      newIds = newIds.filter((id) => id !== selectedId);
      newIds.push(selectedId);
    } else if (action === "to-back") {
      newIds = newIds.filter((id) => id !== selectedId);
      newIds.unshift(selectedId);
    } else if (action === "forward" && idx < ids.length - 1) {
      [newIds[idx], newIds[idx + 1]] = [newIds[idx + 1], newIds[idx]];
    } else if (action === "backward" && idx > 0) {
      [newIds[idx], newIds[idx - 1]] = [newIds[idx - 1], newIds[idx]];
    }

    try {
      await api.reorderComponents(projectId, newIds);
    } catch {
      /* ignore */
    }
  };

  const buttonClass =
    "w-6 h-6 flex items-center justify-center text-[10px] text-gray-400 hover:text-gray-100 hover:bg-panel2 rounded transition-colors";

  return (
    <div
      className="absolute z-50 flex items-center gap-0.5 bg-panel border border-edge rounded-md px-1 py-0.5 shadow-lg pointer-events-auto"
      style={{
        left: `${barLeft}px`,
        top: `${effectiveTop}px`,
        transform: `translateX(-50%) scale(${1 / canvasZoom})`,
        transformOrigin: "center bottom",
      }}
    >
      <button
        className={buttonClass}
        onClick={handleDuplicate}
        title="Duplicate"
        aria-label="Duplicate component"
      >
        ⧉
      </button>
      <button
        className={`${buttonClass} ${isLocked ? "text-gray-100 bg-panel2" : ""}`}
        onClick={() => toggleLock(selectedId)}
        title={isLocked ? "Unlock" : "Lock"}
        aria-label={isLocked ? "Unlock component" : "Lock component"}
        aria-pressed={isLocked}
      >
        {isLocked ? "🔒" : "🔓"}
      </button>
      <button
        className={`${buttonClass} ${isSoloed ? "text-gray-100 bg-panel2" : ""}`}
        onClick={() => setSoloedId(isSoloed ? null : selectedId)}
        title={isSoloed ? "Un-solo" : "Solo"}
        aria-label={isSoloed ? "Un-solo component" : "Solo component"}
        aria-pressed={isSoloed}
      >
        ⊙
      </button>
      <div className="w-px h-4 bg-edge mx-0.5" />
      <button
        className={buttonClass}
        onClick={() => void handleZOrder("forward")}
        title="Bring forward"
        aria-label="Bring forward"
      >
        ▲
      </button>
      <button
        className={buttonClass}
        onClick={() => void handleZOrder("backward")}
        title="Send backward"
        aria-label="Send backward"
      >
        ▼
      </button>
      <button
        className={buttonClass}
        onClick={() => void handleZOrder("to-front")}
        title="Bring to front"
        aria-label="Bring to front"
      >
        ⤒
      </button>
      <button
        className={buttonClass}
        onClick={() => void handleZOrder("to-back")}
        title="Send to back"
        aria-label="Send to back"
      >
        ⤓
      </button>
      <div className="w-px h-4 bg-edge mx-0.5" />
      <button
        className={`${buttonClass} hover:text-red-400`}
        onClick={handleDelete}
        title="Delete"
        aria-label="Delete component"
      >
        ✕
      </button>
    </div>
  );
}
