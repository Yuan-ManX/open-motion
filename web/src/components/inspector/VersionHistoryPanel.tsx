import { useCallback, useEffect, useState } from "react";
import {
  listVersions,
  createVersion,
  restoreVersion,
  deleteVersion,
  type VersionSummary,
} from "../../api/endpoints.js";
import { useProjectStore } from "../../store/projectStore.js";

interface RestoreState {
  versionId: string;
  status: "confirm" | "restoring" | "done" | "error";
}

/** Format an ISO timestamp into a compact relative label. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Version history panel — capture, browse, restore, and delete project snapshots.
 * Each snapshot serializes the full MotionSpec (project + components) for time-travel.
 */
export function VersionHistoryPanel({ projectId }: { projectId: string }) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<RestoreState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const loadProject = useProjectStore((s) => s.loadProject);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listVersions(projectId);
      setVersions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load versions");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async () => {
    const trimmed = label.trim() || `Snapshot ${new Date().toLocaleTimeString()}`;
    setBusy(true);
    try {
      await createVersion(projectId, trimmed);
      setLabel("");
      setShowForm(false);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to capture version");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    setRestore({ versionId, status: "restoring" });
    try {
      await restoreVersion(projectId, versionId);
      await loadProject(projectId);
      setRestore({ versionId, status: "done" });
      void refresh();
      setTimeout(() => setRestore(null), 1500);
    } catch (e) {
      setRestore({
        versionId,
        status: "error",
      });
      setError(e instanceof Error ? e.message : "Failed to restore version");
      setTimeout(() => setRestore(null), 2500);
    }
  };

  const handleDelete = async (versionId: string) => {
    try {
      await deleteVersion(projectId, versionId);
      setDeleteId(null);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete version");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with capture button */}
      <div className="p-2 flex items-center gap-1.5 flex-shrink-0 border-b border-edge/50">
        <span className="text-[10px] text-gray-500 flex-1">
          {versions.length} {versions.length === 1 ? "snapshot" : "snapshots"}
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          title="Capture snapshot"
          aria-label="Capture snapshot"
          aria-expanded={showForm}
          className={`px-2 py-1 rounded border border-edge text-[10px] ${showForm ? "bg-panel2 text-gray-200" : "text-gray-400 hover:text-gray-200"}`}
        >
          + Save
        </button>
      </div>

      {/* Capture form */}
      {showForm && (
        <div className="px-2 py-2 space-y-1.5 flex-shrink-0 border-b border-edge/50">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g., before stagger tweak)"
            className="w-full bg-panel border border-edge rounded px-2 py-1 text-[10px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") setShowForm(false);
            }}
            autoFocus
          />
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={busy}
              className="flex-1 px-2 py-1 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-black text-[10px] font-medium"
            >
              {busy ? "Capturing…" : "Capture"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-2 py-1 rounded border border-edge text-gray-500 hover:text-gray-300 text-[10px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="px-2 py-1.5 bg-red-950/30 border-b border-red-900/40 flex-shrink-0">
          <span className="text-[10px] text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-[9px] text-red-500 hover:text-red-300"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-3 text-[11px] text-gray-500">Loading snapshots…</div>}
        {!loading && versions.length === 0 && (
          <div className="p-3 text-[11px] text-gray-600 leading-relaxed">
            No snapshots yet. Capture the current state to enable time-travel restores. The agent can also capture snapshots automatically before spec-changing operations.
          </div>
        )}
        {versions.map((v) => {
          const isRestoreTarget = restore?.versionId === v.id;
          const isDeleteTarget = deleteId === v.id;
          return (
            <div key={v.id} className="border-b border-edge/50 group">
              {isDeleteTarget ? (
                <div className="px-2.5 py-2 bg-red-950/20">
                  <p className="text-[10px] text-red-300 mb-1.5">Delete this snapshot? This cannot be undone.</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => void handleDelete(v.id)}
                      className="flex-1 px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-medium"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteId(null)}
                      className="flex-1 px-2 py-1 rounded border border-edge text-gray-400 hover:text-gray-200 text-[10px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="px-2.5 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-gray-200 truncate">{v.label}</span>
                      <span className="text-[9px] text-gray-600 ml-1.5 font-mono flex-shrink-0">{v.componentCount}c</span>
                    </div>
                    <div className="text-[9px] text-gray-600 mt-0.5">{formatRelative(v.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isRestoreTarget && restore?.status === "restoring" ? (
                      <span className="text-[9px] text-gray-400 animate-pulse">Restoring…</span>
                    ) : isRestoreTarget && restore?.status === "done" ? (
                      <span className="text-[9px] text-gray-100">✓ Restored</span>
                    ) : isRestoreTarget && restore?.status === "error" ? (
                      <span className="text-[9px] text-red-400">Failed</span>
                    ) : (
                      <>
                        <button
                          onClick={() => setRestore({ versionId: v.id, status: "confirm" })}
                          className="flex-1 px-2 py-1 rounded border border-edge text-[9px] text-gray-400 hover:text-gray-200 hover:bg-panel2"
                          title="Restore this snapshot"
                          aria-label={`Restore ${v.label}`}
                        >
                          ↺ Restore
                        </button>
                        <button
                          onClick={() => setDeleteId(v.id)}
                          className="px-2 py-1 rounded border border-edge text-[9px] text-red-400 hover:text-red-300 hover:bg-red-950/30"
                          title="Delete snapshot"
                          aria-label={`Delete ${v.label}`}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                  {isRestoreTarget && restore?.status === "confirm" && (
                    <div className="px-2.5 pb-2 space-y-1.5">
                      <p className="text-[9px] text-gray-400 leading-snug">
                        Restore will replace all current components with the snapshot contents. Capture a new version first if you want to keep the current state.
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => void handleRestore(v.id)}
                          className="flex-1 px-2 py-1 rounded bg-accent hover:bg-accent2 text-black text-[10px] font-medium"
                        >
                          Confirm Restore
                        </button>
                        <button
                          onClick={() => setRestore(null)}
                          className="flex-1 px-2 py-1 rounded border border-edge text-gray-400 hover:text-gray-200 text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      {versions.length > 0 && (
        <div className="px-2 py-1.5 border-t border-edge/50 flex-shrink-0">
          <button
            onClick={() => void refresh()}
            className="w-full text-[9px] text-gray-600 hover:text-gray-400 py-0.5"
          >
            ↻ Refresh
          </button>
        </div>
      )}
    </div>
  );
}
