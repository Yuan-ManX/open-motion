import { Code2, Palette, Film, Layers, GitBranch, Sparkles, Zap, Waves } from "lucide-react";

const TECH_ITEMS = [
  { icon: Code2, name: "React", label: "React" },
  { icon: Zap, name: "Framer Motion", label: "Motion" },
  { icon: Palette, name: "Tailwind", label: "Tailwind" },
  { icon: Film, name: "MP4 Export", label: "MP4" },
  { icon: Layers, name: "SVG Animation", label: "SVG" },
  { icon: GitBranch, name: "Git Native", label: "Git" },
  { icon: Sparkles, name: "AI Agent", label: "AI" },
  { icon: Waves, name: "Spring Physics", label: "Spring" },
];

export function Marquee() {
  const items = [...TECH_ITEMS, ...TECH_ITEMS];

  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-transparent to-ink pointer-events-none z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-transparent to-ink/50 pointer-events-none" />

      <div className="relative flex overflow-hidden">
        <div className="flex gap-4 animate-marquee whitespace-nowrap">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 px-5 py-2.5 rounded-full glass border border-edge/70 group hover:border-accent/40 hover:bg-accent/5 transition-all duration-300 flex-shrink-0"
              >
                <Icon className="w-4 h-4 text-accent/70 group-hover:text-accent transition-colors" />
                <span className="font-mono text-xs text-gray-300 group-hover:text-white transition-colors tracking-wide">
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </section>
  );
}
