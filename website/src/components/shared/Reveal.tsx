import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealVariant = "fade" | "slide-up" | "slide-left" | "scale" | "ink-spread";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
  variant?: RevealVariant;
  duration?: number;
}

export function Reveal({
  children,
  delay = 0,
  className = "",
  y = 40,
  variant = "slide-up",
  duration = 0.8,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const getHiddenStyle = (): React.CSSProperties => {
    switch (variant) {
      case "fade":
        return { opacity: 0 };
      case "slide-left":
        return { opacity: 0, transform: `translateX(${y}px)` };
      case "scale":
        return { opacity: 0, transform: "scale(0.92)" };
      case "ink-spread":
        return {
          opacity: 0,
          transform: "scale(0.85)",
          filter: "blur(8px)",
        };
      case "slide-up":
      default:
        return { opacity: 0, transform: `translateY(${y}px)` };
    }
  };

  const getVisibleStyle = (): React.CSSProperties => {
    switch (variant) {
      case "fade":
        return { opacity: 1 };
      case "slide-left":
        return { opacity: 1, transform: "translateX(0)" };
      case "scale":
        return { opacity: 1, transform: "scale(1)" };
      case "ink-spread":
        return { opacity: 1, transform: "scale(1)", filter: "blur(0px)" };
      case "slide-up":
      default:
        return { opacity: 1, transform: "translateY(0)" };
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...(visible ? getVisibleStyle() : getHiddenStyle()),
        transition: `opacity ${duration}s ease-out ${delay}ms, transform ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, filter ${duration}s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

interface StaggerRevealProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  variant?: RevealVariant;
  duration?: number;
}

export function StaggerReveal({
  children,
  className = "",
  stagger = 80,
  variant = "slide-up",
  duration = 0.8,
}: StaggerRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const childArray = Array.isArray(children) ? children : [children];

  const getHiddenStyle = (variant: RevealVariant): React.CSSProperties => {
    switch (variant) {
      case "fade": return { opacity: 0 };
      case "scale": return { opacity: 0, transform: "scale(0.92)" };
      case "ink-spread": return { opacity: 0, transform: "scale(0.85)", filter: "blur(8px)" };
      case "slide-left": return { opacity: 0, transform: "translateX(40px)" };
      default: return { opacity: 0, transform: "translateY(40px)" };
    }
  };

  const getVisibleStyle = (variant: RevealVariant): React.CSSProperties => {
    switch (variant) {
      case "fade": return { opacity: 1 };
      case "scale": return { opacity: 1, transform: "scale(1)" };
      case "ink-spread": return { opacity: 1, transform: "scale(1)", filter: "blur(0px)" };
      case "slide-left": return { opacity: 1, transform: "translateX(0)" };
      default: return { opacity: 1, transform: "translateY(0)" };
    }
  };

  return (
    <div ref={ref} className={className}>
      {childArray.map((child, i) => (
        <div
          key={i}
          style={{
            ...(visible ? getVisibleStyle(variant) : getHiddenStyle(variant)),
            transition: `opacity ${duration}s ease-out ${i * stagger}ms, transform ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${i * stagger}ms, filter ${duration}s ease-out ${i * stagger}ms`,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
