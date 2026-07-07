interface InkBrushProps {
  className?: string;
  variant?: "horizontal" | "vertical" | "corner";
}

export function InkBrush({ className = "", variant = "horizontal" }: InkBrushProps) {
  if (variant === "vertical") {
    return (
      <div className={`relative flex justify-center ${className}`}>
        <svg
          width="3"
          height="120"
          viewBox="0 0 3 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 1.5 0 Q 2 30 1 60 Q 0.5 90 1.5 120"
            stroke="url(#brushGradV)"
            strokeWidth="2"
            strokeLinecap="round"
            className="brush-stroke"
          />
          <defs>
            <linearGradient id="brushGradV" x1="0" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f2efe6" stopOpacity="0" />
              <stop offset="0.3" stopColor="#f2efe6" stopOpacity="0.4" />
              <stop offset="0.7" stopColor="#9a9a9a" stopOpacity="0.3" />
              <stop offset="1" stopColor="#f2efe6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  if (variant === "corner") {
    return (
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        className={className}
      >
        <path
          d="M 5 5 Q 30 10 70 5 M 5 5 Q 10 30 5 70"
          stroke="rgba(242, 239, 230, 0.25)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        width="100%"
        height="20"
        viewBox="0 0 400 20"
        fill="none"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 0 10 Q 50 6 100 10 Q 150 14 200 9 Q 250 5 300 11 Q 350 13 400 10"
          stroke="url(#brushGradH)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          className="brush-stroke"
        />
        <defs>
          <linearGradient id="brushGradH" x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f2efe6" stopOpacity="0" />
            <stop offset="0.2" stopColor="#9a9a9a" stopOpacity="0.4" />
            <stop offset="0.5" stopColor="#f2efe6" stopOpacity="0.6" />
            <stop offset="0.8" stopColor="#9a9a9a" stopOpacity="0.4" />
            <stop offset="1" stopColor="#f2efe6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
