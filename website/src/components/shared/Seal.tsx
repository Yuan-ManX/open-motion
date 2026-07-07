interface SealProps {
  text?: string;
  char?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  animated?: boolean;
}

export function Seal({
  text,
  char = "印",
  size = "md",
  className = "",
  animated = false,
}: SealProps) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 text-xl",
  };

  return (
    <div
      className={`seal ${sizes[size]} ${animated ? "animate-seal-stamp" : ""} ${className}`}
      title={text || char}
    >
      <span className="font-serif">{char}</span>
    </div>
  );
}
