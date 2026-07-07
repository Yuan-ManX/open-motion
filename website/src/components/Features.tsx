import { MessageSquare, Sliders, Layers, Package, FileOutput, Plug } from "lucide-react";
import { Reveal } from "./shared/Reveal";
import { SpotlightCard } from "./shared/SpotlightCard";

function MiniDemo({ type }: { type: "chat" | "keyframe" | "templates" | "skill" | "export" | "mcp" }) {
  if (type === "chat") {
    return (
      <div className="space-y-2 mt-4">
        <div className="flex gap-2">
          <div className="w-5 h-5 rounded-md bg-paper/20 border border-paper/30 flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-2 w-3/4 rounded-full bg-white/10" />
            <div className="h-2 w-1/2 rounded-full bg-white/5" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-5 h-5 rounded-md bg-paper flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-2 w-2/3 rounded-full bg-paper/30" />
            <div className="flex gap-1 mt-1">
              <div className="h-4 px-2 rounded bg-cinnabar/10 border border-cinnabar/20 flex items-center">
                <span className="font-mono text-[8px] text-cinnabar2">set_template</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "keyframe") {
    return (
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full bg-edge relative overflow-hidden"
            >
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cinnabar"
                style={{ left: `${i * 25}%`, boxShadow: "0 0 6px rgba(168,50,50,0.6)" }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between font-mono text-[8px] text-stone">
          <span>0ms</span>
          <span>1200ms</span>
        </div>
      </div>
    );
  }

  if (type === "templates") {
    return (
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {["fade", "rotate", "scale", "spring", "bounce", "squash"].map((name, i) => (
          <div
            key={name}
            className="aspect-square rounded-lg border border-paper/10 bg-ink/40 flex items-center justify-center group-hover:border-cinnabar/30 transition-colors"
          >
            <div
              className="w-6 h-6 rounded bg-gradient-to-br from-paper to-mist"
              style={{
                animation: `tpl${i} 2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
            <style>{`
              @keyframes tpl0 { 0%,100%{opacity:0.3} 50%{opacity:1} }
              @keyframes tpl1 { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
              @keyframes tpl2 { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }
              @keyframes tpl3 { 0%,100%{transform:scale(1,1)} 50%{transform:scale(1.2,0.8)} }
              @keyframes tpl4 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
              @keyframes tpl5 { 0%,100%{transform:scaleX(1)scaleY(1)} 50%{transform:scaleX(1.3)scaleY(0.7)} }
            `}</style>
          </div>
        ))}
      </div>
    );
  }

  if (type === "skill") {
    return (
      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 px-3 py-2 rounded-lg bg-ink/60 border border-paper/10 font-mono text-[9px] text-mist">
          <span className="text-cinnabar2">const</span> skill = <span className="text-paper">"sk_hero"</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-cinnabar/20 border border-cinnabar/40 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-cinnabar animate-pulse" />
        </div>
      </div>
    );
  }

  if (type === "export") {
    return (
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["HTML", "CSS", "JSON", "React", "MP4", "GIF", "WebM"].map((fmt) => (
          <span
            key={fmt}
            className="font-mono text-[9px] px-2 py-1 rounded-md bg-paper/[0.03] border border-paper/10 text-mist hover:border-cinnabar/30 hover:text-cinnabar2 transition-colors cursor-default"
          >
            {fmt}
          </span>
        ))}
      </div>
    );
  }

  // mcp
  return (
    <div className="mt-4 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="font-mono text-[9px] text-stone">mcp server · connected</span>
      </div>
      <div className="px-2 py-1.5 rounded bg-ink/60 border border-paper/10 font-mono text-[9px] text-mist">
        <span className="text-cinnabar2">→</span> motion_context(<span className="text-paper">"hero"</span>)
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Conversational Motion",
    description:
      "Create pro-level animations through conversation with the motion agent. Describe the feeling — the agent shapes the frames, tunes the curves, sets the timing.",
    tag: "Agent-powered",
    span: "md:col-span-2 md:row-span-2",
    gradient: "from-paper/[0.06] to-transparent",
    iconBg: "from-paper/20 to-mist/10",
    demo: "chat" as const,
    spotlight: "rgba(242, 239, 230, 0.08)",
  },
  {
    icon: Sliders,
    title: "Keyframe Precision",
    description: "Full timeline control when you need it. Set every frame and property exactly.",
    tag: "Timeline",
    span: "",
    gradient: "from-paper/[0.04] to-transparent",
    iconBg: "from-mist/20 to-paper/10",
    demo: "keyframe" as const,
    spotlight: "rgba(154, 154, 154, 0.08)",
  },
  {
    icon: Layers,
    title: "Style Primitives",
    description: "Fade, Rotate, Scale, Spring, Bounce, Squash & Stretch — ready to stack.",
    tag: "11 templates",
    span: "",
    gradient: "from-cinnabar/[0.06] to-transparent",
    iconBg: "from-cinnabar/20 to-cinnabar2/10",
    demo: "templates" as const,
    spotlight: "rgba(168, 50, 50, 0.08)",
  },
  {
    icon: Package,
    title: "Skill Pipeline",
    description:
      "Package any motion as a self-contained, AI-callable skill. The same primitive flows across projects, teams, and agent workflows — motion becomes a transferable unit of design knowledge.",
    tag: "Reusable",
    span: "md:col-span-2",
    gradient: "from-paper/[0.04] to-cinnabar/[0.04]",
    iconBg: "from-paper/20 to-cinnabar/10",
    demo: "skill" as const,
    spotlight: "rgba(242, 239, 230, 0.08)",
  },
  {
    icon: FileOutput,
    title: "Multi-format Export",
    description: "HTML, CSS, JSON, React, MP4, GIF, WebM — ship to any destination.",
    tag: "7 formats",
    span: "",
    gradient: "from-paper/[0.04] to-transparent",
    iconBg: "from-mist/20 to-paper/10",
    demo: "export" as const,
    spotlight: "rgba(154, 154, 154, 0.08)",
  },
  {
    icon: Plug,
    title: "MCP Native",
    description: "Send animation code to your agentic coding tools via the MCP server.",
    tag: "Agent-ready",
    span: "",
    gradient: "from-cinnabar/[0.05] to-transparent",
    iconBg: "from-cinnabar/20 to-cinnabar2/10",
    demo: "mcp" as const,
    spotlight: "rgba(168, 50, 50, 0.08)",
  },
];

export function Features() {
  return (
    <section id="features" className="relative section-padding py-32 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <Reveal variant="ink-spread">
          <div className="text-center mb-20">
            <div className="section-label">// Capabilities</div>
            <h2 className="section-title">
              Everything you need to <span className="gradient-text">ship motion</span>
            </h2>
            <p className="section-subtitle">
              From a single bounce to a full multi-scene story
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-4 auto-rows-[200px]">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80} variant="scale" className={f.span}>
              <SpotlightCard spotlightColor={f.spotlight} className="h-full rounded-2xl">
                <div className={`group relative h-full p-6 rounded-2xl glass-premium overflow-hidden bg-gradient-to-br ${f.gradient} transition-all duration-500 hover:-translate-y-1 depth-shadow-hover premium-border`}>
                  {/* Animated border glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ boxShadow: "inset 0 0 30px rgba(99,102,241,0.1)" }}
                  />

                  <div className="relative flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${f.iconBg} border border-paper/10 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 depth-shadow`}>
                        <f.icon className="w-5 h-5 text-paper/90" />
                      </div>
                      <span className="font-mono text-[10px] text-mist px-2 py-0.5 rounded-full border border-paper/10 bg-ink/40">
                        {f.tag}
                      </span>
                    </div>

                    <h3 className="font-display text-lg font-bold text-paper mb-2">
                      {f.title}
                    </h3>
                    <p className="text-xs text-mist leading-relaxed">
                      {f.description}
                    </p>

                    {/* Mini demo */}
                    <div className="flex-1 flex items-end">
                      <MiniDemo type={f.demo} />
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
