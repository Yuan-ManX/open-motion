import { Code2, MousePointer2, Coins } from "lucide-react";
import { Reveal } from "./shared/Reveal";

const PRINCIPLES = [
  {
    icon: Code2,
    title: "Motion as Code",
    subtitle: "动画即代码",
    description:
      "No import, no export pipeline. The animation IS the page. Every motion lives as production-ready CSS, JSON, or React — the same artifact that runs in your browser is the artifact you ship.",
    gradient: "from-accent to-accent2",
    glow: "rgba(99,102,241,0.3)",
    color: "#6366F1",
  },
  {
    icon: MousePointer2,
    title: "Conversation as Cursor",
    subtitle: "对话即光标",
    description:
      "You describe intent; the agent edits the curve, the timing, the layer. Natural language is the new timeline — every word shapes a keyframe, every sentence choreographs a scene.",
    gradient: "from-accent2 to-magenta",
    glow: "rgba(34,211,238,0.3)",
    color: "#22D3EE",
  },
  {
    icon: Coins,
    title: "Skill as Currency",
    subtitle: "技能即资产",
    description:
      "A great animation becomes a reusable primitive any AI agent can call. Package any motion as a self-contained skill — the same unit flows across projects, teams, and agent workflows.",
    gradient: "from-magenta to-violet",
    glow: "rgba(236,72,153,0.3)",
    color: "#EC4899",
  },
];

export function Philosophy() {
  return (
    <section id="philosophy" className="relative section-padding py-32 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-20">
            <div className="section-label">// Founding Principles</div>
            <h2 className="section-title">
              Three ideas that <span className="gradient-text">change everything</span>
            </h2>
            <p className="section-subtitle">
              OpenMotion rethinks motion design from first principles
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 150}>
              <div
                className="group relative h-full p-8 rounded-2xl glass-hover overflow-hidden perspective-1000 transition-all duration-500 hover:-translate-y-2"
              >
                {/* Hover glow */}
                <div
                  className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(400px circle at 50% 0%, ${p.glow}, transparent 70%)` }}
                />

                {/* Top gradient bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 opacity-50 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(to right, ${p.color}, transparent)` }}
                />

                {/* Icon with glow */}
                <div className="relative mb-6">
                  <div
                    className="absolute inset-0 rounded-xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(to bottom right, ${p.color}, transparent)` }}
                  />
                  <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500`}>
                    <p.icon className="w-7 h-7 text-white" />
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-display text-2xl font-bold text-white mb-1">
                  {p.title}
                </h3>
                <p className="font-mono text-xs text-gray-500 mb-4">{p.subtitle}</p>

                {/* Description */}
                <p className="text-sm text-gray-400 leading-relaxed">
                  {p.description}
                </p>

                {/* Number watermark */}
                <div className="absolute top-6 right-6 font-display text-6xl font-bold text-white/[0.03] group-hover:text-white/[0.08] transition-colors">
                  0{i + 1}
                </div>

                {/* Corner accent */}
                <div
                  className="absolute bottom-0 right-0 w-20 h-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(circle at bottom right, ${p.color}20, transparent 70%)`,
                  }}
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
