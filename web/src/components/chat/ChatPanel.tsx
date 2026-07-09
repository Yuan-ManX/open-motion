import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChatStore } from "../../store/chatStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import type { MotionComponent } from "@openmotion/shared";
import { buildMotionDna, diffDna } from "../../motion/dna.js";

/**
 * Generate context-aware suggestion chips based on the live project state.
 * The agent surfaces the most relevant next action depending on what the
 * current components look like — easing, duration, count, loop state.
 */
function buildSuggestions(components: MotionComponent[]): string[] {
  if (components.length === 0) {
    return ["Add a layer", "Use fade template", "Create a bounce animation", "Export HTML"];
  }

  const first = components[0];
  const easingName = first.easing?.type === "preset" ? first.easing.name : first.easing?.type ?? "linear";
  const isBouncy = /bounce|elastic|back|spring/.test(easingName);
  const isSmooth = /smooth|linear|ease/.test(easingName);
  const isLooping = first.iterationCount === "infinite" || (typeof first.iterationCount === "number" && first.iterationCount > 1);
  const isLong = first.durationMs > 1500;
  const isShort = first.durationMs < 500;

  const suggestions: string[] = [];

  // Easing-aware suggestions
  if (isBouncy) {
    suggestions.push("Make it smoother");
  } else if (isSmooth) {
    suggestions.push("Make it bouncy");
  } else {
    suggestions.push("Make it bouncy");
  }

  // Duration-aware suggestions
  if (isLong) {
    suggestions.push("Speed it up");
  } else if (isShort) {
    suggestions.push("Slow it down");
  } else {
    suggestions.push("Slower");
  }

  // Loop suggestion
  if (!isLooping) {
    suggestions.push("Loop forever");
  }

  // Multi-component suggestions
  if (components.length > 1) {
    suggestions.push("Apply bouncy to all");
  } else {
    suggestions.push("Duplicate layer");
  }

  // Preset suggestion
  suggestions.push("Apply glow preset");

  // Motion DNA description
  suggestions.push("Describe this motion");

  // Always offer export
  suggestions.push("Export HTML");

  return suggestions.slice(0, 6);
}

export function ChatPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingTokens = useChatStore((s) => s.streamingTokens);
  const toolActivity = useChatStore((s) => s.toolActivity);
  const plan = useChatStore((s) => s.plan);
  const completedStepIndices = useChatStore((s) => s.completedStepIndices);
  const activeStepIndex = useChatStore((s) => s.activeStepIndex);
  const error = useChatStore((s) => s.error);
  const send = useChatStore((s) => s.send);
  const regenerate = useChatStore((s) => s.regenerate);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const clear = useChatStore((s) => s.clear);
  const abort = useChatStore((s) => s.abort);
  const [input, setInput] = useState("");
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dnaDiff, setDnaDiff] = useState<string | null>(null);
  const dnaBeforeRef = useRef<string | null>(null);
  const wasStreamingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => buildSuggestions(components), [components]);

  // Compute Motion DNA diff when streaming completes.
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

  const agentStatus = useMemo<{ label: string; color: string }>(() => {
    if (error) return { label: "Error", color: "text-red-400 bg-red-950/40" };
    if (!isStreaming) return { label: messages.length > 0 ? "Ready" : "Idle", color: "text-gray-500 bg-panel2" };
    if (plan && toolActivity.length === 0) return { label: "Planning", color: "text-accent2 bg-accent2/10" };
    if (toolActivity.some((a) => !a.done)) return { label: "Executing", color: "text-yellow-400 bg-yellow-950/30" };
    if (streamingTokens) return { label: "Responding", color: "text-green-400 bg-green-950/30" };
    return { label: "Thinking", color: "text-accent2 bg-accent2/10" };
  }, [error, isStreaming, plan, toolActivity, streamingTokens, messages.length]);

  useEffect(() => {
    if (projectId) loadMessages(projectId);
  }, [projectId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingTokens, toolActivity, plan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !input.trim() || isStreaming) return;
    dnaBeforeRef.current = components.length > 0 ? buildMotionDna(components[0]) : null;
    setDnaDiff(null);
    send(projectId, input.trim());
    setInput("");
  };

  const toggleTool = (callId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-panel border-l border-edge">
      <div className="flex items-center justify-between px-4 py-2 border-b border-edge">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-200">Conversation</h2>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${agentStatus.color}`}>
            {agentStatus.label}
          </span>
          {components.length > 0 && (
            <span className="text-[10px] text-gray-600">
              {components.length} {components.length === 1 ? "layer" : "layers"}
            </span>
          )}
        </div>
        {projectId && (
          <button
            onClick={() => clear(projectId)}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-gray-500 text-sm py-8">
            <p>Tell the agent what to change.</p>
            {components.length > 0 ? (
              <div className="mt-3 text-xs text-gray-600 space-y-0.5">
                <p>Current: {components[0].name} · {components[0].durationMs}ms</p>
                <p>Easing: {components[0].easing?.type === "preset" ? components[0].easing.name : components[0].easing?.type}</p>
                <p className="mt-2 text-gray-500">Try: “make it bouncy”, “slower”, “red”, “loop forever”.</p>
              </div>
            ) : (
              <p className="text-xs mt-1">Try: “make it bouncy”, “slower”, “red”, “loop forever”.</p>
            )}
          </div>
        )}

        {messages.map((m, i) => {
          const isLastAssistant = i === lastAssistantIndex && m.role === "assistant";
          return (
            <div
              key={m.id}
              className={`text-sm rounded-lg px-3 py-2 max-w-[90%] group relative ${
                m.role === "user"
                  ? "bg-accent text-white ml-auto"
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

        {plan && isStreaming && (
          <div className="text-xs bg-panel2 border border-edge rounded-lg px-3 py-2 max-w-[90%]">
            <div className="flex items-center gap-1.5 text-accent2 font-semibold mb-1">
              <span>Plan</span>
            </div>
            <p className="text-gray-400 mb-1.5">{plan.summary}</p>
            <ol className="space-y-0.5">
              {plan.steps.map((step, i) => {
                const isDone = completedStepIndices.includes(i);
                const isActive = activeStepIndex === i;
                const icon = isDone ? "✓" : isActive ? "◉" : "○";
                const color = isDone ? "text-green-400" : isActive ? "text-accent2" : "text-gray-600";
                const textColor = isDone ? "text-gray-500 line-through" : isActive ? "text-gray-200" : "text-gray-500";
                return (
                  <li key={i} className={`flex gap-1.5 ${textColor}`}>
                    <span className={`${color} w-3 inline-block`}>{icon}</span>
                    <span>
                      <span className={`font-mono ${isDone ? "text-gray-600" : "text-accent2"}`}>{step.tool}</span>
                      <span className={isDone ? "text-gray-600" : "text-gray-500"}> — {step.description}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {toolActivity.map((a) => {
          const expanded = expandedTools.has(a.callId);
          return (
            <div key={a.callId} className="text-xs bg-panel2 border border-edge rounded-lg px-3 py-2 max-w-[90%]">
              <button
                onClick={() => toggleTool(a.callId)}
                className="flex items-center gap-1.5 w-full text-left"
              >
                <span className="text-gray-600 text-[10px]">{expanded ? "▼" : "▶"}</span>
                <span className="text-accent2 font-mono">{a.tool}</span>
                <span className="text-gray-500 ml-1">{a.done ? "✓" : "…"}</span>
              </button>
              {expanded && a.args != null && (
                <pre className="mt-1.5 text-[10px] text-gray-500 bg-black/30 rounded p-1.5 overflow-x-auto">
                  {JSON.stringify(a.args, null, 2)}
                </pre>
              )}
              {a.summary && <p className="text-gray-400 mt-1">{a.summary}</p>}
            </div>
          );
        })}

        {isStreaming && streamingTokens && (
          <div className="text-sm rounded-lg px-3 py-2 max-w-[90%] bg-panel2 text-gray-200">
            {streamingTokens}
          </div>
        )}

        {isStreaming && !streamingTokens && toolActivity.length === 0 && !plan && (
          <div className="text-sm rounded-lg px-3 py-2 max-w-[90%] bg-panel2 text-gray-500 animate-pulse">
            thinking…
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {!projectId && (
        <div className="px-4 py-3 text-xs text-gray-500 border-t border-edge">
          Pick a template to start a project.
        </div>
      )}

      {dnaDiff && (
        <div className="px-4 py-1.5 border-t border-edge bg-panel2/50">
          <span className="text-[10px] text-gray-500 mr-1">DNA change:</span>
          <span className="text-[10px] font-mono text-accent2">{dnaDiff}</span>
        </div>
      )}

      {projectId && (
        <form onSubmit={handleSubmit} className="p-3 border-t border-edge">
          <div className="flex gap-1 mb-2 flex-wrap">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="text-[11px] px-2 py-1 rounded-full bg-panel2 border border-edge text-gray-400 hover:text-accent hover:border-accent"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe a motion change…"
              disabled={isStreaming}
              className="flex-1 bg-panel2 border border-edge rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={abort}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent2 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                Send
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
