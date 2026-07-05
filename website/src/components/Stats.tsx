import { useEffect, useRef, useState } from "react";
import { Wrench, LayoutTemplate, FileCode2, Layers } from "lucide-react";
import { Reveal } from "./shared/Reveal";

const STATS = [
  { icon: Wrench, value: 22, label: "Agent Tools", suffix: "", color: "#6366F1" },
  { icon: LayoutTemplate, value: 11, label: "Motion Templates", suffix: "", color: "#22D3EE" },
  { icon: FileCode2, value: 7, label: "Export Formats", suffix: "", color: "#EC4899" },
  { icon: Layers, value: 3, label: "Architecture Layers", suffix: "", color: "#8B5CF6" },
];

function useCountUp(target: number, duration = 1500, start = false) {
  const [count, setCount] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!start || startedRef.current) return;
    startedRef.current = true;

    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
      else setCount(target);
    };
    requestAnimationFrame(tick);
  }, [target, duration, start]);

  return count;
}

function StatCard({ stat, visible }: { stat: typeof STATS[0]; visible: boolean }) {
  const count = useCountUp(stat.value, 1800, visible);

  return (
    <div className="group relative p-6 rounded-2xl glass-hover text-center overflow-hidden">
      {/* Hover glow */}
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(300px circle at 50% 50%, ${stat.color}15, transparent 70%)` }}
      />

      <div className="relative">
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-110 group-hover:-rotate-6"
          style={{ background: `${stat.color}20`, border: `1px solid ${stat.color}40` }}
        >
          <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
        </div>

        {/* Number */}
        <div
          className="font-display text-4xl md:text-5xl font-bold mb-2 tabular-nums"
          style={{ color: stat.color, textShadow: `0 0 30px ${stat.color}40` }}
        >
          {count}{stat.suffix}
        </div>

        {/* Label */}
        <div className="font-mono text-xs text-gray-500 uppercase tracking-wider">
          {stat.label}
        </div>
      </div>
    </div>
  );
}

export function Stats() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative section-padding py-24">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center mb-12">
            <div className="section-label">// By the Numbers</div>
            <h2 className="font-display text-2xl md:text-3xl font-bold">
              Built for <span className="gradient-text">scale</span>, ready for yours
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 100}>
              <StatCard stat={stat} visible={visible} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
