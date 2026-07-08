import { useEffect, useState, useRef } from "react";
import { ArrowRight, Github, Zap } from "lucide-react";
import { MagneticButton } from "./shared/MagneticButton";
import { InkBrush } from "./shared/InkBrush";
import { InkWaves } from "./shared/InkWaves";
import { StaggerReveal } from "./shared/Reveal";

const TITLE_TEXT = "OpenMotion";

function useTypewriter(text: string, speed = 80, startDelay = 300) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const startTimer = setTimeout(() => {
      const timer = setInterval(() => {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1));
          i++;
        } else {
          setDone(true);
          clearInterval(timer);
        }
      }, speed);
      return () => clearInterval(timer);
    }, startDelay);
    return () => clearTimeout(startTimer);
  }, [text, speed, startDelay]);

  return { displayed, done };
}

function useMousePosition() {
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setPos({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
    };

    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  return { ref, pos };
}

function useScrollParallax() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrollY;
}

function FloatingInk({ pos, scrollY }: { pos: { x: number; y: number }; scrollY: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* 墨环 - ink rings with parallax */}
      <div
        className="absolute top-[15%] right-[10%] w-64 h-64 rounded-full border border-paper/[0.08]"
        style={{
          transform: `translate(${(pos.x - 0.5) * -30}px, ${(pos.y - 0.5) * -20 + scrollY * 0.15}px)`,
          transition: "transform 0.4s ease-out",
        }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cinnabar/40 shadow-lg shadow-cinnabar/50" />
      </div>

      <div
        className="absolute bottom-[20%] left-[5%] w-48 h-48 rounded-full border border-paper/[0.06]"
        style={{
          transform: `translate(${(pos.x - 0.5) * -50}px, ${(pos.y - 0.5) * -35 + scrollY * 0.25}px)`,
          transition: "transform 0.3s ease-out",
        }}
      >
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-paper/30" />
      </div>

      <div
        className="absolute top-[60%] right-[30%] w-32 h-32 rounded-full border border-paper/[0.05]"
        style={{
          transform: `translate(${(pos.x - 0.5) * -70}px, ${(pos.y - 0.5) * -50 + scrollY * 0.4}px)`,
          transition: "transform 0.2s ease-out",
        }}
      >
        <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cinnabar/30" />
      </div>

      {/* 墨点 - ink dots with parallax */}
      <div
        className="absolute top-[25%] left-[20%] w-2 h-2 rounded-full bg-paper/60 shadow-lg shadow-paper/40"
        style={{
          transform: `translate(${(pos.x - 0.5) * -40}px, ${(pos.y - 0.5) * -30 + scrollY * 0.35}px)`,
          transition: "transform 0.25s ease-out",
        }}
      />
      <div
        className="absolute bottom-[30%] right-[20%] w-1.5 h-1.5 rounded-full bg-cinnabar/50 shadow-lg shadow-cinnabar/40"
        style={{
          transform: `translate(${(pos.x - 0.5) * -60}px, ${(pos.y - 0.5) * -45 + scrollY * 0.2}px)`,
          transition: "transform 0.15s ease-out",
        }}
      />

      {/* 漂浮墨晕 - floating ink wash */}
      <div
        className="absolute top-[40%] left-[60%] w-96 h-96 rounded-full opacity-[0.025] blur-3xl"
        style={{
          background: "radial-gradient(circle, #f2efe6, transparent 70%)",
          transform: `translate(${(pos.x - 0.5) * 40}px, ${(pos.y - 0.5) * 30 + scrollY * 0.1}px)`,
          transition: "transform 0.6s ease-out",
        }}
      />
    </div>
  );
}

export function Hero() {
  const { displayed, done } = useTypewriter(TITLE_TEXT);
  const { ref, pos } = useMousePosition();
  const scrollY = useScrollParallax();

  const stats = [
    { num: "22", label: "Tools" },
    { num: "11", label: "Templates" },
    { num: "7", label: "Formats" },
    { num: "∞", label: "Skills" },
  ];

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center section-padding overflow-hidden pt-20">
      {/* 水墨波形粒子背景 */}
      <div className="absolute inset-0 z-0">
        <InkWaves />
      </div>
      <FloatingInk pos={pos} scrollY={scrollY} />

      <div className="relative z-10 max-w-4xl mx-auto w-full text-center" style={{ transform: `translateY(${scrollY * -0.05}px)` }}>
        {/* 主标题 */}
        <h1 className="font-display text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight mb-3 leading-[0.95]">
          <span className="gradient-text-animated text-glow">
            {displayed}
          </span>
          <span
            className={`inline-block w-1.5 h-[0.75em] ml-1.5 bg-cinnabar2 ${done ? "animate-blink" : ""}`}
            style={{ verticalAlign: "text-bottom" }}
          />
        </h1>

        {/* 副标题 - ink-spread 墨晕扩散 */}
        <div className="overflow-hidden">
          <p
            className="font-display text-xl md:text-2xl lg:text-3xl text-paper/90 mb-4"
            style={{
              opacity: done ? 1 : 0,
              transform: done ? "scale(1)" : "scale(0.9)",
              filter: done ? "blur(0px)" : "blur(8px)",
              transition: "all 1s cubic-bezier(0.22, 1, 0.36, 1) 0.3s",
            }}
          >
            The AI-Native <span className="text-paper">Motion Design Platform</span>
          </p>
        </div>

        {/* 描述 */}
        <p
          className="font-mono text-sm text-mist max-w-xl mx-auto mb-8 leading-relaxed"
          style={{
            opacity: done ? 1 : 0,
            transform: done ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.8s ease-out 0.5s",
          }}
        >
          The Open-Source Figma Motion Alternative, Redefining AI-Native Motion Design. Animations that live in real web pages and videos — conversational, composable, and reusable by any AI agent.
        </p>

        {/* CTA */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
          style={{
            opacity: done ? 1 : 0,
            transform: done ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.8s ease-out 0.7s",
          }}
        >
          <MagneticButton href="#top" variant="primary" strength={0.25}>
            <Zap className="w-4 h-4" />
            Launch Editor
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </MagneticButton>
          <MagneticButton href="https://github.com/Yuan-ManX/open-motion" variant="secondary" strength={0.2}>
            <Github className="w-4 h-4" />
            View Source
          </MagneticButton>
        </div>

        {/* 笔触分割 */}
        <div
          className="mt-12 mb-8"
          style={{
            opacity: done ? 1 : 0,
            transition: "all 0.8s ease-out 0.8s",
          }}
        >
          <InkBrush className="max-w-xs mx-auto" />
        </div>

        {/* 数据 - 交错出现 */}
        <StaggerReveal
          className="flex items-stretch justify-center"
          stagger={120}
          variant="ink-spread"
          duration={0.9}
        >
          {stats.map((s, i) => (
            <div key={s.label} className="flex items-stretch">
              {i > 0 && <div className="w-px bg-edge mx-5 md:mx-7 self-stretch" />}
              <div className="text-center min-w-[64px] flex flex-col justify-center">
                <div className="font-display text-3xl md:text-4xl font-bold gradient-text tabular-nums leading-none">{s.num}</div>
                <div className="font-mono text-[10px] text-stone uppercase tracking-widest mt-2">{s.label}</div>
              </div>
            </div>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}
