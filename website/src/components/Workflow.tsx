import { MessageSquare, Sparkles, Sliders, Rocket } from "lucide-react";
import { Reveal } from "./shared/Reveal";

const STEPS = [
  {
    num: "01",
    icon: MessageSquare,
    title: "Describe",
    subtitle: "Say it in a sentence",
    description:
      "Tell the agent what you want — a feeling, a reference, a vibe. No timeline, no keyframes, no setup. Just intent in plain language.",
    color: "#6366F1",
    gradient: "from-accent/20 to-transparent",
  },
  {
    num: "02",
    icon: Sparkles,
    title: "Generate",
    subtitle: "Agent shapes the frames",
    description:
      "The motion agent picks the right template, tunes the easing curve, sets the timing. Tools fire in sequence — you watch the motion come alive.",
    color: "#22D3EE",
    gradient: "from-accent2/20 to-transparent",
  },
  {
    num: "03",
    icon: Sliders,
    title: "Refine",
    subtitle: "Fine-tune every frame",
    description:
      "Want it snappier? Softer? Longer? Switch to the timeline and adjust any keyframe, any property, any curve — or just keep talking.",
    color: "#EC4899",
    gradient: "from-magenta/20 to-transparent",
  },
  {
    num: "04",
    icon: Rocket,
    title: "Ship",
    subtitle: "Export and reuse",
    description:
      "One click to HTML, CSS, React, or video. Package it as a skill and any AI agent can replay it across projects, teams, and workflows.",
    color: "#8B5CF6",
    gradient: "from-violet/20 to-transparent",
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="relative section-padding py-32 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-20">
            <div className="section-label">// Creative Flow</div>
            <h2 className="section-title">
              From sentence to <span className="gradient-text">shipped motion</span>
            </h2>
            <p className="section-subtitle">
              Four steps — describe, generate, refine, ship
            </p>
          </div>
        </Reveal>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-24 left-[12.5%] right-[12.5%] h-px">
            <div className="w-full h-full bg-gradient-to-r from-accent/30 via-accent2/30 to-violet/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent2/60 to-transparent animate-marquee" style={{ animationDuration: "4s" }} />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 150}>
                <div className="group relative h-full">
                  {/* Number circle */}
                  <div className="relative flex items-center justify-center mb-6">
                    <div
                      className="relative w-16 h-16 rounded-2xl flex items-center justify-center font-display text-xl font-bold transition-all duration-500 group-hover:scale-110 group-hover:rotate-6"
                      style={{
                        background: `${step.color}15`,
                        border: `1px solid ${step.color}40`,
                        color: step.color,
                        boxShadow: `0 0 20px ${step.color}20`,
                      }}
                    >
                      {step.num}
                      {/* Pulse ring */}
                      <div
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 animate-pulse-ring"
                        style={{ border: `1px solid ${step.color}` }}
                      />
                    </div>
                  </div>

                  {/* Card */}
                  <div className={`relative p-6 rounded-2xl glass-hover h-full bg-gradient-to-b ${step.gradient}`}>
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                      style={{ background: `${step.color}20`, border: `1px solid ${step.color}30` }}
                    >
                      <step.icon className="w-5 h-5" style={{ color: step.color }} />
                    </div>

                    <h3 className="font-display text-lg font-bold text-white mb-1">
                      {step.title}
                    </h3>
                    <p className="font-mono text-[10px] text-gray-500 mb-3 uppercase tracking-wider">
                      {step.subtitle}
                    </p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {step.description}
                    </p>

                    {/* Bottom accent */}
                    <div
                      className="absolute bottom-0 left-6 right-6 h-px opacity-30 group-hover:opacity-100 transition-opacity"
                      style={{ background: `linear-gradient(to right, ${step.color}, transparent)` }}
                    />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <Reveal delay={400}>
          <div className="mt-16 text-center">
            <p className="font-mono text-xs text-gray-600">
              <span className="text-accent2">↺</span> The loop never ends — every shipped motion becomes a skill for the next project
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
