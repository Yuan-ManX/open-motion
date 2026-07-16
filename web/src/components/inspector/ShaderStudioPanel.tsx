import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  SHADER_PRESETS,
  SHADER_CATEGORIES,
  getShaderPreset,
} from "../../motion/shaderPresets.js";
import { createShaderRenderer, type ShaderRenderer } from "../../motion/webglRenderer.js";
import { useUiStore } from "../../store/uiStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";

export function ShaderStudioPanel() {
  const [selectedId, setSelectedId] = useState<string>(SHADER_PRESETS[0].id);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [params, setParams] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ShaderRenderer | null>(null);

  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const projectId = useProjectStore((s) => s.projectId);

  const selected = useMemo(() => getShaderPreset(selectedId) ?? SHADER_PRESETS[0], [selectedId]);

  const filteredPresets = useMemo(() => {
    if (activeCategory === "all") return SHADER_PRESETS;
    return SHADER_PRESETS.filter((s) => s.category === activeCategory);
  }, [activeCategory]);

  const defaultParams = useMemo(() => {
    const dp: Record<string, number> = {};
    for (const [name, spec] of Object.entries(selected.parameters)) {
      dp[name] = spec.default;
    }
    return dp;
  }, [selected]);

  useEffect(() => {
    setParams(defaultParams);
  }, [defaultParams]);

  useEffect(() => {
    if (!canvasRef.current) return;
    setError(null);
    if (rendererRef.current) {
      rendererRef.current.destroy();
      rendererRef.current = null;
    }
    try {
      const canvas = canvasRef.current;
      const w = canvas.clientWidth * (window.devicePixelRatio || 1);
      const h = canvas.clientHeight * (window.devicePixelRatio || 1);
      canvas.width = Math.max(64, Math.floor(w));
      canvas.height = Math.max(64, Math.floor(h));
      rendererRef.current = createShaderRenderer(canvas, selected.glslSource, defaultParams);
    } catch (e) {
      setError(e instanceof Error ? e.message : "WebGL initialization failed");
    }
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [selected, defaultParams]);

  useEffect(() => {
    if (!rendererRef.current) return;
    for (const [name, value] of Object.entries(params)) {
      rendererRef.current.setParameter(name, value);
    }
  }, [params]);

  const handleApply = useCallback(() => {
    if (!projectId || !selectedComponentId) return;
    const paramStr = Object.entries(params)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    const prompt = `Apply the ${selected.name} shader effect to the selected component${paramStr ? ` with ${paramStr}` : ""}`;
    useChatStore.getState().send(projectId, prompt);
  }, [projectId, selectedComponentId, selected, params]);

  const paramEntries = Object.entries(selected.parameters);

  return (
    <div className="flex flex-col h-full">
      {/* Live WebGL preview */}
      <div className="relative border-b border-edge flex-shrink-0" style={{ height: 140 }}>
        <canvas ref={canvasRef} className="w-full h-full block" />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-panel2/80">
            <div className="text-center px-3">
              <div className="text-[10px] text-red-400 mb-1">Shader Error</div>
              <div className="text-[9px] text-gray-500 font-mono break-all">{error}</div>
            </div>
          </div>
        )}
        <div className="absolute bottom-1 left-2 text-[9px] text-white/60 font-mono pointer-events-none">
          {selected.name}
        </div>
      </div>

      {/* Parameter sliders */}
      {paramEntries.length > 0 && (
        <div className="px-3 py-2 border-b border-edge flex-shrink-0 space-y-1.5">
          {paramEntries.map(([name, spec]) => (
            <div key={name} className="flex items-center gap-2">
              <label className="text-[10px] text-gray-500 w-16 flex-shrink-0 capitalize">{name}</label>
              <input
                type="range"
                min={spec.min}
                max={spec.max}
                step={(spec.max - spec.min) / 100}
                value={params[name] ?? spec.default}
                onChange={(e) => setParams((p) => ({ ...p, [name]: Number(e.target.value) }))}
                className="flex-1 h-1 accent-white"
              />
              <span className="text-[9px] text-gray-600 font-mono w-8 text-right">
                {(params[name] ?? spec.default).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Apply button */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <button
          onClick={handleApply}
          disabled={!projectId || !selectedComponentId}
          className="w-full text-[10px] py-1.5 rounded border border-edge bg-panel2 text-gray-300 hover:text-white hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={!projectId ? "Open a project first" : !selectedComponentId ? "Select a component first" : `Apply ${selected.name} to selected component`}
        >
          {selectedComponentId ? `Apply to Selected` : "Select a Component"}
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 px-2 py-1.5 border-b border-edge flex-shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveCategory("all")}
          className={`text-[9px] px-1.5 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
            activeCategory === "all"
              ? "border-accent text-accent"
              : "border-edge text-gray-500 hover:text-gray-300"
          }`}
        >
          All ({SHADER_PRESETS.length})
        </button>
        {SHADER_CATEGORIES.map((cat) => {
          const count = SHADER_PRESETS.filter((s) => s.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-[9px] px-1.5 py-0.5 rounded-full border whitespace-nowrap capitalize transition-colors ${
                activeCategory === cat
                  ? "border-accent text-accent"
                  : "border-edge text-gray-500 hover:text-gray-300"
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Shader gallery */}
      <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1">
        {filteredPresets.map((shader) => (
          <button
            key={shader.id}
            onClick={() => setSelectedId(shader.id)}
            className={`w-full text-left rounded-lg border p-2 transition-colors ${
              selectedId === shader.id
                ? "border-accent bg-panel2"
                : "border-edge bg-panel2/50 hover:border-gray-600"
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-medium text-gray-200">{shader.name}</span>
              <span className="text-[8px] text-gray-600 uppercase tracking-wider">{shader.category}</span>
            </div>
            <p className="text-[9px] text-gray-500 leading-tight">{shader.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
