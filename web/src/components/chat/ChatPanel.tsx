import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChatStore } from "../../store/chatStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import type { MotionComponent } from "@openmotion/shared";
import { buildMotionDna, diffDna } from "../../motion/dna.js";
import * as api from "../../api/endpoints.js";

/**
 * Generate context-aware suggestion chips based on the live project state.
 * When no project exists, suggestions are starter prompts that will
 * auto-create a project. When components exist, suggestions adapt to
 * the current easing, duration, and loop state.
 */
function buildSuggestions(components: MotionComponent[], hasProject: boolean): string[] {
  if (!hasProject) {
    return [
      "Create a bounce animation",
      "Add a fade-in layer",
      "Make a loading spinner",
      "Build a celebration effect",
    ];
  }
  if (components.length === 0) {
    return [
      "Add a bounce layer",
      "Use fade template",
      "Create a pulse animation",
      "Add a shimmer effect",
    ];
  }

  const first = components[0];
  const easingName = first.easing?.type === "preset" ? first.easing.name : first.easing?.type ?? "linear";
  const isBouncy = /bounce|elastic|back|spring/.test(easingName);
  const isLooping = first.iterationCount === "infinite" || (typeof first.iterationCount === "number" && first.iterationCount > 1);
  const isLong = first.durationMs > 1500;
  const isShort = first.durationMs < 500;

  const suggestions: string[] = [];
  suggestions.push(isBouncy ? "Make it smoother" : "Make it bouncy");
  if (isLong) suggestions.push("Speed it up");
  else if (isShort) suggestions.push("Slow it down");
  else suggestions.push("Slower");
  if (!isLooping) suggestions.push("Loop forever");
  suggestions.push(components.length > 1 ? "Apply bouncy to all" : "Duplicate layer");
  suggestions.push("Analyze my motion");
  suggestions.push("Describe this motion");
  suggestions.push("Export HTML");
  return suggestions.slice(0, 6);
}

export function ChatPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const loadProject = useProjectStore((s) => s.loadProject);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingTokens = useChatStore((s) => s.streamingTokens);
  const toolActivity = useChatStore((s) => s.toolActivity);
  const plan = useChatStore((s) => s.plan);
  const completedStepIndices = useChatStore((s) => s.completedStepIndices);
  const activeStepIndex = useChatStore((s) => s.activeStepIndex);
  const reasoningText = useChatStore((s) => s.reasoningText);
  const reflection = useChatStore((s) => s.reflection);
  const error = useChatStore((s) => s.error);
  const send = useChatStore((s) => s.send);
  const regenerate = useChatStore((s) => s.regenerate);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const abort = useChatStore((s) => s.abort);

  const [input, setInput] = useState("");
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dnaDiff, setDnaDiff] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const dnaBeforeRef = useRef<string | null>(null);
  const wasStreamingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const skipLoadRef = useRef(false);
  const lastUserTextRef = useRef<string | null>(null);

  const suggestions = useMemo(() => buildSuggestions(components, !!projectId), [components, projectId]);

  const busy = isStreaming || creating;

  /** Compute Motion DNA diff when streaming completes. */
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      const after = components.length > 0 ? buildMotionDna(components[0]) : "";
      const diff = dnaBeforeRef.current && after ? diffDna(dnaBeforeRef.current, after) : null;
      setDnaDiff(diff);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, components]);

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {
      // Clipboard API may be unavailable in non-secure contexts.
    });
  }, []);

  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  /** Load messages when project changes — skip for auto-created projects. */
  useEffect(() => {
    if (!projectId) return;
    if (skipLoadRef.current) {
      skipLoadRef.current = false;
      return;
    }
    loadMessages(projectId);
  }, [projectId, loadMessages]);

  /** Smart auto-scroll: only scroll to bottom if user is near bottom. */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, streamingTokens, toolActivity, plan]);

  /**
   * Send a message to the agent. If no project is loaded, auto-create one
   * first so the user can start chatting immediately — the "conversation as
   * cursor" principle means the agent should never require manual setup.
   */
  const submitText = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || creating) return;

    let pid = projectId;
    if (!pid) {
      setCreating(true);
      try {
        const p = await api.createProject({ name: "Untitled motion" });
        pid = p.id;
        skipLoadRef.current = true;
        await loadProject(p.id);
      } catch {
        setCreating(false);
        return;
      }
      setCreating(false);
    }
    if (!pid) return;
    lastUserTextRef.current = text.trim();
    dnaBeforeRef.current = components.length > 0 ? buildMotionDna(components[0]) : null;
    setDnaDiff(null);
    send(pid, text.trim());
  }, [projectId, isStreaming, creating, components, loadProject, send]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    void submitText(text);
  };

  const handleSuggestion = (s: string) => {
    if (busy) return;
    void submitText(s);
  };

  const handleRetry = useCallback(() => {
    if (lastUserTextRef.current && projectId && !isStreaming) {
      send(projectId, lastUserTextRef.current);
    }
  }, [projectId, isStreaming, send]);

  const toggleTool = (callId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  };

  const placeholder = projectId
    ? (components.length > 0 ? "Describe a motion change…" : "Describe a motion to add…")
    : "Describe a motion to create…";

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !isStreaming && !creating && (
          <div className="text-center text-gray-500 text-sm py-10 px-4">
            {projectId ? (
              components.length > 0 ? (
                <>
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full border border-edge flex items-center justify-center text-gray-600">
                    ◈
                  </div>
                  <p className="text-gray-400">Tell the agent what to change.</p>
                  <div className="mt-3 text-xs text-gray-600 space-y-0.5">
                    <p>Current: {components[0].name} · {components[0].durationMs}ms</p>
                    <p>Easing: {components[0].easing?.type === "preset" ? components[0].easing.name : components[0].easing?.type}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full border border-edge flex items-center justify-center text-gray-600">
                    +
                  </div>
                  <p className="text-gray-400">Describe a motion or pick a suggestion below.</p>
                </>
              )
            ) : (
              <>
                <div className="w-10 h-10 mx-auto mb-3 rounded-full border border-edge flex items-center justify-center text-gray-600">
                  ◇
                </div>
                <p className="text-gray-400">Describe a motion to begin.</p>
                <p className="text-xs text-gray-600 mt-1">The agent will set everything up for you.</p>
              </>
            )}
          </div>
        )}

        {creating && (
          <div className="text-sm rounded-lg px-3 py-2 max-w-[90%] bg-panel2 text-gray-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: "0.15s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: "0.3s" }} />
            <span className="ml-1">Creating project</span>
          </div>
        )}

        {messages.map((m, i) => {
          const isLastAssistant = i === lastAssistantIndex && m.role === "assistant";
          return (
            <div
              key={m.id}
              className={`fade-in-up text-sm rounded-lg px-3 py-2 max-w-[90%] group relative ${
                m.role === "user"
                  ? "bg-accent text-black ml-auto"
                  : "bg-panel2 text-gray-200"
              }`}
            >
              {m.content}
              {m.role === "assistant" && m.content && (
                <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleCopy(m.id, m.content)}
                    className="text-[10px] text-gray-500 hover:text-accent px-1 py-0.5"
                    title="Copy to clipboard"
                    aria-label="Copy message"
                  >
                    {copiedId === m.id ? "✓ Copied" : "Copy"}
                  </button>
                  {isLastAssistant && !isStreaming && projectId && (
                    <button
                      onClick={() => {
                        dnaBeforeRef.current = components.length > 0 ? buildMotionDna(components[0]) : null;
                        setDnaDiff(null);
                        regenerate(projectId);
                      }}
                      className="text-[10px] text-gray-500 hover:text-accent px-1 py-0.5"
                      title="Regenerate response"
                      aria-label="Regenerate"
                    >
                      ↻ Regenerate
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Plan display */}
        {plan && isStreaming && (
          <div className="fade-in-up text-xs bg-panel2 border border-edge rounded-lg px-3 py-2.5 max-w-[90%]">
            <div className="flex items-center gap-1.5 text-white font-semibold mb-1.5">
              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
              <span>Plan</span>
              <span className="text-[10px] text-gray-600 ml-auto">
                {completedStepIndices.length}/{plan.steps.length}
              </span>
            </div>
            <p className="text-gray-400 mb-2">{plan.summary}</p>
            {/* Progress bar */}
            <div className="h-0.5 bg-edge rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${plan.steps.length > 0 ? (completedStepIndices.length / plan.steps.length) * 100 : 0}%` }}
              />
            </div>
            <ol className="space-y-1">
              {plan.steps.map((step, i) => {
                const isDone = completedStepIndices.includes(i);
                const isActive = activeStepIndex === i;
                const icon = isDone ? "✓" : isActive ? "◉" : "○";
                const color = isDone ? "text-white" : isActive ? "text-white" : "text-gray-600";
                const textColor = isDone ? "text-gray-600 line-through" : isActive ? "text-gray-100" : "text-gray-500";
                return (
                  <li key={i} className={`flex gap-1.5 items-start ${textColor} ${isActive ? "pulse-glow rounded px-1 -mx-1" : ""}`}>
                    <span className={`${color} w-3 inline-block flex-shrink-0 ${isActive ? "animate-pulse" : ""}`}>{icon}</span>
                    <span className="min-w-0">
                      <span className={`font-mono ${isDone ? "text-gray-600" : "text-white"}`}>{step.tool}</span>
                      <span className={isDone ? "text-gray-600" : "text-gray-500"}> — {step.description}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Reasoning trace */}
        {reasoningText && isStreaming && (
          <div className="text-xs bg-panel2/50 border border-edge rounded-lg px-3 py-2 max-w-[90%]">
            <div className="flex items-center gap-1.5 text-gray-500 mb-1">
              <span className="text-[10px]">Thinking</span>
            </div>
            <p className="text-gray-500 italic line-clamp-3">{reasoningText}</p>
          </div>
        )}

        {/* Self-reflection on failures */}
        {reflection && isStreaming && (
          <div className="text-xs bg-panel2 border border-edge rounded-lg px-3 py-2 max-w-[90%]">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <span className="text-[10px]">Self-Reflection</span>
              {reflection.failedTools.length > 0 && (
                <span className="text-[9px] text-red-400 font-mono">{reflection.failedTools.join(", ")}</span>
              )}
            </div>
            <p className="text-gray-400 line-clamp-3">{reflection.text}</p>
            {reflection.suggestion && (
              <p className="text-gray-500 mt-1 text-[10px]">→ {reflection.suggestion}</p>
            )}
          </div>
        )}

        {/* Tool activity */}
        {toolActivity.map((a) => {
          const expanded = expandedTools.has(a.callId);
          const isAnalysis = a.tool === "analyze_motion" && a.done && a.result;
          const analysisData = isAnalysis ? (a.result as { insights?: Array<{ severity: string; category: string; message: string }>; score?: number }) : null;
          return (
            <div key={a.callId} className="fade-in-up text-xs bg-panel2 border border-edge rounded-lg px-3 py-2 max-w-[90%]">
              <button
                onClick={() => toggleTool(a.callId)}
                className="flex items-center gap-1.5 w-full text-left"
              >
                <span className="text-gray-600 text-[10px] transition-transform" style={{ transform: expanded ? "rotate(0deg)" : "rotate(0deg)" }}>{expanded ? "▼" : "▶"}</span>
                <span className="text-white font-mono">{a.tool}</span>
                {a.done ? (
                  <span className="text-white ml-1 text-[10px]">✓</span>
                ) : (
                  <span className="text-gray-500 ml-1 text-[10px] animate-pulse">running</span>
                )}
              </button>
              {expanded && a.args != null && (
                <pre className="mt-1.5 text-[10px] text-gray-500 bg-black/30 rounded p-1.5 overflow-x-auto">
                  {JSON.stringify(a.args, null, 2)}
                </pre>
              )}
              {a.summary && <p className="text-gray-400 mt-1">{a.summary}</p>}
              {analysisData && analysisData.insights && (
                <div className="mt-2 space-y-1">
                  {analysisData.score != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600">Score</span>
                      <span className="text-xs font-mono text-white">{analysisData.score}/100</span>
                    </div>
                  )}
                  {analysisData.insights.map((ins, idx) => (
                    <div key={idx} className="flex gap-1.5 items-start">
                      <span className={`text-[10px] mt-0.5 ${
                        ins.severity === "critical" ? "text-red-400"
                        : ins.severity === "warning" ? "text-gray-300"
                        : "text-gray-600"
                      }`}>
                        {ins.severity === "critical" ? "●" : ins.severity === "warning" ? "○" : "·"}
                      </span>
                      <span className="text-gray-500 flex-1">{ins.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming tokens */}
        {isStreaming && streamingTokens && (
          <div className="text-sm rounded-lg px-3 py-2 max-w-[90%] bg-panel2 text-gray-200">
            {streamingTokens}
            <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-white/70 align-middle animate-pulse" />
          </div>
        )}

        {/* Thinking indicator */}
        {isStreaming && !streamingTokens && toolActivity.length === 0 && !plan && (
          <div className="text-sm rounded-lg px-3 py-2 max-w-[90%] bg-panel2 text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: "0.15s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: "0.3s" }} />
            <span className="ml-1">thinking</span>
          </div>
        )}

        {/* Error with retry */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span className="flex-1">{error}</span>
            {lastUserTextRef.current && projectId && !isStreaming && (
              <button
                onClick={handleRetry}
                className="text-red-300 hover:text-white underline flex-shrink-0"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* DNA diff badge */}
      {dnaDiff && (
        <div className="px-4 py-1.5 border-t border-edge bg-panel2/50">
          <span className="text-[10px] text-gray-500 mr-1">DNA change:</span>
          <span className="text-[10px] font-mono text-white">{dnaDiff}</span>
        </div>
      )}

      {/* Input form — always visible */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-edge">
        <div className="flex gap-1 mb-2 flex-wrap">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSuggestion(s)}
              disabled={busy}
              className="text-[11px] px-2 py-1 rounded-full bg-panel2 border border-edge text-gray-400 hover:text-accent hover:border-accent hover:scale-[1.03] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={busy}
            className="flex-1 bg-panel2 border border-edge rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={abort}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || creating}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent2 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-medium"
            >
              {creating ? "…" : "Send"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
