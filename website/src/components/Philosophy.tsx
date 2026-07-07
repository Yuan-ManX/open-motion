import { Code2, MousePointer2, Coins } from "lucide-react";
import { Reveal } from "./shared/Reveal";
import { SpotlightCard } from "./shared/SpotlightCard";
import { Seal } from "./shared/Seal";
import { InkBrush } from "./shared/InkBrush";

const PRINCIPLES = [
  {
    icon: Code2,
    title: "Motion as Code",
    subtitle: "动画即代码",
    description:
      "No import, no export pipeline. The animation IS the page. Every motion lives as production-ready CSS, JSON, or React — the same artifact that runs in your browser is the artifact you ship.",
    seal: "码",
    spotlight: "rgba(242, 239, 230, 0.08)",
  },
  {
    icon: MousePointer2,
    title: "Conversation as Cursor",
    subtitle: "对话即光标",
    description:
      "You describe intent; the agent edits the curve, the timing, the layer. Natural language is the new timeline — every word shapes a keyframe, every sentence choreographs a scene.",
    seal: "言",
    spotlight: "rgba(154, 154, 154, 0.08)",
  },
  {
    icon: Coins,
    title: "Skill as Currency",
    subtitle: "技能即资产",
    description:
      "A great animation becomes a reusable primitive any AI agent can call. Package any motion as a self-contained skill — the same unit flows across projects, teams, and agent workflows.",
    seal: "技",
    spotlight: "rgba(168, 50, 50, 0.08)",
  },
];

export function Philosophy() {
  return (
    <section id="philosophy" className="relative section-padding py-32 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <Reveal variant="ink-spread">
          <div className="text-center mb-20">
            <div className="section-label">// Founding Principles</div>
            <h2 className="section-title">
              Three ideas that <span className="gradient-text">change everything</span>
            </h2>
            <p className="section-subtitle">
              OpenMotion rethinks motion design from first principles
            </p>
            <div className="mt-6">
              <InkBrush className="max-w-xs mx-auto" />
            </div>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 150} variant="scale">
              <SpotlightCard
                spotlightColor={p.spotlight}
                className="h-full rounded-2xl"
              >
                <div className="group relative h-full p-8 rounded-2xl glass-premium overflow-hidden perspective-1000 transition-all duration-500 hover:-translate-y-2 depth-shadow-hover premium-border">
                  {/* 悬浮墨晕 */}
                  <div
                    className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: "radial-gradient(400px circle at 50% 0%, rgba(242, 239, 230, 0.05), transparent 70%)" }}
                  />

                  {/* 顶部细线 */}
                  <div className="absolute top-0 left-0 right-0 h-px opacity-50 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-paper/30 to-transparent" />

                  {/* 图标 */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-xl blur-xl opacity-30 group-hover:opacity-60 transition-opacity duration-500 bg-gradient-to-br from-paper/20 to-transparent" />
                    <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-paper/15 to-paper/5 border border-paper/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 depth-shadow">
                      <p.icon className="w-7 h-7 text-paper/90" />
                    </div>
                  </div>

                  {/* 标题 */}
                  <h3 className="font-display text-2xl font-bold text-paper mb-1">
                    {p.title}
                  </h3>
                  <p className="font-serif text-sm text-cinnabar2/80 mb-4 tracking-wider">{p.subtitle}</p>

                  {/* 描述 */}
                  <p className="text-sm text-mist leading-relaxed">
                    {p.description}
                  </p>

                  {/* 水印数字 */}
                  <div className="absolute top-6 right-6 font-display text-7xl font-bold text-paper/[0.03] group-hover:text-paper/[0.06] transition-colors pointer-events-none">
                    0{i + 1}
                  </div>

                  {/* 印章落款 */}
                  <div className="absolute bottom-6 right-6 opacity-60 group-hover:opacity-100 transition-opacity">
                    <Seal char={p.seal} size="sm" />
                  </div>

                  {/* 底部细线 */}
                  <div className="absolute bottom-0 left-8 right-8 h-px opacity-0 group-hover:opacity-50 transition-opacity duration-700 bg-gradient-to-r from-transparent via-cinnabar/40 to-transparent" />
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
