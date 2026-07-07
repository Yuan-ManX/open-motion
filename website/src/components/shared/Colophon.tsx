import { useEffect, useRef, useState } from "react";

interface ColophonProps {
  text: string;
  className?: string;
  position?: "left" | "right";
  seal?: string;
  animated?: boolean;
}

export function Colophon({
  text,
  className = "",
  position = "right",
  seal,
  animated = true,
}: ColophonProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animated) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [animated]);

  return (
    <div
      ref={ref}
      className={`hidden md:flex flex-col items-center gap-4 ${className} ${
        position === "right" ? "ml-auto" : "mr-auto"
      }`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "all 1s ease-out",
      }}
    >
      {/* 竖排题跋 */}
      <div
        className="flex flex-col items-center writing-mode-vertical"
        style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
      >
        <span
          className="font-serif text-sm tracking-[0.5em] leading-loose"
          style={{
            color: "#f2efe6",
            opacity: 0.25,
            letterSpacing: "0.6em",
          }}
        >
          {text}
        </span>
        {/* 上部装饰线 */}
        <svg
          width="2"
          height={40}
          viewBox="0 0 2 40"
          fill="none"
          className="mt-2"
        >
          <line x1="1" y1="0" x2="1" y2="30" stroke="#f2efe6" strokeWidth="1" strokeOpacity={0.15} />
          <circle cx="1" cy="35" r="2" fill="#a83232" fillOpacity={0.3} />
        </svg>
      </div>

      {/* 印章 */}
      {seal && (
        <div
          className={`w-10 h-10 flex items-center justify-center font-serif font-bold text-paper/80 text-base rounded-sm ${animated && visible ? "animate-seal-stamp" : ""}`}
          style={{
            background: "linear-gradient(135deg, #c0392b, #a83232)",
            border: "1.5px solid #8b2a2a",
            boxShadow:
              "inset 0 0 6px rgba(0,0,0,0.3), 0 2px 8px rgba(168,50,50,0.2)",
            position: "relative",
            animationDelay: visible ? "0.4s" : undefined,
          }}
        >
          {seal}
        </div>
      )}
    </div>
  );
}
