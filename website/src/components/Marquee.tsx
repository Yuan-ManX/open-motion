import { Code2, Palette, Film, Layers, GitBranch, Sparkles, Zap, Waves, Cpu, Boxes } from "lucide-react";

const TECH_ITEMS = [
  { icon: Code2, name: "React" },
  { icon: Zap, name: "Framer Motion" },
  { icon: Palette, name: "Tailwind" },
  { icon: Film, name: "MP4 Export" },
  { icon: Layers, name: "SVG Animation" },
  { icon: GitBranch, name: "Git Native" },
  { icon: Sparkles, name: "AI Agent" },
  { icon: Waves, name: "Spring Physics" },
  { icon: Cpu, name: "MCP Server" },
  { icon: Boxes, name: "Skill Pipeline" },
];

export function Marquee() {
  const items = [...TECH_ITEMS, ...TECH_ITEMS];

  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-transparent to-ink pointer-events-none z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-transparent to-ink/50 pointer-events-none" />

      {/* 标题徽章 */}
      <div className="relative text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-premium cinnabar-border">
          <span className="w-1.5 h-1.5 rounded-full bg-cinnabar" />
          <span className="font-mono text-xs text-mist tracking-[0.2em] uppercase">
            Powered by modern motion stack
          </span>
        </div>
      </div>

      {/* 跑马灯 */}
      <div className="relative flex overflow-hidden mask-fade-edges">
        <div className="flex gap-3 animate-marquee whitespace-nowrap">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="group flex items-center gap-3 px-5 py-2.5 rounded-full glass-premium border border-paper/[0.08] hover:border-cinnabar/40 hover:bg-paper/[0.04] transition-all duration-300 flex-shrink-0"
              >
                <Icon className="w-4 h-4 text-mist group-hover:text-paper group-hover:scale-110 transition-all" />
                <span className="font-mono text-xs text-mist group-hover:text-paper transition-colors tracking-wide">
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
