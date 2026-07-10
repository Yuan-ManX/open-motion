import { useState, useCallback, useRef, useEffect } from "react";

interface GraphState {
  id: string;
  name: string;
  x: number;
  y: number;
  componentCount: number;
  isActive: boolean;
}

interface GraphTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  trigger: string;
  durationMs: number;
}

interface Props {
  states: GraphState[];
  transitions: GraphTransition[];
  activeStateId: string | null;
  onSelectState: (id: string) => void;
  onRepositionState: (id: string, x: number, y: number) => void;
  onDeleteState: (id: string) => void;
  width?: number;
  height?: number;
}

const NODE_W = 90;
const NODE_H = 36;
const PADDING = 20;

export function StateMachineGraph({
  states,
  transitions,
  activeStateId,
  onSelectState,
  onRepositionState,
  onDeleteState,
  width = 320,
  height = 220,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, state: GraphState) => {
      e.stopPropagation();
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      setDragging({ id: state.id, offsetX: mx - state.x, offsetY: my - state.y });
    },
    [width, height],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      const x = Math.max(PADDING, Math.min(width - NODE_W - PADDING, mx - dragging.offsetX));
      const y = Math.max(PADDING, Math.min(height - NODE_H - PADDING, my - dragging.offsetY));
      onRepositionState(dragging.id, x, y);
    };

    const onMouseUp = () => {
      setDragging(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, width, height, onRepositionState]);

  const findState = (id: string) => states.find((s) => s.id === id);

  const edgePath = (t: GraphTransition): string => {
    const from = findState(t.fromStateId);
    const to = findState(t.toStateId);
    if (!from || !to) return "";
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y + NODE_H / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const isSelf = t.fromStateId === t.toStateId;
    if (isSelf) {
      const cx = x1 + 35;
      const cy = y1 - 25;
      return `M ${x1} ${y1} Q ${cx} ${cy} ${x1 + 5} ${y1 + 5}`;
    }
    const ux = dx / dist;
    const uy = dy / dist;
    const sx = x1 + ux * (NODE_W / 2);
    const sy = y1 + uy * (NODE_H / 2);
    const ex = x2 - ux * (NODE_W / 2);
    const ey = y2 - uy * (NODE_H / 2);
    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2 - 15;
    return `M ${sx} ${sy} Q ${midX} ${midY} ${ex} ${ey}`;
  };

  const arrowPos = (t: GraphTransition): { x: number; y: number; angle: number } => {
    const from = findState(t.fromStateId);
    const to = findState(t.toStateId);
    if (!from || !to) return { x: 0, y: 0, angle: 0 };
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y + NODE_H / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const ex = x2 - ux * (NODE_W / 2);
    const ey = y2 - uy * (NODE_H / 2);
    return { x: ex, y: ey, angle: Math.atan2(uy, ux) * (180 / Math.PI) };
  };

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="bg-panel2 rounded border border-edge"
      style={{ cursor: dragging ? "grabbing" : "default" }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.6)" />
        </marker>
      </defs>

      {/* Edges */}
      {transitions.map((t) => {
        const path = edgePath(t);
        if (!path) return null;
        const arrow = arrowPos(t);
        const fromState = findState(t.fromStateId);
        const toState = findState(t.toStateId);
        const midX = fromState && toState ? (fromState.x + toState.x) / 2 + NODE_W / 2 : 0;
        const midY = fromState && toState ? (fromState.y + toState.y) / 2 + NODE_H / 2 - 15 : 0;
        return (
          <g key={t.id}>
            <path
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
              markerEnd="url(#arrowhead)"
            />
            <text
              x={midX}
              y={midY}
              textAnchor="middle"
              className="fill-gray-600"
              style={{ fontSize: 8, fontFamily: "monospace" }}
            >
              {t.trigger}
            </text>
            <polygon
              points="0,-3 6,0 0,3"
              fill="rgba(255,255,255,0.6)"
              transform={`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.angle})`}
            />
          </g>
        );
      })}

      {/* Nodes */}
      {states.map((state) => {
        const isActive = state.id === activeStateId;
        const isHovered = state.id === hoveredNode;
        return (
          <g
            key={state.id}
            transform={`translate(${state.x}, ${state.y})`}
            onMouseDown={(e) => handleNodeMouseDown(e, state)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectState(state.id);
            }}
            onMouseEnter={() => setHoveredNode(state.id)}
            onMouseLeave={() => setHoveredNode(null)}
            style={{ cursor: dragging?.id === state.id ? "grabbing" : "grab" }}
          >
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={6}
              fill={isActive ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}
              stroke={isActive ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)"}
              strokeWidth={isActive ? 1.5 : 1}
            />
            <text
              x={NODE_W / 2}
              y={NODE_H / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-gray-200"
              style={{ fontSize: 10, pointerEvents: "none", userSelect: "none" }}
            >
              {state.name.length > 12 ? state.name.slice(0, 11) + "…" : state.name}
            </text>
            <text
              x={NODE_W - 4}
              y={NODE_H - 3}
              textAnchor="end"
              className="fill-gray-600"
              style={{ fontSize: 7, fontFamily: "monospace", pointerEvents: "none", userSelect: "none" }}
            >
              {state.componentCount}L
            </text>
            {isHovered && (
              <text
                x={NODE_W - 6}
                y={10}
                textAnchor="end"
                className="fill-red-400"
                style={{ fontSize: 11, cursor: "pointer", pointerEvents: "auto" }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDeleteState(state.id);
                }}
              >
                ×
              </text>
            )}
          </g>
        );
      })}

      {states.length === 0 && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          className="fill-gray-700"
          style={{ fontSize: 10 }}
        >
          Capture a state to populate the graph
        </text>
      )}
    </svg>
  );
}
