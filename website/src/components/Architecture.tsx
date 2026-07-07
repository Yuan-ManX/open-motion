import { Library, Bot, Play, GitBranch, ArrowRight } from "lucide-react";
import { Reveal } from "./shared/Reveal";

const PILLARS = [
  {
    icon: Library,
    name: "Template Library",
    description: "A curated, ever-growing set of top-tier motion templates, alive on arrival.",
    color: "#a83232",
    step: "01",
  },
  {
    icon: Bot,
    name: "Motion Agent",
    description: "The conversational core — translates intent into precise parameter and keyframe changes.",
    color: "#c0392b",
    step: "02",
  },
  {
    icon: Play,
    name: "Live Runtime",
    description: "Runs animations in real web pages and video frames; the same surface that ships.",
    color: "#8b6f47",
    step: "03",
  },
  {
    icon: GitBranch,
    name: "Skill Pipeline",
    description: "Packages any motion into a self-contained, AI-callable, reusable unit.",
    color: "#9a9a9a",
    step: "04",
  },
];

const LOOP_STEPS = ["select", "run", "refine", "ship", "reuse"];

export function Architecture() {
  return (
    <section id="architecture" className="relative section-padding py-32 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-20">
            <div className="section-label">// Architecture</div>
            <h2 className="section-title">
              Four pillars, <span className="gradient-text">one closed loop</span>
            </h2>
            <p className="section-subtitle">
              select → run → refine → ship → reuse
            </p>
          </div>
        </Reveal>

        {/* Pillars grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {PILLARS.map((p, i) => (
            <Reveal key={p.name} delay={i * 120}>
              <div className="group relative h-full p-6 rounded-2xl glass-hover transition-all duration-500 hover:-translate-y-2">
                {/* Glow background */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(200px circle at 50% 0%, ${p.color}15, transparent 70%)` }}
                />

                {/* Step number + icon */}
                <div className="relative flex items-center justify-between mb-4">
                  <div
                    className="relative w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
                    style={{ background: `${p.color}20`, border: `1px solid ${p.color}40` }}
                  >
                    <p.icon className="w-6 h-6" style={{ color: p.color }} />
                    {/* Pulse ring on hover */}
                    <div
                      className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 animate-pulse-ring"
                      style={{ border: `1px solid ${p.color}` }}
                    />
                  </div>
                  <span className="font-display text-4xl font-bold text-paper/[0.05] group-hover:text-paper/[0.12] transition-colors">
                    {p.step}
                  </span>
                </div>

                <h3 className="font-display text-base font-bold text-paper mb-2">
                  {p.name}
                </h3>
                <p className="text-xs text-mist leading-relaxed">
                  {p.description}
                </p>

                {/* Bottom accent line */}
                <div
                  className="absolute bottom-0 left-6 right-6 h-px opacity-30 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(to right, ${p.color}, transparent)` }}
                />
              </div>
            </Reveal>
          ))}
        </div>

        {/* Loop visualization */}
        <Reveal delay={200}>
          <div className="relative p-8 rounded-2xl glass">
            <div className="text-center mb-8">
              <span className="font-mono text-xs text-mist uppercase tracking-wider">The closed loop</span>
            </div>

            <div className="relative flex items-center justify-center gap-2 md:gap-4">
              {LOOP_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-2 md:gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl glass flex items-center justify-center font-mono text-xs md:text-sm text-paper hover:scale-110 hover:border-cinnabar/40 transition-all cursor-default group"
                    >
                      {step}
                      {/* Glow on hover */}
                      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-cinnabar/10" />
                    </div>
                    <span className="font-mono text-[10px] text-stone">{i + 1}</span>
                  </div>
                  {i < LOOP_STEPS.length - 1 && (
                    <div className="flex items-center">
                      <div className="relative w-8 md:w-12 h-px bg-gradient-to-r from-cinnabar/40 to-cinnabar2/40 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cinnabar2 to-transparent animate-marquee" style={{ animationDuration: "3s" }} />
                        <ArrowRight className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-cinnabar2/60" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {/* Loop back indicator */}
              <div className="hidden md:flex flex-col items-center ml-4 gap-1">
                <div className="text-cinnabar text-2xl animate-spin-slow">↺</div>
                <span className="font-mono text-[9px] text-stone">loops</span>
              </div>
            </div>

            {/* Loop description */}
            <div className="mt-8 pt-6 border-t border-edge text-center">
              <p className="font-mono text-xs text-mist leading-relaxed">
                Every shipped motion becomes a skill. Every skill feeds the next project.
                <span className="text-cinnabar2"> The loop never breaks — it compounds.</span>
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
