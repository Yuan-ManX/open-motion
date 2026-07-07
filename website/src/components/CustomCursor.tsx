import { useEffect, useState, useRef } from "react";

export function CustomCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const rafRef = useRef<number>();
  const targetRef = useRef({ x: -100, y: -100 });
  const currentRef = useRef({ x: -100, y: -100 });

  useEffect(() => {
    const animate = () => {
      const target = targetRef.current;
      const current = currentRef.current;

      const dx = target.x - current.x;
      const dy = target.y - current.y;

      current.x += dx * 0.15;
      current.y += dy * 0.15;

      setPos({ x: current.x, y: current.y });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
      setIsVisible(true);
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, [role='button']")) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    const onLeave = () => setIsVisible(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 pointer-events-none z-[9999]"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Outer ring */}
      <div
        className="absolute rounded-full border border-cinnabar/40"
        style={{
          width: isHovering ? 48 : 32,
          height: isHovering ? 48 : 32,
          left: isHovering ? -24 : -16,
          top: isHovering ? -24 : -16,
          transition: "width 0.3s ease, height 0.3s ease, left 0.3s ease, top 0.3s ease",
        }}
      />
      {/* Inner dot */}
      <div
        className="absolute rounded-full bg-cinnabar"
        style={{
          width: isHovering ? 8 : 4,
          height: isHovering ? 8 : 4,
          left: isHovering ? -4 : -2,
          top: isHovering ? -4 : -2,
          boxShadow: "0 0 10px rgba(168, 50, 50, 0.8)",
          transition: "width 0.3s ease, height 0.3s ease, left 0.3s ease, top 0.3s ease",
        }}
      />
    </div>
  );
}
