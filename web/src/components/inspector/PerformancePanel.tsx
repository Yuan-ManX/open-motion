import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";

export function PerformancePanel() {
  const projectId = useProjectStore((s) => s.projectId);

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Performance Budget
          </span>
        </div>
        <button
          onClick={() => useChatStore.getState().send(projectId, "Check the performance and frame budget of all motion in this project")}
          className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
          title="Run performance check via the Agent"
        >
          Run Performance Check
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-6 text-center text-[10px] text-gray-600">
          Click "Run Performance Check" to analyze paint complexity, layout
          triggers, simultaneous animations, and estimated frame time.
        </div>

        <div className="px-3 pb-3 space-y-2">
          <div className="border border-edge p-2">
            <div className="text-[8px] font-mono uppercase text-gray-600 mb-1">What it tracks</div>
            <ul className="text-[9px] text-gray-500 space-y-1">
              <li><span className="text-gray-400">▣</span> Paint — blur, shadow, gradient cost</li>
              <li><span className="text-gray-400">↔</span> Layout — reflow-triggering properties</li>
              <li><span className="text-gray-400">◈</span> Composite — transform/opacity (cheap)</li>
              <li><span className="text-gray-400">◑</span> Simultaneous — concurrent animation count</li>
              <li><span className="text-gray-400">⏱</span> Frame time — estimated ms vs 16ms budget</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
