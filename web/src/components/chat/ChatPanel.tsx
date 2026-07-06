import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../../store/chatStore.js";
import { useProjectStore } from "../../store/projectStore.js";

export function ChatPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingTokens = useChatStore((s) => s.streamingTokens);
  const toolActivity = useChatStore((s) => s.toolActivity);
  const error = useChatStore((s) => s.error);
  const send = useChatStore((s) => s.send);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const clear = useChatStore((s) => s.clear);
  const abort = useChatStore((s) => s.abort);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) loadMessages(projectId);
  }, [projectId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingTokens, toolActivity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !input.trim() || isStreaming) return;
    send(projectId, input.trim());
    setInput("");
  };

  const suggestions = ["让标题弹跳", "慢一点", "红色", "循环", "导出 html", "打包 skill"];

  return (
    <div className="flex flex-col h-full bg-panel border-l border-edge">
      <div className="flex items-center justify-between px-4 py-2 border-b border-edge">
        <h2 className="text-sm font-semibold text-gray-200">Conversation</h2>
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
            <p className="text-xs mt-1">Try: “make it bouncy”, “slower”, “red”, “loop forever”.</p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-sm rounded-lg px-3 py-2 max-w-[90%] ${
              m.role === "user"
                ? "bg-accent text-white ml-auto"
                : "bg-panel2 text-gray-200"
            }`}
          >
            {m.content}
          </div>
        ))}

        {toolActivity.map((a) => (
          <div key={a.callId} className="text-xs bg-panel2 border border-edge rounded-lg px-3 py-2 max-w-[90%]">
            <span className="text-accent2 font-mono">{a.tool}</span>
            <span className="text-gray-500 ml-2">{a.done ? "✓" : "…"}</span>
            {a.summary && <p className="text-gray-400 mt-1">{a.summary}</p>}
          </div>
        ))}

        {isStreaming && streamingTokens && (
          <div className="text-sm rounded-lg px-3 py-2 max-w-[90%] bg-panel2 text-gray-200">
            {streamingTokens}
          </div>
        )}

        {isStreaming && !streamingTokens && toolActivity.length === 0 && (
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
