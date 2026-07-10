import { useCallback, useEffect, useRef, useState } from "react";

interface EasingCurveEditorProps {
  /** Current bezier control points [x1, y1, x2, y2]. */
  bezier: [number, number, number, number];
  /** Callback fired when the user drags a control point. */
  onChange: (value: [number, number, number, number]) => void;
}

const SVG_SIZE = 160;
const PADDING = 16;
const PLOT = SVG_SIZE - PADDING * 2;

/**
 * Interactive cubic-bezier easing curve editor. The user drags two control
 * point handles to reshape the easing curve. Start (0,0) and end (1,1) are
 * fixed. Dragging y-values beyond 0–1 creates wind-up/overshoot effects.
 */
export function EasingCurveEditor({ bezier, onChange }: EasingCurveEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<null | "p1" | "p2">(null);

  const [x1, y1, x2, y2] = bezier;

  const toSvg = useCallback((px: number, py: number) => ({
    x: PADDING + px * PLOT,
    y: PADDING + (1 - py) * PLOT,
  }), []);

  const fromSvg = useCallback((sx: number, sy: number) => ({
    px: Math.max(-0.2, Math.min(1.2, (sx - PADDING) / PLOT)),
    py: Math.max(-0.2, Math.min(1.2, 1 - (sy - PADDING) / PLOT)),
  }), []);

  const p1 = toSvg(x1, y1);
  const p2 = toSvg(x2, y2);
  const start = toSvg(0, 0);
  const end = toSvg(1, 1);

  const handleMouseDown = useCallback((point: "p1" | "p2") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(point);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { px, py } = fromSvg(sx, sy);

      if (dragging === "p1") {
        onChange([px, py, x2, y2]);
      } else {
        onChange([x1, y1, px, py]);
      }
    };

    const onMouseUp = () => {
      setDragging(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, x1, y1, x2, y2, onChange, fromSvg]);

  // Generate the bezier path for visualization
  const bezierPath = `M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`;

  return (
    <div className="bg-panel2 border border-edge rounded-lg p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">Easing Curve</span>
        <span className="text-[10px] text-gray-600 font-mono">
          {x1.toFixed(2)}, {y1.toFixed(2)}, {x2.toFixed(2)}, {y2.toFixed(2)}
        </span>
      </div>
      <svg
        ref={svgRef}
        width={SVG_SIZE}
        height={SVG_SIZE}
        className="block mx-auto"
        style={{ cursor: dragging ? "grabbing" : "default" }}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const pos = toSvg(t, t);
          return (
            <g key={t}>
              <line x1={pos.x} y1={PADDING} x2={pos.x} y2={SVG_SIZE - PADDING} stroke="#1a1a1a" strokeWidth={0.5} />
              <line x1={PADDING} y1={pos.y} x2={SVG_SIZE - PADDING} y2={pos.y} stroke="#1a1a1a" strokeWidth={0.5} />
            </g>
          );
        })}

        {/* Border */}
        <rect
          x={PADDING}
          y={PADDING}
          width={PLOT}
          height={PLOT}
          fill="none"
          stroke="#262626"
          strokeWidth={1}
        />

        {/* Reference diagonal (linear) */}
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#262626"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* Handle lines */}
        <line x1={start.x} y1={start.y} x2={p1.x} y2={p1.y} stroke="#404040" strokeWidth={1} />
        <line x1={end.x} y1={end.y} x2={p2.x} y2={p2.y} stroke="#404040" strokeWidth={1} />

        {/* Bezier curve */}
        <path d={bezierPath} fill="none" stroke="#ffffff" strokeWidth={2} />

        {/* Start and end points */}
        <circle cx={start.x} cy={start.y} r={3} fill="#404040" />
        <circle cx={end.x} cy={end.y} r={3} fill="#404040" />

        {/* Control point handles */}
        <circle
          cx={p1.x}
          cy={p1.y}
          r={5}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={1}
          className="cursor-grab hover:r-6"
          onMouseDown={handleMouseDown("p1")}
        />
        <circle
          cx={p2.x}
          cy={p2.y}
          r={5}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={1}
          className="cursor-grab hover:r-6"
          onMouseDown={handleMouseDown("p2")}
        />
      </svg>
      <div className="flex items-center justify-between mt-1.5">
        <button
          onClick={() => onChange([0.4, 0, 0.2, 1])}
          className="text-[10px] text-gray-500 hover:text-accent"
        >
          Smooth
        </button>
        <button
          onClick={() => onChange([0.68, -0.55, 0.265, 1.55])}
          className="text-[10px] text-gray-500 hover:text-accent"
        >
          Bounce
        </button>
        <button
          onClick={() => onChange([0, 0, 1, 1])}
          className="text-[10px] text-gray-500 hover:text-accent"
        >
          Linear
        </button>
        <button
          onClick={() => onChange([0.5, 1.5, 0.5, -0.5])}
          className="text-[10px] text-gray-500 hover:text-accent"
        >
          Spring
        </button>
      </div>
    </div>
  );
}
