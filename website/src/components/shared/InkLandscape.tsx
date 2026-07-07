interface InkLandscapeProps {
  variant?: "mountain" | "water" | "cloud" | "full";
  opacity?: number;
  className?: string;
  animated?: boolean;
}

export function InkLandscape({
  variant = "mountain",
  opacity = 1,
  className = "",
  animated = false,
}: InkLandscapeProps) {
  const animClass = animated ? "animate-ink-spread" : "";

  if (variant === "water") {
    return (
      <svg
        viewBox="0 0 800 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full ${className} ${animClass}`}
        style={{ opacity }}
        preserveAspectRatio="none"
      >
        {/* 水纹层次 */}
        <path
          d="M0 140 Q100 120 200 135 T400 130 T600 138 T800 125 L800 200 L0 200 Z"
          fill="#f2efe6"
          fillOpacity={0.03}
          stroke="#f2efe6"
          strokeWidth={0.5}
          strokeOpacity={0.15}
        />
        <path
          d="M0 155 Q150 145 300 152 T500 148 T700 156 T800 150 L800 200 L0 200 Z"
          fill="#f2efe6"
          fillOpacity={0.05}
          stroke="#f2efe6"
          strokeWidth={0.3}
          strokeOpacity={0.12}
        />
        {/* 远山倒影 */}
        <ellipse
          cx={400}
          cy={170}
          rx={350}
          ry={20}
          fill="#f2efe6"
          fillOpacity={0.02}
        />
      </svg>
    );
  }

  if (variant === "cloud") {
    return (
      <svg
        viewBox="0 0 600 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full ${className}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="cloudBlur">
            <feGaussianBlur stdDeviation={8} />
          </filter>
        </defs>
        {/* 云层 */}
        <g filter="url(#cloudBlur)">
          <ellipse cx={100} cy={80} rx={80} ry={25} fill="#f2efe6" fillOpacity={0.04} />
          <ellipse cx={250} cy={60} rx={100} ry={30} fill="#f2efe6" fillOpacity={0.06} />
          <ellipse cx={420} cy={75} rx={90} ry={28} fill="#f2efe6" fillOpacity={0.04} />
          <ellipse cx={550} cy={95} rx={70} ry={20} fill="#f2efe6" fillOpacity={0.05} />
        </g>
      </svg>
    );
  }

  if (variant === "full") {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        <svg
          viewBox="0 0 1440 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid slice"
          style={{ opacity }}
        >
          <defs>
            <linearGradient id="mtGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f2efe6" stopOpacity={0} />
              <stop offset="40%" stopColor="#f2efe6" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#f2efe6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="mtGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9a9a9a" stopOpacity={0} />
              <stop offset="50%" stopColor="#9a9a9a" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#9a9a9a" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* 远山 - 最淡 */}
          <path
            d={`M-50 450 Q100 280 300 320 Q500 260 720 340 Q920 290 1100 370 Q1280 310 1490 380 L1490 900 L-50 900 Z`}
            fill="url(#mtGrad)"
          />

          {/* 中景山脉 */}
          <path
            d={`M-30 520 Q80 360 220 410 Q380 330 520 400 Q680 340 850 430 Q1020 360 1180 440 Q1340 380 1490 450 L1490 900 L-30 900 Z`}
            fill="url(#mtGrad2)"
          />

          {/* 近景主峰 */}
          <path
            d={`M0 580 Q120 420 280 480 Q420 380 580 490 Q740 400 900 520 Q1060 430 1220 550 Q1360 480 1440 580 L1440 900 L0 900 Z`}
            fill="#f2efe6"
            fillOpacity={0.02}
            stroke="#f2efe6"
            strokeWidth={0.5}
            strokeOpacity={0.1}
          />

          {/* 水面 */}
          <rect x="0" y="750" width="1440" height="150" fill="#f2efe6" fillOpacity={0.015} />
          <path
            d="M0 780 Q180 765 360 777 T720 772 T1080 782 T1440 775"
            stroke="#f2efe6"
            strokeWidth={0.5}
            strokeOpacity={0.08}
            fill="none"
          />
          <path
            d="M0 810 Q240 798 480 806 T960 799 T1440 805"
            stroke="#f2efe6"
            strokeWidth={0.3}
            strokeOpacity={0.06}
            fill="none"
          />

          {/* 留白飞鸟 */}
          <g transform="translate(1150, 180)">
            <path
              d="M0,0 Q10,-8 25,-3 Q18,2 35,5 Q22,4 28,10 Q14,8 0,0Z"
              fill="#f2efe6"
              fillOpacity={0.15}
              className={animated ? "animate-float" : ""}
            />
          </g>
          <g transform="translate(1220, 210)">
            <path
              d="M0,0 Q8,-5 18,-2 Q13,2 24,4 Q16,3 20,7 Q11,6 0,0Z"
              fill="#f2efe6"
              fillOpacity={0.1}
              className={animated ? "animate-float-slow" : ""}
              style={{ animationDelay: "2s" }}
            />
          </g>
          {/* 月 */}
          <circle cx="1200" cy={120} r={24} fill="#f2efe6" fillOpacity={0.06} />
          <circle cx="1200" cy={120} r={16} fill="#f2efe6" fillOpacity={0.04} />
        </svg>
      </div>
    );
  }

  /* Default: mountain */
  return (
    <svg
      viewBox="0 0 800 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`w-full ${className} ${animClass}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="inkMtGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2efe6" stopOpacity={0} />
          <stop offset="45%" stopColor="#f2efe6" stopOpacity={0.07} />
          <stop offset="100%" stopColor="#f2efe6" stopOpacity={0.01} />
        </linearGradient>
        <linearGradient id="inkMtGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9a9a9a" stopOpacity={0} />
          <stop offset="55%" stopColor="#9a9a9a" stopOpacity={0.04} />
          <stop offset="100%" stopColor="#9a9a9a" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* 远山 */}
      <path
        d="M0 200 Q80 100 180 140 Q300 80 420 130 Q540 90 650 150 Q730 110 800 170 L800 300 L0 300 Z"
        fill="url(#inkMtGrad)"
      />

      {/* 中景 */}
      <path
        d="M0 230 Q100 140 220 180 Q360 120 480 190 Q600 140 720 200 Q770 175 800 215 L800 300 L0 300 Z"
        fill="url(#inkMtGrad2)"
      />

      {/* 近景轮廓 */}
      <path
        d="M0 255 Q120 190 250 230 Q400 165 550 245 Q680 195 800 255 L800 300 L0 300 Z"
        fill="#f2efe6"
        fillOpacity={0.015}
        stroke="#f2efe6"
        strokeWidth={0.5}
        strokeOpacity={0.12}
      />
    </svg>
  );
}
