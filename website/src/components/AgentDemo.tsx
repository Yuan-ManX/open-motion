import { useEffect, useState } from "react";
import { User, Bot, Wrench, Check, Sparkles } from "lucide-react";
import { Reveal } from "./shared/Reveal";

interface ChatMessage {
  role: "user" | "agent" | "tool" | "result";
  content: string;
  tool?: string;
  delay: number;
}

const SCRIPT: ChatMessage[] = [
  {
    role: "user",
    content: "Give the hero a spring entrance — bounce in from below with a soft landing.",
    delay: 600,
  },
  {
    role: "agent",
    content: "On it. I'll apply a spring curve with a vertical translate and a squash on impact.",
    delay: 1200,
  },
  {
    role: "tool",
    content: "set_template({ id: \"tpl-spring\", target: \"hero-title\" })",
    tool: "set_template",
    delay: 1000,
  },
  {
    role: "tool",
    content: "set_transform({ from: { y: 120 }, to: { y: 0 }, easing: \"spring\", stiffness: 180, damping: 14 })",
    tool: "set_transform",
    delay: 1200,
  },
  {
    role: "tool",
    content: "set_keyframe({ at: \"80%\", scaleX: 1.2, scaleY: 0.8 })",
    tool: "set_keyframe",
    delay: 1000,
  },
  {
    role: "result",
    content: "Hero now springs in with a squash landing. Duration 1200ms, spring damping 14.",
    delay: 1400,
  },
];

function MessageBubble({ msg, visible }: { msg: ChatMessage; visible: boolean }) {
  if (!visible) return null;

  if (msg.role === "user") {
    return (
      <div className="flex items-start gap-3 animate-slide-in-right">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cinnabar2/30 to-cinnabar/30 border border-cinnabar2/30 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-cinnabar2" />
        </div>
        <div className="flex-1 pt-1">
          <div className="font-mono text-[10px] text-stone mb-1">you</div>
          <div className="text-sm text-paper leading-relaxed">{msg.content}</div>
        </div>
      </div>
    );
  }

  if (msg.role === "agent") {
    return (
      <div className="flex items-start gap-3 animate-slide-in-left">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cinnabar to-cinnabar2 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cinnabar/20">
          <Bot className="w-4 h-4 text-paper" />
        </div>
        <div className="flex-1 pt-1">
          <div className="font-mono text-[10px] text-cinnabar mb-1">motion agent</div>
          <div className="text-sm text-paper leading-relaxed">{msg.content}</div>
        </div>
      </div>
    );
  }

  if (msg.role === "tool") {
    return (
      <div className="flex items-start gap-3 animate-slide-in-left pl-11">
        <div className="w-6 h-6 rounded-md bg-cinnabar/10 border border-cinnabar/30 flex items-center justify-center flex-shrink-0">
          <Wrench className="w-3 h-3 text-cinnabar" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-cinnabar/70 mb-1">tool · {msg.tool}</div>
          <div className="font-mono text-xs text-mist bg-ink/60 rounded-lg px-3 py-2 border border-edge break-all">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  // result
  return (
    <div className="flex items-start gap-3 animate-slide-in-left">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-cinnabar2/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
        <Check className="w-4 h-4 text-green-400" />
      </div>
      <div className="flex-1 pt-1">
        <div className="font-mono text-[10px] text-green-400/70 mb-1">result</div>
        <div className="text-sm text-paper leading-relaxed flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-cinnabar2 mt-0.5 flex-shrink-0" />
          <span>{msg.content}</span>
        </div>
      </div>
    </div>
  );
}

function LivePreview({ active }: { active: boolean }) {
  return (
    <div className="relative h-32 rounded-xl bg-ink/60 border border-edge overflow-hidden">
      <div className="absolute inset-0 bg-dots opacity-40" />
      <div className="absolute top-2 left-2 font-mono text-[9px] text-stone uppercase tracking-wider">
        live preview
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cinnabar to-cinnabar font-display font-bold text-paper text-sm"
          style={{
            animation: active ? "demoSpring 1.6s ease-out" : "none",
            boxShadow: active ? "0 0 30px rgba(168,50,50,0.4)" : "none",
          }}
        >
          Hero Title
        </div>
      </div>
      <style>{`
        @keyframes demoSpring {
          0% { transform: translateY(120px) scale(1, 1); opacity: 0; }
          40% { transform: translateY(0) scale(1, 1); opacity: 1; }
          55% { transform: translateY(0) scale(1.2, 0.8); }
          70% { transform: translateY(0) scale(0.9, 1.1); }
          85% { transform: translateY(0) scale(1.05, 0.95); }
          100% { transform: translateY(0) scale(1, 1); }
        }
      `}</style>
    </div>
  );
}

export function AgentDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    if (visibleCount >= SCRIPT.length) {
      const resetTimer = setTimeout(() => {
        setVisibleCount(0);
        setReplayKey((k) => k + 1);
      }, 4000);
      return () => clearTimeout(resetTimer);
    }

    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, SCRIPT[visibleCount]?.delay ?? 1000);

    return () => clearTimeout(timer);
  }, [visibleCount, replayKey]);

  const showPreview = visibleCount >= 5;

  return (
    <section id="demo" className="relative section-padding py-32 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <Reveal variant="ink-spread">
          <div className="text-center mb-20">
            <div className="section-label">// Live Agent</div>
            <h2 className="section-title">
              Watch the agent <span className="gradient-text">build motion</span>
            </h2>
            <p className="section-subtitle">
              A real conversation — describe intent, watch tools fire, see the result
            </p>
          </div>
        </Reveal>

        <Reveal delay={150} variant="slide-left">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Chat panel */}
            <div className="relative rounded-2xl overflow-hidden border border-edge bg-panel/60 backdrop-blur-xl">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-edge bg-panel">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                  <span className="font-mono text-xs text-mist ml-2">motion-agent · sse stream</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="font-mono text-[10px] text-green-400/70">connected</span>
                </div>
              </div>

              {/* Messages */}
              <div className="p-5 space-y-4 min-h-[420px] max-h-[420px] overflow-y-auto">
                {SCRIPT.slice(0, visibleCount).map((msg, i) => (
                  <MessageBubble key={`${replayKey}-${i}`} msg={msg} visible />
                ))}
                {visibleCount < SCRIPT.length && (
                  <div className="flex items-center gap-2 pl-11">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-cinnabar animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-cinnabar animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-cinnabar animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview + info panel */}
            <div className="space-y-4">
              <div className="relative p-5 rounded-2xl glass-hover">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-sm font-bold text-paper">Live Preview</h3>
                  <span className="font-mono text-[10px] text-stone">1200ms · spring</span>
                </div>
                <LivePreview active={showPreview} />
                <p className="font-mono text-[10px] text-stone mt-3 leading-relaxed">
                  {showPreview
                    ? "// Animation running — spring entrance with squash landing"
                    : "// Waiting for agent to apply motion..."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl glass">
                  <div className="font-mono text-[10px] text-stone mb-1">TOOLS CALLED</div>
                  <div className="font-display text-2xl font-bold text-cinnabar2">
                    {Math.min(Math.max(0, visibleCount - 2), 3)}<span className="text-sm text-stone">/3</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl glass">
                  <div className="font-mono text-[10px] text-stone mb-1">LATENCY</div>
                  <div className="font-display text-2xl font-bold text-cinnabar">
                    ~{Math.min(visibleCount * 200, 1200)}<span className="text-sm text-stone">ms</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl glass border-cinnabar/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-cinnabar" />
                  <span className="font-mono text-[10px] text-cinnabar uppercase tracking-wider">zero shot</span>
                </div>
                <p className="text-xs text-mist leading-relaxed">
                  One sentence in, three tool calls out. The agent picks the template,
                  tunes the spring curve, and sets the squash keyframe — no manual timeline work.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
