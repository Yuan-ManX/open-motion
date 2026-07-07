import { useEffect, useState } from "react";
import { Github, Menu, X, ArrowUpRight } from "lucide-react";

const NAV_LINKS = [
  { href: "#philosophy", label: "Philosophy" },
  { href: "#features", label: "Features" },
  { href: "#demo", label: "Live Agent" },
  { href: "#lab", label: "Motion Lab" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "py-2.5 bg-ink/80 backdrop-blur-2xl border-b border-paper/[0.06]"
          : "py-5 bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        {/* Logo - 印章风格 */}
        <a href="#top" className="flex items-center gap-3 group">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-md seal">
            <span className="relative font-serif font-bold text-paper text-base">墨</span>
          </span>
          <span className="font-display font-semibold text-base tracking-tight text-paper">
            Open<span className="text-mist">Motion</span>
          </span>
        </a>

        {/* 导航链接 - 紧凑居中 */}
        <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-2.5 py-1 rounded-full text-[12px] text-mist hover:text-paper hover:bg-paper/[0.05] transition-all duration-300 font-mono"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* 右侧操作 */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/Yuan-ManX/open-motion"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono text-mist border border-paper/[0.08] hover:border-paper/[0.2] hover:bg-paper/[0.03] transition-all duration-300"
          >
            <Github className="w-3.5 h-3.5" />
            Star
          </a>
          <a
            href="#lab"
            className="hidden sm:inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-mono text-ink bg-paper hover:bg-paper/90 transition-all duration-300 group/launch"
          >
            Launch
            <ArrowUpRight className="w-3 h-3 transition-transform group-hover/launch:translate-x-0.5 group-hover/launch:-translate-y-0.5" />
          </a>
          <button
            className="md:hidden p-2 rounded-full text-mist hover:text-paper hover:bg-paper/[0.05] transition-colors"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* 移动端菜单 */}
      {open && (
        <div className="md:hidden px-6 pt-3 pb-4 bg-ink/95 backdrop-blur-2xl border-b border-paper/[0.06]">
          <div className="flex flex-col gap-0.5">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-lg text-sm text-mist hover:text-paper hover:bg-paper/[0.04] font-mono transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#lab"
              className="mt-2 px-4 py-2.5 rounded-lg text-sm text-ink text-center bg-paper font-mono"
            >
              Launch Editor
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
