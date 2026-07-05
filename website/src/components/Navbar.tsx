import { useEffect, useState } from "react";
import { Github, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "#philosophy", label: "Philosophy" },
  { href: "#features", label: "Features" },
  { href: "#demo", label: "Live Agent" },
  { href: "#architecture", label: "Architecture" },
  { href: "#lab", label: "Motion Lab" },
  { href: "#skills", label: "Skills" },
  { href: "#faq", label: "FAQ" },
  { href: "#start", label: "Quick Start" },
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
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "py-2 bg-ink/70 backdrop-blur-xl border-b border-white/[0.06]"
          : "py-4 bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2 group">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 shadow-lg shadow-accent/30">
            <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent to-accent2 blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
            <span className="relative font-display font-bold text-white text-sm">M</span>
          </span>
          <span className="font-display font-semibold text-base tracking-tight">
            Open<span className="gradient-text">Motion</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors font-mono"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/Yuan-ManX/open-motion"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-gray-300 border border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.04] transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            Star
          </a>
          <a
            href="http://localhost:4000"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-white bg-gradient-to-r from-accent/90 to-accent2/90 hover:from-accent hover:to-accent2 transition-colors"
          >
            Launch
          </a>
          <button
            className="md:hidden p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/[0.04]"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden px-6 pt-2 pb-4 bg-ink/95 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] font-mono"
              >
                {link.label}
              </a>
            ))}
            <a
              href="http://localhost:4000"
              target="_blank"
              rel="noreferrer"
              className="mt-2 px-3 py-2 rounded-md text-sm text-white text-center bg-gradient-to-r from-accent to-accent2 font-mono"
            >
              Launch Editor
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
