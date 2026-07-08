import { useRef, useState, ReactNode } from "react";

interface MagneticButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  className?: string;
  strength?: number;
}

export function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  className = "",
  strength = 0.3,
}: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  const [transform, setTransform] = useState("");

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTransform(`translate(${x * strength}px, ${y * strength}px)`);
  };

  const handleMouseLeave = () => {
    setTransform("");
  };

  const baseClass = variant === "primary" ? "btn-primary" : "btn-secondary";
  const combined = `${baseClass} ${className} inline-flex items-center justify-center gap-2 transition-transform duration-200 ease-out`;

  const sharedProps = {
    ref,
    className: combined,
    style: { transform },
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
  };

  if (href) {
    const isInternal = href.startsWith("#");
    return (
      <a
        href={href}
        {...(isInternal ? {} : { target: "_blank", rel: "noreferrer" })}
        {...sharedProps}
      >
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} {...sharedProps}>
      {children}
    </button>
  );
}
