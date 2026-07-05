import { Terminal, ArrowRight, Package } from "lucide-react";
import { Reveal } from "./shared/Reveal";

const SKILL_CODE = `// Package any motion as an AI-callable skill
const skill = await createSkill({
  projectId: "p_motion_hero",
  name: "Hero Fade Reveal",
  description: "A fade-in hero animation with spring easing",
  tags: ["fade", "entrance", "hero"],
});

// Any AI agent can now invoke it
const result = await invokeSkill(skill.id, {
  easing: { type: "spring", stiffness: 180, damping: 14 },
  durationMs: 1200,
  iterationCount: 1,
});

// Returns self-contained HTML
console.log(result.html); // <!DOCTYPE html>...`;

const FLOW_STEPS = [
  { label: "Design", desc: "Craft motion in the editor", color: "#6366F1" },
  { label: "Package", desc: "Wrap as self-contained skill", color: "#22D3EE" },
  { label: "Invoke", desc: "AI agent calls the skill", color: "#EC4899" },
  { label: "Reuse", desc: "Apply across projects", color: "#8B5CF6" },
];

export function Skills() {
  return (
    <section id="skills" className="relative section-padding py-32 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-20">
            <div className="section-label">// Skill Pipeline</div>
            <h2 className="section-title">
              Motion becomes a <span className="gradient-text">transferable unit</span>
            </h2>
            <p className="section-subtitle">
              Package any animation as an AI-callable skill
            </p>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Code block */}
          <Reveal>
            <div className="relative rounded-2xl overflow-hidden border border-edge bg-ink/80">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-edge bg-panel">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex items-center gap-2 ml-2 text-gray-500">
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="font-mono text-xs">skill.ts</span>
                </div>
              </div>

              {/* Code content */}
              <pre className="p-5 font-mono text-xs leading-relaxed text-gray-300 overflow-x-auto">
                <code>
                  {SKILL_CODE.split("\n").map((line, i) => (
                    <div key={i} className="flex">
                      <span className="text-gray-700 select-none w-8 flex-shrink-0">{i + 1}</span>
                      <span className="text-gray-300" dangerouslySetInnerHTML={{
                        __html: line
                          .replace(/(\/\/.*$)/g, '<span class="text-gray-600">$1</span>')
                          .replace(/(const|await|console|log)/g, '<span class="text-accent2">$1</span>')
                          .replace(/(".*?")/g, '<span class="text-magenta">$1</span>')
                          .replace(/(\b\d+\b)/g, '<span class="text-accent">$1</span>')
                      }} />
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          </Reveal>

          {/* Flow diagram */}
          <Reveal delay={150}>
            <div className="space-y-4">
              {FLOW_STEPS.map((step, i) => (
                <div key={step.label} className="relative">
                  <div className="group flex items-center gap-4 p-5 rounded-xl glass-hover">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-display text-lg font-bold flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{ background: `${step.color}20`, color: step.color, border: `1px solid ${step.color}40` }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-base font-bold text-white">
                        {step.label}
                      </h3>
                      <p className="text-xs text-gray-400">{step.desc}</p>
                    </div>
                    <Package className="w-5 h-5 text-gray-600 group-hover:text-accent transition-colors" />
                  </div>

                  {/* Connector arrow */}
                  {i < FLOW_STEPS.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowRight className="w-4 h-4 text-gray-700 rotate-90" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loop back indicator */}
              <div className="flex items-center justify-center gap-2 pt-4 text-gray-600">
                <span className="font-mono text-xs">loops back to Design</span>
                <span className="text-accent text-lg">↺</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
