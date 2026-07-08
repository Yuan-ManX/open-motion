import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Reveal } from "./shared/Reveal";

const FAQS = [
  {
    q: "What makes OpenMotion different from Figma Motion?",
    a: "OpenMotion is open-source, runs locally, and treats motion as a transferable unit — not a project file. Every animation you craft can be packaged as a skill and handed to any AI agent for reuse. The same artifact that runs in your browser is the artifact you ship.",
  },
  {
    q: "Do I need an API key to start?",
    a: "No. The motion agent ships with a built-in mock provider that works out of the box. You can describe, generate, and refine animations immediately. To use a real LLM, set OPENAI_API_KEY in your environment and the agent switches providers automatically.",
  },
  {
    q: "What outputs can I export?",
    a: "Seven formats: HTML, CSS, JSON, React, MP4, GIF, and WebM. The same motion that runs live in the canvas exports directly to production-ready code or rendered video — no pipeline, no lossy conversion.",
  },
  {
    q: "How does the skill pipeline work?",
    a: "Any animation can be packaged as a self-contained skill via the API. A skill carries the full motion definition — easing, timing, keyframes — and can be invoked by any AI agent through a single call. Skills persist in the database and flow across projects, teams, and agent workflows.",
  },
  {
    q: "Is OpenMotion agent-native or human-first?",
    a: "Both. The platform exposes motion as a first-class programmable surface — queryable, editable, and composable through natural language and structured calls alike. Humans describe intent; agents execute precision. The timeline is always there when you want manual control.",
  },
  {
    q: "What's the tech stack?",
    a: "Three layers: a TypeScript agent with 22 tools, an Express backend with SQLite persistence and SSE streaming, and a React frontend with a live canvas and timeline. The MCP server exposes motion context to any agentic coding tool. All MIT-licensed and self-hostable.",
  },
  {
    q: "Can I integrate OpenMotion with my existing AI tools?",
    a: "Yes. The MCP server (stdio + streamable-http) delivers animation code and context to any MCP-compatible agent — Claude Code, Cursor, Codex, and others. All values — ease, timing, transforms — are preserved end to end.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative section-padding py-32 scroll-mt-20">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <div className="section-label">// Questions</div>
            <h2 className="section-title">
              Things people <span className="gradient-text">ask</span>
            </h2>
            <p className="section-subtitle">
              Straight answers, no marketing fluff
            </p>
          </div>
        </Reveal>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className="group rounded-2xl glass-hover overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                  aria-expanded={open === i}
                >
                  <span className="font-display text-sm md:text-base font-medium text-paper">
                    {faq.q}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                      open === i
                        ? "bg-cinnabar/20 text-cinnabar rotate-180"
                        : "bg-paper/[0.03] text-mist group-hover:text-paper"
                    }`}
                  >
                    {open === i ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                </button>

                <div
                  className="grid transition-all duration-300"
                  style={{
                    gridTemplateRows: open === i ? "1fr" : "0fr",
                  }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm text-mist leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
