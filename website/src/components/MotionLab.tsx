import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Reveal } from "./shared/Reveal";

interface Demo {
  name: string;
  code: string;
  animation: string;
  render: (key: number) => React.ReactNode;
}

const DEMOS: Demo[] = [
  {
    name: "Fade In",
    code: "opacity: 0 → 1",
    animation: "lab-fade 2s ease-in-out infinite",
    render: (key) => (
      <div key={key} className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent to-accent2" style={{ animation: "lab-fade 2s ease-in-out infinite" }} />
    ),
  },
  {
    name: "Rotate",
    code: "transform: rotate(0 → 360)",
    animation: "lab-rotate 3s linear infinite",
    render: (key) => (
      <div key={key} className="w-16 h-16 rounded-lg bg-gradient-to-br from-accent2 to-magenta" style={{ animation: "lab-rotate 3s linear infinite" }} />
    ),
  },
  {
    name: "Scale",
    code: "transform: scale(1 → 1.4)",
    animation: "lab-scale 2s ease-in-out infinite",
    render: (key) => (
      <div key={key} className="w-12 h-12 rounded-full bg-gradient-to-br from-magenta to-accent" style={{ animation: "lab-scale 2s ease-in-out infinite" }} />
    ),
  },
  {
    name: "Spring",
    code: "cubic-bezier spring",
    animation: "lab-spring 1.5s ease-in-out infinite",
    render: (key) => (
      <div key={key} className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-magenta" style={{ animation: "lab-spring 1.5s ease-in-out infinite" }} />
    ),
  },
  {
    name: "Bounce",
    code: "translateY bounce",
    animation: "lab-bounce 1.5s ease-in-out infinite",
    render: (key) => (
      <div key={key} className="w-12 h-12 rounded-full bg-gradient-to-br from-accent2 to-accent" style={{ animation: "lab-bounce 1.5s ease-in-out infinite" }} />
    ),
  },
  {
    name: "Squash & Stretch",
    code: "scaleX ↔ scaleY",
    animation: "lab-squash 1.2s ease-in-out infinite",
    render: (key) => (
      <div key={key} className="w-14 h-14 rounded-xl bg-gradient-to-br from-magenta to-accent2" style={{ animation: "lab-squash 1.2s ease-in-out infinite" }} />
    ),
  },
];

export function MotionLab() {
  const [replayKeys, setReplayKeys] = useState<number[]>(DEMOS.map(() => 0));

  const replay = (index: number) => {
    setReplayKeys((prev) => prev.map((k, i) => (i === index ? k + 1 : k)));
  };

  return (
    <section id="lab" className="relative section-padding py-32 scroll-mt-20">
      {/* Lab animation keyframes */}
      <style>{`
        @keyframes lab-fade {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        @keyframes lab-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes lab-scale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.4); }
        }
        @keyframes lab-spring {
          0% { transform: scale(1, 1); }
          30% { transform: scale(1.3, 0.7); }
          50% { transform: scale(0.85, 1.15); }
          70% { transform: scale(1.1, 0.9); }
          100% { transform: scale(1, 1); }
        }
        @keyframes lab-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-30px); }
        }
        @keyframes lab-squash {
          0%, 100% { transform: scaleX(1) scaleY(1); }
          25% { transform: scaleX(1.3) scaleY(0.7); }
          75% { transform: scaleX(0.7) scaleY(1.3); }
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-20">
            <div className="section-label">// Motion Lab</div>
            <h2 className="section-title">
              See it <span className="gradient-text">in motion</span>
            </h2>
            <p className="section-subtitle">
              Six primitives running live in your browser — click to replay
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {DEMOS.map((demo, i) => (
            <Reveal key={demo.name} delay={i * 80}>
              <div className="group relative p-6 rounded-2xl glass-hover h-full">
                {/* Demo area */}
                <div className="relative h-32 flex items-center justify-center mb-4 rounded-xl bg-ink/50 overflow-hidden">
                  {/* Grid background */}
                  <div className="absolute inset-0 bg-grid opacity-30" />
                  {demo.render(replayKeys[i])}
                </div>

                {/* Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">
                      {demo.name}
                    </h3>
                    <p className="font-mono text-[10px] text-gray-500 mt-0.5">
                      {demo.code}
                    </p>
                  </div>
                  <button
                    onClick={() => replay(i)}
                    className="w-8 h-8 rounded-lg glass flex items-center justify-center text-gray-400 hover:text-accent hover:border-accent/40 transition-all"
                    aria-label={`Replay ${demo.name}`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
