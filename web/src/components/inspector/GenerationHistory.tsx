import { useGenerationStore, type GenerationRecord } from "../../store/generationStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function GenerationItem({ gen, active }: { gen: GenerationRecord; active: boolean }) {
  const setActiveGeneration = useGenerationStore((s) => s.setActiveGeneration);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const components = useProjectStore((s) => s.components);

  const handleClick = () => {
    setActiveGeneration(gen.id);
    // Select the first component from this generation if it still exists.
    const firstExisting = gen.componentIds.find((id) => components.some((c) => c.id === id));
    if (firstExisting) selectComponent(firstExisting);
  };

  return (
    <button
      onClick={handleClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        padding: "10px 12px",
        background: active ? "var(--panel2)" : "transparent",
        border: "none",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            color: "var(--accent2)",
            fontFamily: "var(--mono)",
            whiteSpace: "nowrap",
          }}
        >
          {formatTime(gen.timestamp)}
        </span>
        <span
          style={{
            fontSize: 10,
            color: gen.componentCount > 0 ? "var(--accent)" : "var(--accent2)",
            fontFamily: "var(--mono)",
          }}
        >
          {gen.componentCount} comp
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--accent2)",
            fontFamily: "var(--mono)",
          }}
        >
          {gen.toolCalls.length} tools
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text)",
          lineHeight: 1.4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {gen.prompt}
      </div>
      {gen.toolCalls.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {gen.toolCalls.slice(0, 5).map((tc, i) => (
            <span
              key={i}
              style={{
                fontSize: 9,
                padding: "1px 6px",
                background: "var(--panel2)",
                color: "var(--accent2)",
                fontFamily: "var(--mono)",
                borderRadius: 2,
              }}
            >
              {tc.tool}
            </span>
          ))}
          {gen.toolCalls.length > 5 && (
            <span style={{ fontSize: 9, color: "var(--accent2)", fontFamily: "var(--mono)" }}>
              +{gen.toolCalls.length - 5}
            </span>
          )}
        </div>
      )}
      {gen.summary?.headline && (
        <div style={{ fontSize: 11, color: "var(--accent2)", lineHeight: 1.3 }}>
          {gen.summary.headline}
        </div>
      )}
    </button>
  );
}

export function GenerationHistory() {
  const generations = useGenerationStore((s) => s.generations);
  const activeId = useGenerationStore((s) => s.activeGenerationId);
  const clearGenerations = useGenerationStore((s) => s.clearGenerations);

  if (generations.length === 0) {
    return (
      <div
        style={{
          padding: "24px 16px",
          textAlign: "center",
          color: "var(--accent2)",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        Generation history will appear here.
        <br />
        Send a prompt to the Agent to create motion.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--accent2)", fontFamily: "var(--mono)" }}>
          {generations.length} generation{generations.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={clearGenerations}
          style={{
            fontSize: 10,
            color: "var(--accent2)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 6px",
          }}
          title="Clear all generations"
        >
          Clear
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {[...generations].reverse().map((gen) => (
          <GenerationItem key={gen.id} gen={gen} active={gen.id === activeId} />
        ))}
      </div>
    </div>
  );
}
