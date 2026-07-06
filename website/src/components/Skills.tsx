import { useState, useEffect, useRef } from "react";
import { Terminal, Package, Layers, Palette, Film, Sparkles, Zap, Wand2, Move3d } from "lucide-react";
import { Reveal } from "./shared/Reveal";

const SKILL_CATEGORIES = [
  { icon: Move3d, name: "Spring Physics", tag: "physics", color: "from-accent to-accent2" },
  { icon: Palette, name: "Gradient Morph", tag: "gradient", color: "from-magenta to-accent" },
  { icon: Film, name: "MP4 Export", tag: "export", color: "from-accent2 to-teal-400" },
  { icon: Layers, name: "SVG Animation", tag: "svg", color: "from-accent to-magenta" },
  { icon: Wand2, name: "AI Generated", tag: "ai", color: "from-magenta to-purple-500" },
  { icon: Sparkles, name: "Particle FX", tag: "particles", color: "from-accent2 to-accent" },
];

const SAMPLE_CODES = [
  {
    title: "Spring Entrance",
    tag: "spring",
    code: `const skill = await createSkill({
  name: "Hero Spring Entrance",
  description: "Bouncy spring reveal for hero",
  type: "css-animation",
  keyframes: {
    "0%": { opacity: 0, y: 40, scale: 0.9 },
    "60%": { opacity: 1, y: -8, scale: 1.02 },
    "100%": { opacity: 1, y: 0, scale: 1 },
  },
  easing: { type: "spring", stiffness: 180, damping: 14 },
  duration: 1200,
});`,
  },
  {
    title: "Gradient Flow",
    tag: "gradient",
    code: `const skill = await createSkill({
  name: "Aurora Gradient Flow",
  description: "Animated gradient background",
  type: "css-animation",
  background: "linear-gradient(90deg, #6366f1, #22d3ee, #ec4899)",
  animation: {
    backgroundSize: "200% 100%",
    duration: 4000,
    iterationCount: "infinite",
  },
});`,
  },
  {
    title: "Particle Burst",
    tag: "particles",
    code: `const skill = await createSkill({
  name: "Confetti Burst",
  description: "Celebration particle explosion",
  type: "canvas-particles",
  count: 50,
  colors: ["#6366F1", "#22D3EE", "#EC4899"],
  physics: { gravity: 0.3, friction: 0.98 },
  duration: 2000,
});`,
  },
];

export function Skills() {
  const [activeTab, setActiveTab] = useState(0);
  const [typingIndex, setTypingIndex] = useState(0);
  const typingRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setTypingIndex(0);
    const code = SAMPLE_CODES[activeTab].code;

    const typeNext = () => {
      setTypingIndex((prev) => {
        if (prev < code.length) {
          typingRef.current = setTimeout(typeNext, 8);
          return prev + 2;
        }
        return prev;
      });
    };

    typingRef.current = setTimeout(typeNext, 200);
    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, [activeTab]);

  const highlightCode = (line: string) => {
    return line
      .replace(/(\/\/.*$)/g, '<span class="text-gray-600">$1</span>')
      .replace(/(const|await|export|default|return|if|else|for|while)/g, '<span class="text-accent2">$1</span>')
      .replace(/(\".*?\"|\'.*?\')/g, '<span class="text-magenta">$1</span>')
      .replace(/(\b\d+\b)/g, '<span class="text-accent">$1</span>')
      .replace(/(name|description|type|keyframes|easing|duration|background|animation|count|colors|physics)/g, '<span class="text-yellow-400/80">$1</span>')
      .replace(/(opacity|scale|y|x|rotate|backgroundSize|iterationCount|gravity|friction)/g, '<span class="text-teal-400/80">$1</span>');
  };

  return (
    <section id="skills" className="relative section-padding py-32 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <div className="section-label">// Skill Pipeline</div>
            <h2 className="section-title">
              Motion becomes a <span className="gradient-text">transferable unit</span>
            </h2>
            <p className="section-subtitle">
              Package any animation as an AI-callable skill
            </p>
          </div>
        </Reveal>

        {/* Skill categories grid */}
        <Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-16">
            {SKILL_CATEGORIES.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.name}
                  className="group relative p-4 rounded-xl glass border border-edge hover:border-accent/30 transition-all duration-300 cursor-pointer hover:-translate-y-1"
                  style={{ transitionDelay: `${idx * 50}ms` }}
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${cat.color} p-0.5 mb-3`}>
                    <div className="w-full h-full rounded-[7px] bg-panel flex items-center justify-center">
                      <Icon className="w-5 h-5 text-white/90" />
                    </div>
                  </div>
                  <div className="font-display text-sm font-bold text-white group-hover:gradient-text transition-all">
                    {cat.name}
                  </div>
                  <div className="font-mono text-[10px] text-gray-600 mt-0.5">
                    #{cat.tag}
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Code block */}
          <div className="lg:col-span-3">
            <Reveal>
              <div className="relative rounded-2xl overflow-hidden border border-edge bg-ink/80">
                {/* Tab bar */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-edge bg-panel">
                  <div className="flex gap-1.5 mr-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex gap-1">
                    {SAMPLE_CODES.map((sample, i) => (
                      <button
                        key={sample.title}
                        onClick={() => setActiveTab(i)}
                        className={`px-3 py-1 rounded-md font-mono text-[11px] transition-all ${
                          activeTab === i
                            ? "bg-accent/10 text-accent border border-accent/20"
                            : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                        }`}
                      >
                        {sample.title}.ts
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code content */}
                <pre className="p-5 font-mono text-xs leading-relaxed text-gray-300 overflow-x-auto max-h-[420px]">
                  <code>
                    {SAMPLE_CODES[activeTab].code.split("\n").map((line, i) => {
                      const visibleUpTo = typingIndex;
                      const lineStart = SAMPLE_CODES[activeTab].code.split("\n").slice(0, i).join("\n").length + i;
                      const lineEnd = lineStart + line.length;
                      const isVisible = lineStart < visibleUpTo;
                      return (
                        <div key={i} className="flex">
                          <span className="text-gray-700 select-none w-8 flex-shrink-0">{i + 1}</span>
                          <span
                            className="text-gray-300"
                            style={{ opacity: isVisible ? 1 : 0 }}
                            dangerouslySetInnerHTML={{ __html: highlightCode(line) }}
                          />
                        </div>
                      );
                    })}
                  </code>
                </pre>

                {/* Status bar */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-edge bg-panel/50">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-accent2" />
                    <span className="font-mono text-[10px] text-gray-500">
                      {Math.min(typingIndex, SAMPLE_CODES[activeTab].code.length)} chars
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="font-mono text-[10px] text-gray-500">TypeScript</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Flow steps */}
          <div className="lg:col-span-2">
            <Reveal delay={150}>
              <div className="space-y-3">
                {[
                  { num: "01", icon: Palette, label: "Design", desc: "Craft motion in the visual editor", color: "#6366F1" },
                  { num: "02", icon: Package, label: "Package", desc: "Wrap as self-contained skill", color: "#22D3EE" },
                  { num: "03", icon: Sparkles, label: "Invoke", desc: "Any AI agent can call it", color: "#EC4899" },
                  { num: "04", icon: Layers, label: "Reuse", desc: "Apply across all projects", color: "#8B5CF6" },
                ].map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="relative">
                      <div className="group flex items-center gap-4 p-4 rounded-xl glass-hover border border-edge/50 hover:border-accent/20 transition-all">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-mono text-sm font-bold flex-shrink-0 transition-transform group-hover:scale-110"
                          style={{ background: `${step.color}15`, color: step.color, border: `1px solid ${step.color}30` }}
                        >
                          {step.num}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                            {step.label}
                            <Icon className="w-4 h-4 text-gray-500 group-hover:text-accent transition-colors" />
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                        </div>
                      </div>
                      {i < 3 && (
                        <div className="flex justify-center py-1.5">
                          <div className="w-px h-4 bg-gradient-to-b from-edge to-transparent" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Loop badge */}
                <div className="mt-4 p-4 rounded-xl border border-dashed border-accent/20 bg-accent/5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-400">Continuous iteration loop</span>
                    <span className="text-accent text-xl animate-spin-slow">↻</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
