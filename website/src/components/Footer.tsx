import { ArrowUp } from "lucide-react";

const LINKS = {
  product: [
    { label: "Editor", href: "#top" },
    { label: "API", href: "#top" },
    { label: "Templates", href: "#top" },
    { label: "Skills", href: "#top" },
  ],
  developers: [
    { label: "GitHub", href: "https://github.com/Yuan-ManX/open-motion" },
    { label: "Documentation", href: "https://github.com/Yuan-ManX/open-motion#readme" },
    { label: "Contributing", href: "https://github.com/Yuan-ManX/open-motion/blob/main/CONTRIBUTING.md" },
    { label: "License", href: "https://github.com/Yuan-ManX/open-motion/blob/main/LICENSE" },
  ],
  community: [
    { label: "Star History", href: "https://star-history.com/#Yuan-ManX/open-motion&Date" },
    { label: "Issues", href: "https://github.com/Yuan-ManX/open-motion/issues" },
    { label: "Pull Requests", href: "https://github.com/Yuan-ManX/open-motion/pulls" },
    { label: "Discussions", href: "https://github.com/Yuan-ManX/open-motion/discussions" },
  ],
};

export function Footer() {
  return (
    <footer className="relative section-padding pt-20 pb-10 border-t border-edge">
      {/* 渐变分割线 */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cinnabar/40 to-transparent" />

      <div className="max-w-6xl mx-auto">
        {/* 主体 */}
        <div className="grid md:grid-cols-5 gap-8 mb-12">
          {/* 品牌 */}
          <div className="md:col-span-2">
            <h3 className="font-display text-2xl font-bold gradient-text mb-3">
              OpenMotion
            </h3>
            <p className="text-sm text-stone leading-relaxed max-w-xs">
              The AI-Native Motion Design Platform. Motion as code, conversation as cursor, skill as currency.
            </p>
          </div>

          {/* 链接列 */}
          {Object.entries(LINKS).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-mono text-xs uppercase tracking-wider text-slate mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.href.startsWith("http") ? "_blank" : undefined}
                      rel="noreferrer"
                      className="text-sm text-mist hover:text-cinnabar transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between pt-8 border-t border-edge">
          <span className="text-xs text-slate font-mono">© 2026 OpenMotion</span>
          <a
            href="#top"
            className="group inline-flex items-center gap-1.5 text-slate hover:text-cinnabar transition-colors"
            aria-label="Back to top"
          >
            <ArrowUp className="w-3 h-3 group-hover:-translate-y-0.5 transition-transform" />
            <span className="font-mono text-[10px] uppercase tracking-wider">Top</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
