import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import { buildMotionDna, diffDna } from "../../motion/dna.js";
import type { MotionComponent } from "@openmotion/shared";

interface VariantEntry {
  id: string;
  label: string;
  component: MotionComponent;
  dna: string;
}

/**
 * Side-by-side variant comparison with DNA diff visualization. Lets the user
 * pick two components (or a component and a generated variant) and compare
 * their Motion DNA signatures segment by segment.
 */
export function VariantComparison() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");

  const entries: VariantEntry[] = useMemo(() => {
    return components.map((c) => ({
      id: c.id,
      label: c.name,
      component: c,
      dna: buildMotionDna(c),
    }));
  }, [components]);

  const left = entries.find((e) => e.id === leftId) ?? null;
  const right = entries.find((e) => e.id === rightId) ?? null;

  const diff = left && right ? diffDna(left.dna, right.dna) : null;

  const dnaSegments = useMemo(() => {
    if (!left || !right) return [];
    const lp = left.dna.split("|");
    const rp = right.dna.split("|");
    const labels = ["Easing", "Duration", "Loop", "Properties", "Direction"];
    return labels.map((label, i) => ({
      label,
      left: lp[i] ?? "—",
      right: rp[i] ?? "—",
      changed: lp[i] !== rp[i],
    }));
  }, [left, right]);

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  const send = useChatStore.getState().send;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
          Variant Comparison
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {components.length < 2 ? (
          <div className="p-3 space-y-2">
            <div className="px-4 py-6 text-center text-[10px] text-gray-600">
              Add at least two components to compare their Motion DNA side by side.
            </div>
            <button
              onClick={() => send(projectId, "Create a variation of the first component with a different easing")}
              className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
              title="Generate a variant via the Agent"
            >
              Generate a Variant
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Selectors */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] font-mono uppercase text-gray-600 block mb-1">A</label>
                <select
                  value={leftId}
                  onChange={(e) => setLeftId(e.target.value)}
                  className="w-full bg-panel2 border border-edge text-[10px] text-gray-300 px-1.5 py-1 focus:outline-none focus:border-gray-500"
                >
                  <option value="">— select —</option>
                  {entries.map((e) => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[8px] font-mono uppercase text-gray-600 block mb-1">B</label>
                <select
                  value={rightId}
                  onChange={(e) => setRightId(e.target.value)}
                  className="w-full bg-panel2 border border-edge text-[10px] text-gray-300 px-1.5 py-1 focus:outline-none focus:border-gray-500"
                >
                  <option value="">— select —</option>
                  {entries.map((e) => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto-pick first two */}
            {(!leftId || !rightId) && (
              <button
                onClick={() => {
                  if (entries.length >= 2) {
                    setLeftId(entries[0].id);
                    setRightId(entries[1].id);
                  }
                }}
                className="w-full px-2 py-1 text-[9px] text-gray-500 border border-edge hover:text-gray-300 hover:border-gray-500 transition-colors"
                title="Auto-select the first two components"
              >
                Auto-select first two
              </button>
            )}

            {/* DNA comparison */}
            {left && right ? (
              <>
                {diff && (
                  <div className="border border-edge p-2 bg-panel2">
                    <div className="text-[8px] font-mono uppercase text-gray-500 mb-1">DNA Diff</div>
                    <div className="text-[9px] font-mono text-gray-300 break-all">{diff}</div>
                  </div>
                )}

                {/* Segment-by-segment comparison */}
                <div className="border border-edge">
                  <div className="grid grid-cols-3 text-[8px] font-mono uppercase text-gray-600 border-b border-edge">
                    <div className="px-2 py-1">Segment</div>
                    <div className="px-2 py-1">A</div>
                    <div className="px-2 py-1">B</div>
                  </div>
                  {dnaSegments.map((seg) => (
                    <div
                      key={seg.label}
                      className={`grid grid-cols-3 text-[9px] font-mono border-b border-edge last:border-b-0 ${
                        seg.changed ? "bg-panel2" : ""
                      }`}
                    >
                      <div className="px-2 py-1.5 text-gray-500">{seg.label}</div>
                      <div className={`px-2 py-1.5 ${seg.changed ? "text-gray-200" : "text-gray-500"}`}>
                        {seg.left}
                      </div>
                      <div className={`px-2 py-1.5 ${seg.changed ? "text-gray-200" : "text-gray-500"}`}>
                        {seg.right}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Side-by-side details */}
                <div className="grid grid-cols-2 gap-2">
                  <VariantDetail entry={left} sideLabel="A" />
                  <VariantDetail entry={right} sideLabel="B" />
                </div>

                {/* Actions */}
                <div className="space-y-1.5">
                  <button
                    onClick={() => send(projectId, `Create a variation of ${left.component.name} with a different easing and duration`)}
                    className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
                    title="Generate a variant of A via the Agent"
                  >
                    Variant of A
                  </button>
                  <button
                    onClick={() => send(projectId, `Create a variation of ${right.component.name} with different properties and scale`)}
                    className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
                    title="Generate a variant of B via the Agent"
                  >
                    Variant of B
                  </button>
                  <button
                    onClick={() => send(projectId, `Find similar motions to ${left.component.name} across all projects and templates`)}
                    className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
                    title="Search for similar motions via the Agent"
                  >
                    Find Similar to A
                  </button>
                </div>
              </>
            ) : (
              <div className="px-4 py-6 text-center text-[10px] text-gray-600">
                Select two components above to compare their Motion DNA.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VariantDetail({ entry, sideLabel }: { entry: VariantEntry; sideLabel: string }) {
  const { component } = entry;
  const easingName =
    component.easing.type === "preset"
      ? component.easing.name
      : component.easing.type === "bezier"
        ? `bezier(${component.easing.p1.join(",")},${component.easing.p2.join(",")})`
        : `spring(s=${component.easing.stiffness},d=${component.easing.damping})`;

  return (
    <div className="border border-edge p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] font-mono uppercase text-gray-600">Side {sideLabel}</span>
        <span className="text-[8px] font-mono text-gray-500 truncate max-w-[80px]">{component.id}</span>
      </div>
      <div className="text-[10px] text-gray-200 mb-1.5 truncate">{component.name}</div>
      <div className="space-y-0.5 text-[9px] font-mono text-gray-500">
        <div className="flex justify-between">
          <span>easing</span>
          <span className="text-gray-400 truncate ml-2 max-w-[90px]">{easingName}</span>
        </div>
        <div className="flex justify-between">
          <span>duration</span>
          <span className="text-gray-400">{component.durationMs}ms</span>
        </div>
        <div className="flex justify-between">
          <span>delay</span>
          <span className="text-gray-400">{component.delayMs}ms</span>
        </div>
        <div className="flex justify-between">
          <span>loop</span>
          <span className="text-gray-400">{component.iterationCount}</span>
        </div>
        <div className="flex justify-between">
          <span>direction</span>
          <span className="text-gray-400">{component.direction}</span>
        </div>
        <div className="flex justify-between">
          <span>keyframes</span>
          <span className="text-gray-400">{component.keyframes.length}</span>
        </div>
        <div className="flex justify-between">
          <span>trigger</span>
          <span className="text-gray-400">{component.trigger}</span>
        </div>
      </div>
    </div>
  );
}
