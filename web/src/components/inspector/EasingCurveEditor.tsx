import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  bezier: [number, number, number, number];
  onChange: (bezier: [number, number, number, number]) => void;
}

const SIZE = 180;
const PADDING = 16;
const PLOT = SIZE - PADDING * 2;

function toCanvas(x: number, y: number): [number, number] {
  return [PADDING + x * PLOT, PADDING + (1 - y) * PLOT];
}

function fromCanvas(cx: number, cy: number): [number, number] {
  return [
    Math.max(0, Math.min(1, (cx - PADDING) / PLOT)),
    Math.max(0, Math.min(1, 1 - (cy - PADDING) / PLOT)),
  ];
}

function bezierPath(p1x: number, p1y: number, p2x: number, p2y: number): string {
  const [sx, sy] = toCanvas(0, 0);
  const [ex, ey] = toCanvas(1, 1);
  const [c1x, c1y] = toCanvas(p1x, p1y);
  const [c2x, c2y] = toCanvas(p2x, p2y);
  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`;
}

export function EasingCurveEditor({ bezier, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<0 | 1 | null>(null);
  const [previewT, setPreviewT] = useState<number | null>(null);

  const [p1x, p1y, p2x, p2y] = bezier;
  const [c1x, c1y] = toCanvas(p1x, p1y);
  const [c2x, c2y] = toCanvas(p2x, p2y);

  const handlePointerDown = useCallback((e: React.PointerEvent, point: 0 | 1) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(point);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging === null || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const [x, y] = fromCanvas(cx, cy);
      if (dragging === 0) {
        onChange([Number(x.toFixed(3)), Number(y.toFixed(3)), p2x, p2y]);
      } else {
        onChange([p1x, p1y, Number(x.toFixed(3)), Number(y.toFixed(3))]);
      }
    },
    [dragging, onChange, p1x, p1y, p2x, p2y],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleScrub = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const t = Math.max(0, Math.min(1, (cx - PADDING) / PLOT));
    setPreviewT(t);
  }, []);

  useEffect(() => {
    if (previewT === null) return;
    const timer = setTimeout(() => setPreviewT(null), 1500);
    return () => clearTimeout(timer);
  }, [previewT]);

  const previewDot =
    previewT !== null
      ? (() => {
          const u = 1 - previewT;
          const x =
            3 * u * u * previewT * p1x + 3 * u * previewT * previewT * p2x + previewT * previewT * previewT;
          const y =
            3 * u * u * previewT * p1y + 3 * u * previewT * previewT * p2y + previewT * previewT * previewT;
          return toCanvas(x, y);
        })()
      : null;

  return (
    <div className="mt-2 flex flex-col items-center gap-2">
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        className="rounded-lg border border-edge bg-panel2 cursor-crosshair touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseMove={handleScrub}
        onMouseLeave={() => setPreviewT(null)}
      >
        <defs>
          <pattern id="grid" width={PLOT / 4} height={PLOT / 4} patternUnits="userSpaceOnUse">
            <path d={`M ${PLOT / 4} 0 L 0 0 0 ${PLOT / 4}`} fill="none" stroke="#222a3a" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x={PADDING} y={PADDING} width={PLOT} height={PLOT} fill="url(#grid)" />

        <line x1={PADDING} y1={PADDING + PLOT} x2={PADDING + PLOT} y2={PADDING} stroke="#2d3850" strokeWidth="0.5" strokeDasharray="2 2" />

        <line x1={c1x} y1={c1y} x2={PADDING} y2={PADDING + PLOT} stroke="#3d4860" strokeWidth="1" />
        <line x1={c2x} y1={c2y} x2={PADDING + PLOT} y2={PADDING} stroke="#3d4860" strokeWidth="1" />

        <path d={bezierPath(p1x, p1y, p2x, p2y)} fill="none" stroke="#6366f1" strokeWidth="2" />

        {previewDot && (
          <>
            <line
              x1={previewDot[0]}
              y1={PADDING}
              x2={previewDot[0]}
              y2={PADDING + PLOT}
              stroke="#8b5cf6"
              strokeWidth="0.5"
              strokeDasharray="1 2"
              opacity={0.5}
            />
            <circle cx={previewDot[0]} cy={previewDot[1]} r="4" fill="#8b5cf6" opacity={0.8} />
          </>
        )}

        <circle
          cx={c1x}
          cy={c1y}
          r="6"
          fill="#6366f1"
          stroke="#fff"
          strokeWidth="1.5"
          className="cursor-grab"
          onPointerDown={(e) => handlePointerDown(e, 0)}
        />
        <circle
          cx={c2x}
          cy={c2y}
          r="6"
          fill="#8b5cf6"
          stroke="#fff"
          strokeWidth="1.5"
          className="cursor-grab"
          onPointerDown={(e) => handlePointerDown(e, 1)}
        />
      </svg>
      <div className="flex gap-2 text-[10px] font-mono text-gray-500">
        <span className={dragging === 0 ? "text-accent" : ""}>p1({p1x.toFixed(2)}, {p1y.toFixed(2)})</span>
        <span className={dragging === 1 ? "text-accent2" : ""}>p2({p2x.toFixed(2)}, {p2y.toFixed(2)})</span>
      </div>
    </div>
  );
}
