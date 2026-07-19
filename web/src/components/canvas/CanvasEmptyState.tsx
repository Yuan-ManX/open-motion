import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";

interface QuickStart {
  prompt: string;
  label: string;
  icon: string;
  hint: string;
}

const QUICK_STARTS: QuickStart[] = [
  { prompt: "create a fade in animation", label: "Fade In", icon: "▾", hint: "Gentle opacity entrance" },
  { prompt: "create a bounce in animation", label: "Bounce In", icon: "◉", hint: "Elastic spring entrance" },
  { prompt: "create a slide up animation", label: "Slide Up", icon: "△", hint: "Vertical motion entrance" },
  { prompt: "create a spin entrance animation", label: "Spin In", icon: "↻", hint: "Rotating reveal" },
  { prompt: "create a scale up animation", label: "Scale Up", icon: "⤢", hint: "Growing entrance" },
  { prompt: "create a spring entrance animation", label: "Spring", icon: "〰", hint: "Physics-based motion" },
];

const EXAMPLE_PROMPTS: QuickStart[] = [
  { prompt: "create a bouncy fade in with 200ms delay, blue background", label: "Compound request", icon: "✦", hint: "Multiple properties in one sentence" },
  { prompt: "apply a cinematic style", label: "Style preset", icon: "◐", hint: "Coordinated aesthetic across project" },
  { prompt: "stagger all components by 150ms", label: "Choreography", icon: "≡", hint: "Sequential cascade entrance" },
  { prompt: "add a glitch shader effect", label: "Shader effect", icon: "▓", hint: "WebGL visual effect" },
];

export function CanvasEmptyState() {
  const projectId = useProjectStore((s) => s.projectId);
  const send = useChatStore((s) => s.send);

  const handleQuickStart = (prompt: string) => {
    if (projectId) send(projectId, prompt);
  };

  return (
    <div
      data-empty-state
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        overflowY: "auto",
      }}
    >
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 20px",
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--panel2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            color: "var(--text)",
          }}
        >
          ◇
        </div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "var(--text)",
            margin: "0 0 8px",
            letterSpacing: "-0.01em",
          }}
        >
          Start creating motion
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--accent2)",
            maxWidth: 380,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Pick a quick start below, or describe what you want in the Agent chat on the left.
          Everything you create here can be refined through conversation.
        </p>
      </div>

      {/* Quick start grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          maxWidth: 520,
          width: "100%",
          marginBottom: 32,
        }}
      >
        {QUICK_STARTS.map((qs) => (
          <button
            key={qs.label}
            onClick={() => handleQuickStart(qs.prompt)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 6,
              padding: "14px 16px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.15s ease",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--text)";
              e.currentTarget.style.background = "var(--panel2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "var(--panel)";
            }}
          >
            <span style={{ fontSize: 18, color: "var(--text)", lineHeight: 1 }}>{qs.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{qs.label}</span>
            <span style={{ fontSize: 10, color: "var(--accent2)", lineHeight: 1.3 }}>{qs.hint}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          maxWidth: 520,
          marginBottom: 24,
        }}
      >
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 10, color: "var(--accent2)", fontFamily: "var(--mono)", letterSpacing: "0.05em" }}>
          OR TRY THESE
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      {/* Example prompts */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 520,
          width: "100%",
        }}
      >
        {EXAMPLE_PROMPTS.map((ex) => (
          <button
            key={ex.label}
            onClick={() => handleQuickStart(ex.prompt)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.15s ease",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--text)";
              e.currentTarget.style.background = "var(--panel2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ fontSize: 14, color: "var(--accent2)", flexShrink: 0 }}>{ex.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{ex.label}</div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--accent2)",
                  fontFamily: "var(--mono)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                "{ex.prompt}"
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
