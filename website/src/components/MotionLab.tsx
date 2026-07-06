import { useState, useRef, useEffect } from "react";
import { RotateCcw, Sliders, Play, Pause } from "lucide-react";
import { Reveal } from "./shared/Reveal";

interface Demo {
  name: string;
  code: string;
  render: (key: number, duration: number, intensity: number) => React.ReactNode;
}

const DEMOS: Demo[] = [
  {
    name: "Fade In",
    code: "opacity: 0 → 1",
    render: (key, duration, intensity) => (
      <div
        key={key}
        className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent to-accent2 shadow-lg shadow-accent/30"
        style={{ animation: `lab-fade ${duration}ms ease-in-out infinite` }}
      />
    ),
  },
  {
    name: "Rotate",
    code: "transform: rotate(0 → 360)",
    render: (key, duration) => (
      <div
        key={key}
        className="w-16 h-16 rounded-lg bg-gradient-to-br from-accent2 to-magenta shadow-lg shadow-accent2/30"
        style={{ animation: `lab-rotate ${duration}ms linear infinite` }}
      />
    ),
  },
  {
    name: "Scale",
    code: "transform: scale(1 → 1.4)",
    render: (key, duration, intensity) => (
      <div
        key={key}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-magenta to-accent shadow-lg shadow-magenta/30"
        style={{ animation: `lab-scale ${duration}ms ease-in-out infinite`, ['--scale' as string]: `${1 + intensity * 0.6}` }}
      />
    ),
  },
  {
    name: "Spring",
    code: "cubic-bezier spring",
    render: (key, duration) => (
      <div
        key={key}
        className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-magenta shadow-lg shadow-accent/30"
        style={{ animation: `lab-spring ${duration}ms ease-in-out infinite` }}
      />
    ),
  },
  {
    name: "Bounce",
    code: "translateY bounce",
    render: (key, duration, intensity) => (
      <div
        key={key}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-accent2 to-accent shadow-lg shadow-accent2/30"
        style={{ animation: `lab-bounce ${duration}ms ease-in-out infinite`, ['--bounce' as string]: `${-20 - intensity * 30}px` }}
      />
    ),
  },
  {
    name: "Squash & Stretch",
    code: "scaleX ↔ scaleY",
    render: (key, duration, intensity) => (
      <div
        key={key}
        className="w-14 h-14 rounded-xl bg-gradient-to-br from-magenta to-accent2 shadow-lg shadow-magenta/30"
        style={{ animation: `lab-squash ${duration}ms ease-in-out infinite`, ['--squash' as string]: `${0.7 + intensity * 0.3}` }}
      />
    ),
  },
];

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
        <span className="font-mono text-xs text-accent tabular-nums">{value}{unit}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-edge accent-accent"
        />
      </div>
    </div>
  );
}

export function MotionLab() {
  const [replayKeys, setReplayKeys] = useState<number[]>(DEMOS.map(() => 0));
  const [duration, setDuration] = useState(2000);
  const [intensity, setIntensity] = useState(0.6);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeDemo, setActiveDemo] = useState(0);

  const replay = (index: number) => {
    setReplayKeys((prev) => prev.map((k, i) => (i === index ? k + 1 : k)));
  };

  const replayAll = () => {
    setReplayKeys((prev) => prev.map((k) => k + 1));
  };

  const togglePlay = () => {
    setIsPlaying((p) => !p);
  };

  return (
    <section id="lab" className="relative section-padding py-32 scroll-mt-20">
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
          50% { transform: scale(var(--scale, 1.4)); }
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
          50% { transform: translateY(var(--bounce, -50px)); }
        }
        @keyframes lab-squash {
          0%, 100% { transform: scaleX(1) scaleY(1); }
          25% { transform: scaleX(calc(1 / var(--squash, 0.7))) scaleY(var(--squash, 0.7)); }
          75% { transform: scaleX(var(--squash, 0.7)) scaleY(calc(1 / var(--squash, 0.7))); }
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366F1, #818CF8);
          cursor: pointer;
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
          transition: transform 0.15s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <div className="section-label">// Motion Lab</div>
            <h2 className="section-title">
              See it <span className="gradient-text">in motion</span>
            </h2>
            <p className="section-subtitle">
              Live interactive playground — tweak parameters and feel the motion
            </p>
          </div>
        </Reveal>

        {/* Control panel */}
        <Reveal>
          <div className="relative mb-10 p-5 rounded-2xl glass border border-edge">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Sliders className="w-4 h-4 text-accent" />
              </div>
              <div>
                <div className="font-display text-sm font-bold text-white">Motion Controls</div>
                <div className="font-mono text-[10px] text-gray-500">adjust parameters in real-time</div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Slider
                label="Duration"
                value={duration}
                onChange={setDuration}
                min={400}
                max={4000}
                unit="ms"
              />
              <Slider
                label="Intensity"
                value={Math.round(intensity * 100)}
                onChange={(v) => setIntensity(v / 100)}
                min={10}
                max={100}
                unit="%"
              />
              <div className="flex items-end gap-3">
                <button
                  onClick={togglePlay}
                  className="flex-1 h-9 rounded-lg bg-accent/10 border border-accent/20 text-accent font-mono text-xs flex items-center justify-center gap-2 hover:bg-accent/20 transition-all"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  {isPlaying ? "Pause All" : "Play All"}
                </button>
                <button
                  onClick={replayAll}
                  className="h-9 px-4 rounded-lg border border-edge text-gray-400 font-mono text-xs flex items-center gap-2 hover:text-white hover:border-gray-600 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Replay
                </button>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Demo grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {DEMOS.map((demo, i) => (
            <Reveal key={demo.name} delay={i * 80}>
              <div
                className={`group relative p-5 rounded-2xl glass-hover h-full transition-all duration-300 cursor-pointer ${
                  activeDemo === i ? "border-accent/40 shadow-lg shadow-accent/10" : ""
                }`}
                onClick={() => setActiveDemo(i)}
              >
                {/* Demo area */}
                <div className="relative h-28 flex items-center justify-center mb-4 rounded-xl bg-ink/50 overflow-hidden">
                  <div className="absolute inset-0 bg-grid opacity-20" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink/30" />
                  <div style={{ animationPlayState: isPlaying ? "running" : "paused" }}>
                    {demo.render(replayKeys[i], duration, intensity)}
                  </div>
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
                    onClick={(e) => { e.stopPropagation(); replay(i); }}
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
