import { useState, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";

interface BreakpointPreview {
  breakpoint: {
    name: string;
    maxWidth: number;
    durationScale: number;
    delayScale: number;
    maxKeyframes: number;
    disableLoops: boolean;
    simplifyEasing: boolean;
  };
  changeCount: number;
  estimatedLoadMs: number;
  description: string;
}

interface AdaptationReport {
  changes?: { componentId: string; componentName: string; field: string; oldValue: string; newValue: string; reason: string }[];
  summary?: string;
  reductionLevel?: number;
}

interface ResponsiveCss {
  css?: string;
}

const DEVICE_PRESETS = [
  { id: "desktop", label: "Desktop", width: 1440, icon: "🖥" },
  { id: "tablet", label: "Tablet", width: 1024, icon: "□" },
  { id: "mobile", label: "Mobile", width: 640, icon: "▯" },
  { id: "small", label: "Small", width: 400, icon: "·" },
] as const;

/**
 * Adaptive Motion panel — preview and apply context-aware motion adaptation
 * across viewport breakpoints, performance tiers, and accessibility modes.
 * Offers one-click Agent triggers for responsive CSS generation and full
 * adaptation application.
 */
export function AdaptivePanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const send = useChatStore((s) => s.send);
  const [previews, setPreviews] = useState<BreakpointPreview[] | null>(null);
  const [adaptation, setAdaptation] = useState<AdaptationReport | null>(null);
  const [css, setCss] = useState<ResponsiveCss | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [activeDevice, setActiveDevice] = useState<string>("mobile");

  const runPreview = useCallback(async () => {
    if (!projectId) return;
    setLoading("preview");
    try {
      const resp = await fetch(`/api/projects/${projectId}/chat?stream=false`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ message: "Preview motion adaptations across all breakpoints" }),
      });
      const data = await resp.json();
      if (data.toolResults) {
        for (const tr of data.toolResults) {
          if (tr.tool === "preview_adaptations" && tr.result?.data?.previews) {
            setPreviews(tr.result.data.previews);
          }
        }
      }
    } catch {
      // Offline fallback with local breakpoint estimates
      setPreviews(buildMockPreviews(components.length));
    } finally {
      setLoading(null);
    }
  }, [projectId, components.length]);

  const runAdapt = useCallback(async (device: string) => {
    if (!projectId) return;
    setLoading("adapt");
    try {
      const resp = await fetch(`/api/projects/${projectId}/chat?stream=false`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ message: `Adapt motion for ${device}` }),
      });
      const data = await resp.json();
      if (data.toolResults) {
        for (const tr of data.toolResults) {
          if (tr.tool === "adapt_motion" && tr.result?.data) {
            setAdaptation(tr.result.data);
          }
        }
      }
    } catch {
      setAdaptation(buildMockAdaptation(device, components.length));
    } finally {
      setLoading(null);
    }
  }, [projectId, components.length]);

  const runCss = useCallback(async () => {
    if (!projectId) return;
    setLoading("css");
    try {
      const resp = await fetch(`/api/projects/${projectId}/chat?stream=false`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ message: "Generate responsive CSS for this motion project" }),
      });
      const data = await resp.json();
      if (data.toolResults) {
        for (const tr of data.toolResults) {
          if (tr.tool === "generate_responsive_css" && tr.result?.data) {
            setCss(tr.result.data);
          }
        }
      }
    } catch {
      setCss({ css: buildMockCss() });
    } finally {
      setLoading(null);
    }
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        Open a project to adapt motion.
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        Add components to adapt motion.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto text-xs text-gray-300">
      <div className="px-3 py-2 border-b border-edge">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Adaptive Motion</h3>
      </div>

      {/* Device presets */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Target Device</div>
        <div className="grid grid-cols-4 gap-1">
          {DEVICE_PRESETS.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDevice(d.id)}
              className={`flex flex-col items-center gap-0.5 py-1.5 border transition-colors ${
                activeDevice === d.id
                  ? "border-accent bg-panel2 text-gray-100"
                  : "border-edge text-gray-500 hover:text-gray-300"
              }`}
              title={`${d.label} (${d.width}px)`}
            >
              <span className="text-xs">{d.icon}</span>
              <span className="text-[8px]">{d.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => runAdapt(activeDevice)}
          disabled={loading === "adapt"}
          className="w-full mt-1.5 px-2 py-1.5 text-[10px] bg-panel2 hover:bg-panel3 border border-edge text-gray-200 disabled:opacity-40"
        >
          {loading === "adapt" ? "Adapting..." : `Adapt for ${activeDevice}`}
        </button>
      </div>

      {/* Adaptation result */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Adaptation Result</div>
        {adaptation ? (
          <div className="space-y-1">
            <div className="text-[10px] text-gray-200">{adaptation.summary}</div>
            <div className="flex gap-2">
              <span className="text-gray-500">Reduction:</span>
              <span className="text-gray-200">{Math.round((adaptation.reductionLevel ?? 0) * 100)}%</span>
            </div>
            {adaptation.changes && adaptation.changes.length > 0 && (
              <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                {adaptation.changes.slice(0, 12).map((c, i) => (
                  <div key={i} className="text-[9px] text-gray-500 leading-tight">
                    <span className="text-gray-300">{c.componentName}</span>{" "}
                    <span className="text-gray-600">{c.field}:</span>{" "}
                    <span className="line-through text-gray-600">{c.oldValue}</span>{" "}
                    → <span className="text-gray-200">{c.newValue}</span>
                  </div>
                ))}
                {adaptation.changes.length > 12 && (
                  <div className="text-[9px] text-gray-600">+{adaptation.changes.length - 12} more</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-gray-600">Choose a device and adapt to see changes.</p>
        )}
      </div>

      {/* Breakpoint previews */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Breakpoint Preview</span>
          <button
            onClick={runPreview}
            disabled={loading === "preview"}
            className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
          >
            {loading === "preview" ? "..." : "Preview"}
          </button>
        </div>
        {previews ? (
          <div className="space-y-1">
            {previews.map((p, i) => (
              <div key={i} className="border border-edge p-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-200 capitalize">{p.breakpoint.name}</span>
                  <span className="text-[9px] text-gray-600">≤{p.breakpoint.maxWidth === 99999 ? "∞" : p.breakpoint.maxWidth}px</span>
                </div>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[9px] text-gray-500">{p.changeCount} changes</span>
                  <span className="text-[9px] text-gray-500">~{p.estimatedLoadMs}ms</span>
                </div>
                <div className="flex gap-1 mt-0.5">
                  {p.breakpoint.disableLoops && <span className="text-[8px] text-gray-600 border border-edge px-1">no-loop</span>}
                  {p.breakpoint.simplifyEasing && <span className="text-[8px] text-gray-600 border border-edge px-1">simple-ease</span>}
                  <span className="text-[8px] text-gray-600 border border-edge px-1">{p.breakpoint.maxKeyframes}kf max</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-gray-600">Click Preview to estimate adaptations per breakpoint.</p>
        )}
      </div>

      {/* Responsive CSS */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Responsive CSS</span>
          <button
            onClick={runCss}
            disabled={loading === "css"}
            className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
          >
            {loading === "css" ? "..." : "Generate"}
          </button>
        </div>
        {css?.css ? (
          <pre className="text-[9px] font-mono text-gray-400 bg-panel2 p-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all border border-edge">
            {css.css.slice(0, 1200)}
            {css.css.length > 1200 ? "\n..." : ""}
          </pre>
        ) : (
          <p className="text-[10px] text-gray-600">Click Generate to produce responsive CSS.</p>
        )}
      </div>

      {/* Quick prompts */}
      <div className="px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Quick Prompts</div>
        <div className="space-y-1">
          <button
            onClick={() => projectId && send(projectId, "Adapt all motion for mobile devices and reduce load")}
            className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
          >
            "Adapt for mobile and reduce load"
          </button>
          <button
            onClick={() => projectId && send(projectId, "Generate responsive CSS with media queries for all breakpoints")}
            className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
          >
            "Generate responsive CSS"
          </button>
          <button
            onClick={() => projectId && send(projectId, "Preview how motion adapts across desktop, tablet, mobile, and small screens")}
            className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
          >
            "Preview across breakpoints"
          </button>
          <button
            onClick={() => projectId && send(projectId, "Apply reduced-motion accessibility adaptation")}
            className="w-full text-left px-2 py-1 text-[10px] bg-panel2 hover:bg-panel3 rounded text-gray-400"
          >
            "Apply reduced-motion mode"
          </button>
        </div>
      </div>
    </div>
  );
}

function getAuthHeaders(): Record<string, string> {
  const key = typeof localStorage !== "undefined" ? localStorage.getItem("openmotion_api_key") : null;
  return key ? { "X-API-Key": key } : {};
}

function buildMockPreviews(componentCount: number): BreakpointPreview[] {
  const bps = [
    { name: "desktop", maxWidth: 99999, durationScale: 1.0, delayScale: 1.0, maxKeyframes: 99, disableLoops: false, simplifyEasing: false },
    { name: "tablet", maxWidth: 1024, durationScale: 0.85, delayScale: 0.8, maxKeyframes: 6, disableLoops: false, simplifyEasing: true },
    { name: "mobile", maxWidth: 640, durationScale: 0.7, delayScale: 0.6, maxKeyframes: 4, disableLoops: true, simplifyEasing: true },
    { name: "small", maxWidth: 400, durationScale: 0.5, delayScale: 0.4, maxKeyframes: 2, disableLoops: true, simplifyEasing: true },
  ];
  return bps.map((bp) => ({
    breakpoint: bp,
    changeCount: componentCount * (bp.name === "desktop" ? 0 : bp.name === "tablet" ? 2 : bp.name === "mobile" ? 3 : 4),
    estimatedLoadMs: Math.round(componentCount * 200 * bp.durationScale),
    description: `${bp.name}: adaptations estimated`,
  }));
}

function buildMockAdaptation(device: string, componentCount: number): AdaptationReport {
  const reduction = device === "small" ? 0.6 : device === "mobile" ? 0.4 : device === "tablet" ? 0.2 : 0;
  return {
    summary: `Adapted ${componentCount} components for ${device}`,
    reductionLevel: reduction,
    changes: Array.from({ length: Math.min(componentCount, 4) }, (_, i) => ({
      componentId: `comp-${i}`,
      componentName: `Component ${i + 1}`,
      field: "durationMs",
      oldValue: "800",
      newValue: String(Math.round(800 * (1 - reduction))),
      reason: `${device} breakpoint scale`,
    })),
  };
}

function buildMockCss(): string {
  return `@media (max-width: 1024px) {
  [data-motion] { animation-duration: calc(var(--dur) * 0.85); }
}
@media (max-width: 640px) {
  [data-motion] { animation-duration: calc(var(--dur) * 0.7); }
  [data-motion-loop] { animation-iteration-count: 1; }
}
@media (max-width: 400px) {
  [data-motion] { animation-duration: calc(var(--dur) * 0.5); }
}
@media (prefers-reduced-motion: reduce) {
  [data-motion] { animation: none; transition: none; }
}`;
}
