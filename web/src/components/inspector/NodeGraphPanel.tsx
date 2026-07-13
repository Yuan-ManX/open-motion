import { useMemo } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import type { MotionComponent } from "@openmotion/shared";

interface GraphNode {
  component: MotionComponent;
  depth: number;
  x: number;
  y: number;
  children: string[];
}

const NODE_W = 180;
const NODE_H = 48;
const H_GAP = 24;
const V_GAP = 12;
const PADDING = 12;

/** Classify easing into a color token matching the TimelineBar DNA scheme. */
function easingColor(comp: MotionComponent): string {
  const e = comp.easing;
  if (!e) return "#525252";
  if (e.type === "preset") {
    const n = e.name;
    if (/bounce|back|elastic|spring/.test(n)) return "#f97316";
    if (/smooth|ease-in-out|ease-out/.test(n)) return "#3b82f6";
    if (/snappy|ease-in/.test(n)) return "#eab308";
    return "#525252";
  }
  if (e.type === "spring") return "#22c55e";
  if (e.type === "bezier") return "#a855f7";
  return "#525252";
}

/**
 * Node graph composition view — renders components as a tree of nodes connected
 * by parent-child edges. Each node shows the component name, easing color bar,
 * and duration. Useful for visualizing rigging hierarchy and composition structure.
 */
export function NodeGraphPanel() {
  const components = useProjectStore((s) => s.components);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);

  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    // Build a parent → children map.
    const childrenMap = new Map<string | null, MotionComponent[]>();
    for (const comp of components) {
      const key = comp.parentId ?? null;
      const list = childrenMap.get(key) ?? [];
      list.push(comp);
      childrenMap.set(key, list);
    }
    // Sort children by orderIndex within each parent group.
    for (const list of childrenMap.values()) {
      list.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    // DFS layout: assign depth and y-position by traversal order.
    const nodes: GraphNode[] = [];
    let yCursor = PADDING;
    const place = (parentId: string | null, depth: number) => {
      const children = childrenMap.get(parentId) ?? [];
      for (const child of children) {
        const grandkids = childrenMap.get(child.id) ?? [];
        nodes.push({
          component: child,
          depth,
          x: PADDING + depth * (NODE_W + H_GAP),
          y: yCursor,
          children: grandkids.map((g) => g.id),
        });
        yCursor += NODE_H + V_GAP;
        if (grandkids.length > 0) {
          place(child.id, depth + 1);
        }
      }
    };
    place(null, 0);

    // Build edges from parent to child.
    const edges: { from: GraphNode; to: GraphNode }[] = [];
    for (const node of nodes) {
      for (const childId of node.children) {
        const childNode = nodes.find((n) => n.component.id === childId);
        if (childNode) edges.push({ from: node, to: childNode });
      }
    }

    const maxDepth = nodes.reduce((max, n) => Math.max(max, n.depth), 0);
    const svgWidth = PADDING * 2 + (maxDepth + 1) * NODE_W + maxDepth * H_GAP;
    const svgHeight = Math.max(yCursor, 100);
    return { nodes, edges, svgWidth, svgHeight };
  }, [components]);

  if (components.length === 0) {
    return (
      <div className="p-4 text-center text-[11px] text-gray-600">
        No components to graph. Add layers to see the composition tree.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-panel">
      <svg
        width={svgWidth}
        height={svgHeight}
        className="block"
        style={{ minWidth: "100%" }}
      >
        {/* Edges (parent → child curves) */}
        {edges.map((edge, i) => {
          const x1 = edge.from.x + NODE_W;
          const y1 = edge.from.y + NODE_H / 2;
          const x2 = edge.to.x;
          const y2 = edge.to.y + NODE_H / 2;
          const midX = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="#404040"
              strokeWidth={1}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const comp = node.component;
          const isSelected = comp.id === selectedId;
          const color = easingColor(comp);
          const easingLabel =
            comp.easing?.type === "preset"
              ? comp.easing.name
              : comp.easing?.type ?? "linear";
          return (
            <g
              key={comp.id}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={(e) => {
                e.stopPropagation();
                selectComponent(comp.id);
              }}
              style={{ cursor: "pointer" }}
            >
              {/* Node background */}
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={4}
                fill={isSelected ? "#262626" : "#1a1a1a"}
                stroke={isSelected ? "#ffffff" : "#333333"}
                strokeWidth={isSelected ? 1.5 : 1}
              />
              {/* Easing color bar (left edge) */}
              <rect width={3} height={NODE_H} rx={1.5} fill={color} />
              {/* Component name */}
              <text
                x={10}
                y={18}
                fill={isSelected ? "#ffffff" : "#d4d4d4"}
                style={{ fontSize: 11, fontWeight: 600, fontFamily: "monospace" }}
              >
                {comp.name.length > 20 ? comp.name.slice(0, 19) + "…" : comp.name}
              </text>
              {/* Easing + duration */}
              <text
                x={10}
                y={34}
                fill="#737373"
                style={{ fontSize: 9, fontFamily: "monospace" }}
              >
                {easingLabel} · {comp.durationMs}ms
              </text>
              {/* Child count badge */}
              {node.children.length > 0 && (
                <g>
                  <circle
                    cx={NODE_W - 12}
                    cy={12}
                    r={7}
                    fill="#333333"
                    stroke="#525252"
                    strokeWidth={0.5}
                  />
                  <text
                    x={NODE_W - 12}
                    y={15}
                    textAnchor="middle"
                    fill="#a3a3a3"
                    style={{ fontSize: 8, fontFamily: "monospace" }}
                  >
                    {node.children.length}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
