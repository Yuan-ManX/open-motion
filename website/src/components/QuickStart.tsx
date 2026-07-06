import { useEffect, useState } from "react";
import { Terminal, Copy, Check } from "lucide-react";
import { Reveal } from "./shared/Reveal";

const COMMANDS = [
  { prompt: "$", text: "git clone https://github.com/Yuan-ManX/open-motion.git", delay: 30 },
  { prompt: "$", text: "cd open-motion", delay: 20 },
  { prompt: "$", text: "npm install", delay: 40 },
  { prompt: "$", text: "npm run dev", delay: 30 },
  { prompt: "✓", text: "Frontend ready → http://localhost:4000", delay: 20, success: true },
  { prompt: "✓", text: "Backend ready  → http://localhost:7000", delay: 20, success: true },
  { prompt: "✓", text: "Website ready  → http://localhost:5000", delay: 20, success: true },
];

function useTypewriterSequence() {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (lineIndex >= COMMANDS.length) {
      setDone(true);
      return;
    }

    const currentLine = COMMANDS[lineIndex];

    if (charIndex < currentLine.text.length) {
      const timer = setTimeout(() => {
        setCharIndex((c) => c + 1);
      }, currentLine.delay);
      return () => clearTimeout(timer);
    }

    const nextTimer = setTimeout(() => {
      setLineIndex((l) => l + 1);
      setCharIndex(0);
    }, 300);
    return () => clearTimeout(nextTimer);
  }, [lineIndex, charIndex]);

  return { lineIndex, charIndex, done };
}

export function QuickStart() {
  const { lineIndex, charIndex, done } = useTypewriterSequence();
  const [copied, setCopied] = useState(false);

  const fullCommand = "git clone https://github.com/Yuan-ManX/open-motion.git && cd open-motion && npm install && npm run dev";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <section id="start" className="relative section-padding py-32 scroll-mt-20">
      <div className="max-w-4xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <div className="section-label">// Quick Start</div>
            <h2 className="section-title">
              One command to <span className="gradient-text">launch</span>
            </h2>
            <p className="section-subtitle">
              No API key required — the mock provider works out of the box
            </p>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="relative rounded-2xl overflow-hidden border border-edge bg-ink/80 shadow-2xl shadow-accent/10">
            {/* Terminal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-edge bg-panel">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex items-center gap-2 ml-2 text-gray-500">
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="font-mono text-xs">bash — open-motion</span>
                </div>
              </div>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass text-xs text-gray-400 hover:text-accent hover:border-accent/40 transition-all"
                aria-label="Copy commands"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/* Terminal content */}
            <div className="p-6 font-mono text-sm min-h-[280px]">
              {COMMANDS.slice(0, lineIndex + 1).map((cmd, i) => {
                const isCurrentLine = i === lineIndex;
                const displayText = isCurrentLine
                  ? cmd.text.slice(0, charIndex)
                  : cmd.text;

                return (
                  <div key={i} className="flex items-start gap-3 mb-3">
                    <span className={cmd.success ? "text-green-400" : "text-accent2"}>
                      {cmd.prompt}
                    </span>
                    <span className={cmd.success ? "text-green-400/80" : "text-gray-300"}>
                      {displayText}
                      {isCurrentLine && !done && (
                        <span className="inline-block w-2 h-4 bg-accent2 ml-0.5 animate-pulse" />
                      )}
                    </span>
                  </div>
                );
              })}
              {done && (
                <div className="mt-6 pt-6 border-t border-edge">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">Ports:</span>
                    <span className="px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20">4000 · Editor</span>
                    <span className="px-2 py-0.5 rounded-md bg-accent2/10 text-accent2 border border-accent2/20">7000 · API</span>
                    <span className="px-2 py-0.5 rounded-md bg-magenta/10 text-magenta border border-magenta/20">5000 · Website</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* Additional info */}
        <Reveal delay={300}>
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
              { label: "Node.js", value: ">= 22.5" },
              { label: "License", value: "MIT" },
              { label: "Provider", value: "Mock / OpenAI" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-4 rounded-xl glass">
                <span className="font-mono text-xs text-gray-500">{item.label}</span>
                <span className="font-mono text-sm text-gray-200">{item.value}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
