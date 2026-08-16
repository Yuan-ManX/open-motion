import React, { useEffect, useMemo, useRef, useState } from "react";

export interface PresencePeer {
  peerId: string;
  name: string;
  color: string;
  role: "designer" | "reviewer" | "agent" | "system";
  x: number; // canvas x in px (viewport coords)
  y: number; // canvas y
  lastSeen: number;
  selection?: string[]; // component ids
  tool?: "select" | "move" | "scale" | "draw" | "text";
  heartbeat?: string; // short status text
}

interface Props {
  selfId: string;
  peers: PresencePeer[];
  canvasRef?: React.RefObject<HTMLElement>;
  onLocalPointer?: (x: number, y: number) => void;
  onSetTool?: (tool: PresencePeer["tool"]) => void;
  localTool?: PresencePeer["tool"];
  localSelection?: string[];
  localHeartbeat?: string;
}

// Deterministic synthetic peer roster used whenever no external collaboration
// transport is wired up. Lets the UI exercise the full multi-cursor rendering
// path without a live backend connection.
function buildSyntheticPeers(selfId: string): PresencePeer[] {
  const palette = ["#F97316", "#22C55E", "#38BDF8", "#F472B6", "#A78BFA"];
  const names = ["Aria (Agent)", "Milo (Reviewer)", "Jin (Designer)", "Raf (System)"];
  const tools: Array<PresencePeer["tool"]> = ["select", "move", "scale", "text"];
  const roles: PresencePeer["role"][] = ["agent", "reviewer", "designer", "system"];
  return names.slice(0, 3).map((name, i) => ({
    peerId: `${selfId}-peer-${i + 1}`,
    name,
    color: palette[i % palette.length],
    role: roles[i % roles.length],
    x: 80 + i * 120 + ((Date.now() / 100) % 40),
    y: 120 + ((i * 70) % 160) + ((Date.now() / 120 + i) % 30),
    lastSeen: Date.now() - i * 1500,
    tool: tools[i % tools.length],
    selection: i === 0 ? [] : undefined,
    heartbeat: i === 0 ? "Crafting curve hints…" : i === 1 ? "Reviewing accessibility…" : "Adjusting grid snap",
  }));
}

// Renders a floating real-time collaboration overlay. Peers are shown as
// named telepointer cursors with their selection and current tool; the
// right-hand rail lists active participants and recent telepresence events.
export const RealtimeCollabPanel: React.FC<Props> = ({
  selfId,
  peers: incomingPeers,
  canvasRef,
  onLocalPointer,
  onSetTool,
  localTool = "select",
  localSelection = [],
  localHeartbeat = "Idle",
}) => {
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const loop = () => {
      setTick((t) => (t + 1) % 1000000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Fall back to synthetic peers for demo/simulation mode.
  const peers = useMemo(() => {
    if (incomingPeers?.length > 0) return incomingPeers;
    return buildSyntheticPeers(selfId);
  }, [incomingPeers, selfId]);

  // Simulated gentle motion for synthetic peers so the overlay feels alive.
  const animatedPeers = useMemo(
    () =>
      peers.map((p) => ({
        ...p,
        x: p.x + Math.sin((tick + p.peerId.charCodeAt(0)) / 40) * 14,
        y: p.y + Math.cos((tick + p.peerId.charCodeAt(1)) / 55) * 10,
      })),
    [peers, tick],
  );

  useEffect(() => {
    if (!canvasRef?.current) return;
    const el = canvasRef.current;
    const handler = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      onLocalPointer?.(ev.clientX - rect.left, ev.clientY - rect.top);
    };
    el.addEventListener("pointermove", handler);
    return () => el.removeEventListener("pointermove", handler);
  }, [canvasRef, onLocalPointer]);

  const tools: Array<PresencePeer["tool"]> = ["select", "move", "scale", "draw", "text"];

  return (
    <div className="flex h-full flex-col gap-3 text-sm">
      <header className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">Collab Presence</h3>
        <span
          className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {animatedPeers.length + 1} online
        </span>
      </header>

      <section className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-2">
        <div className="relative h-40 overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 to-slate-800">
          {/* Simulated canvas grid */}
          <svg className="absolute inset-0 h-full w-full opacity-30" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="mini-grid" width="12" height="12" patternUnits="userSpaceOnUse">
                <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#475569" strokeWidth="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mini-grid)" />
          </svg>

          {/* Self cursor */}
          <div className="absolute left-1/2 top-1/2">
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ transform: "translate(-2px, -2px)" }}>
              <path d="M1 1 L1 14 L5 11 L7 16 L10 15 L8 10 L13 10 Z" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="1" />
            </svg>
            <span className="ml-3 rounded-md bg-sky-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              You · {localTool}
            </span>
          </div>

          {/* Peer cursors */}
          {animatedPeers.map((p) => (
            <div
              key={p.peerId}
              className="absolute"
              style={{ left: `${(p.x % 100) + 5}%`, top: `${(p.y % 100) + 5}%` }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18">
                <path d="M1 1 L1 14 L5 11 L7 16 L10 15 L8 10 L13 10 Z" fill={p.color} stroke="#FFFFFF" strokeWidth="1" />
              </svg>
              <span
                className="ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: p.color }}
              >
                {p.name.split(" ")[0]} · {p.tool}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Active participants
        </h4>
        <ul className="space-y-2 text-xs">
          <li className="flex items-center justify-between rounded-md bg-slate-900/60 px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="text-slate-200">You</span>
              <span className="rounded bg-slate-700 px-1 py-0.5 text-[9px] text-slate-300">designer</span>
            </div>
            <span className="truncate text-[10px] text-slate-400">
              sel {localSelection.length || 0} · {localHeartbeat}
            </span>
          </li>
          {animatedPeers.map((p) => (
            <li key={p.peerId} className="flex items-center justify-between rounded-md bg-slate-900/40 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-slate-200">{p.name}</span>
                <span className="rounded bg-slate-700 px-1 py-0.5 text-[9px] text-slate-300">{p.role}</span>
              </div>
              <span className="truncate text-[10px] text-slate-400">
                {p.heartbeat ?? "idle"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Your tool
        </h4>
        <div className="grid grid-cols-5 gap-1">
          {tools.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onSetTool?.(t)}
              className={`rounded-md px-1 py-1.5 text-[11px] capitalize transition ${
                localTool === t
                  ? "bg-sky-600 text-white"
                  : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
