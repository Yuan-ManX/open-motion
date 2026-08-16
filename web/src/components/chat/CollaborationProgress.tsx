import { useState, useCallback, useRef } from "react";
import { streamCollaboration, type CollaborationStreamEvent } from "../../api/endpoints.js";
import type { CollaborationPlan, CollaborationResult } from "../../api/endpoints.js";

interface ModuleProgress {
  moduleId: string;
  moduleName: string;
  status: "pending" | "running" | "done" | "error";
  confidence?: number;
  notes?: string;
  error?: string;
}

interface CollaborationProgressProps {
  /** Called when collaboration completes with a result. */
  onComplete?: (result: CollaborationResult) => void;
  /** Called when an error occurs. */
  onError?: (error: string) => void;
}

/**
 * Live collaboration progress widget — shows real-time module execution
 * status during a multi-module motion synthesis run.
 */
export function CollaborationProgress({ onComplete, onError }: CollaborationProgressProps) {
  const [active, setActive] = useState(false);
  const [plan, setPlan] = useState<CollaborationPlan | null>(null);
  const [modules, setModules] = useState<ModuleProgress[]>([]);
  const [phase, setPhase] = useState<"idle" | "planning" | "executing" | "merging" | "done" | "error">("idle");
  const [conflictResolutions, setConflictResolutions] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const handleEvent = useCallback(
    (event: CollaborationStreamEvent) => {
      switch (event.type) {
        case "plan":
          setPlan(event.plan);
          setModules(
            event.plan.modules.map((m) => ({
              moduleId: m.id,
              moduleName: m.name,
              status: "pending" as const,
            })),
          );
          setPhase("executing");
          break;
        case "module_start":
          setModules((prev) =>
            prev.map((m) =>
              m.moduleId === event.moduleId
                ? { ...m, status: "running" as const }
                : m,
            ),
          );
          break;
        case "module_done":
          setModules((prev) =>
            prev.map((m) =>
              m.moduleId === event.moduleId
                ? {
                    ...m,
                    status: "done" as const,
                    confidence: event.confidence,
                    notes: event.notes,
                  }
                : m,
            ),
          );
          break;
        case "module_error":
          setModules((prev) =>
            prev.map((m) =>
              m.moduleId === event.moduleId
                ? { ...m, status: "error" as const, error: event.error }
                : m,
            ),
          );
          break;
        case "merge_start":
          setPhase("merging");
          break;
        case "merge_done":
          setConflictResolutions(event.conflictResolutions);
          break;
        case "done":
          setPhase("done");
          setActive(false);
          onComplete?.(event.result);
          break;
        case "error":
          setPhase("error");
          setActive(false);
          onError?.(event.message);
          break;
      }
    },
    [onComplete, onError],
  );

  const run = useCallback(
    (request: string) => {
      if (active) return;
      setActive(true);
      setPhase("planning");
      setPlan(null);
      setModules([]);
      setConflictResolutions([]);

      const controller = new AbortController();
      abortRef.current = controller;

      streamCollaboration(request, handleEvent, controller.signal).catch((err) => {
        setPhase("error");
        setActive(false);
        onError?.(err instanceof Error ? err.message : String(err));
      });
    },
    [active, handleEvent, onError],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setActive(false);
    setPhase("idle");
  }, []);

  const doneCount = modules.filter((m) => m.status === "done").length;
  const totalCount = modules.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  if (phase === "idle") {
    return (
      <div className="rounded-lg border border-edge bg-panel2/50 p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Describe a motion for multi-module collaboration..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                run(e.currentTarget.value.trim());
                e.currentTarget.value = "";
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>(
                "input[placeholder*='multi-module']",
              );
              if (input?.value.trim()) {
                run(input.value.trim());
                input.value = "";
              }
            }}
            className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs text-white transition-colors"
          >
            Collaborate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-edge bg-panel2/50 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">
            {phase === "planning" && "Planning collaboration..."}
            {phase === "executing" && `Executing ${doneCount}/${totalCount} modules`}
            {phase === "merging" && "Merging results with consensus voting..."}
            {phase === "done" && "Collaboration complete"}
            {phase === "error" && "Collaboration failed"}
          </span>
          {phase === "executing" && (
            <span className="text-xs text-gray-500">
              {progress.toFixed(0)}%
            </span>
          )}
        </div>
        {active && (
          <button
            onClick={cancel}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress bar */}
      {(phase === "executing" || phase === "merging") && (
        <div className="h-1 bg-edge rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-300 ease-out"
            style={{ width: `${phase === "merging" ? 100 : progress}%` }}
          />
        </div>
      )}

      {/* Module list */}
      {modules.length > 0 && (
        <div className="space-y-1">
          {modules.map((m) => (
            <div
              key={m.moduleId}
              className="flex items-center gap-2 text-xs py-0.5"
            >
              <span className="w-4 text-center">
                {m.status === "pending" && (
                  <span className="text-gray-600">○</span>
                )}
                {m.status === "running" && (
                  <span className="text-indigo-400 animate-pulse">◉</span>
                )}
                {m.status === "done" && (
                  <span className="text-green-400">✓</span>
                )}
                {m.status === "error" && (
                  <span className="text-red-400">✗</span>
                )}
              </span>
              <span className="text-gray-300 flex-1 truncate">
                {m.moduleName}
              </span>
              {m.confidence !== undefined && (
                <span className="text-gray-500">
                  {(m.confidence * 100).toFixed(0)}%
                </span>
              )}
              {m.error && (
                <span className="text-red-400 truncate max-w-32">
                  {m.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Conflict resolutions */}
      {conflictResolutions.length > 0 && (
        <div className="border-t border-edge pt-2 space-y-1">
          <div className="text-xs text-gray-500 font-medium">
            Consensus resolutions:
          </div>
          {conflictResolutions.map((r, i) => (
            <div key={i} className="text-xs text-gray-400 pl-3">
              • {r}
            </div>
          ))}
        </div>
      )}

      {/* Plan summary */}
      {plan && phase === "executing" && (
        <div className="text-xs text-gray-600 border-t border-edge pt-1">
          Pattern: {plan.pattern} · {plan.subTasks.length} sub-tasks
        </div>
      )}
    </div>
  );
}
