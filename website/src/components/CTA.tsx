import { ArrowRight, Github } from "lucide-react";
import { Reveal } from "./shared/Reveal";
import { MagneticButton } from "./shared/MagneticButton";
import { Seal } from "./shared/Seal";
import { InkBrush } from "./shared/InkBrush";

export function CTA() {
  return (
    <section className="relative section-padding py-32">
      <div className="max-w-4xl mx-auto">
        <Reveal variant="ink-spread" duration={1.2}>
          <div className="relative rounded-3xl overflow-hidden premium-border depth-shadow">
            {/* 背景 */}
            <div className="absolute inset-0 bg-gradient-to-br from-paper/[0.04] via-ink2 to-cinnabar/[0.06]" />
            <div className="absolute inset-0 bg-grid opacity-15" />
            <div className="absolute inset-0 bg-feibai opacity-30" />

            {/* 墨晕层次 */}
            <div
              className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-[0.06] blur-3xl animate-aurora"
              style={{ background: "radial-gradient(circle, #f2efe6, transparent 70%)" }}
            />
            <div
              className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full opacity-[0.08] blur-3xl animate-aurora"
              style={{ background: "radial-gradient(circle, #a83232, transparent 70%)", animationDelay: "5s" }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-[0.04] blur-3xl animate-aurora"
              style={{ background: "radial-gradient(circle, #9a9a9a, transparent 70%)", animationDelay: "3s" }}
            />

            {/* 旋转锥形渐变边框 */}
            <div
              className="absolute -inset-px rounded-3xl opacity-25 pointer-events-none"
              style={{
                background: "conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(242,239,230,0.2) 90deg, transparent 180deg, rgba(168,50,50,0.25) 270deg, transparent 360deg)",
                animation: "spin 20s linear infinite",
              }}
            />

            {/* 内容 */}
            <div className="relative px-8 py-16 md:py-20 text-center">
              {/* 印章徽章 */}
              <div className="inline-flex items-center gap-3 mb-8">
                <Seal char="创" size="md" animated />
              </div>

              <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Motion design,
                <br />
                <span className="gradient-text-animated text-glow">where your agent designs</span>
              </h2>

              {/* 笔触装饰 */}
              <div className="mb-8">
                <InkBrush className="max-w-xs mx-auto" />
              </div>

              <p className="font-mono text-sm text-mist max-w-xl mx-auto mb-10 leading-relaxed">
                Whether you're motion-curious or an easing expert, OpenMotion lets you
                stretch, bounce, and squash your ideas — then ship them as living artifacts
                and reusable skills.
              </p>

              {/* CTA 磁吸按钮 */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                <MagneticButton href="#top" variant="primary" strength={0.25}>
                  Launch Editor
                  <ArrowRight className="w-4 h-4" />
                </MagneticButton>
                <MagneticButton href="https://github.com/Yuan-ManX/open-motion" variant="secondary" strength={0.2}>
                  <Github className="w-4 h-4" />
                  Star on GitHub
                </MagneticButton>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
