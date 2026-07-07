/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 墨色层次 - ink depths
        ink: "#0a0a0c",
        ink2: "#101013",
        ink3: "#16161a",
        ink4: "#1c1c21",
        // 宣纸层次 - rice paper
        paper: "#f2efe6",
        paper2: "#e8e4d8",
        paper3: "#ddd8c8",
        // 灰墨层次 - ink gray
        mist: "#9a9a9a",
        stone: "#6b6b6b",
        slate: "#4a4a4a",
        // 边缘
        edge: "#2a2a2f",
        edge2: "#3a3a40",
        // 朱砂 - cinnabar (印章/落款)
        cinnabar: "#a83232",
        cinnabar2: "#c0392b",
        cinnabar3: "#8b2a2a",
        // 赭石 - ochre (淡彩)
        ochre: "#8b6f47",
        // 黛青 - dark cyan ink
        dai: "#3a4a5a",
        // 兼容别名 - alias to ink-wash palette
        accent: "#f2efe6",
        accent2: "#9a9a9a",
        magenta: "#a83232",
        violet: "#8b2a2a",
        gold: "#c0392b",
        amber: "#8b6f47",
        panel: "#16161a",
        panel2: "#1c1c21",
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Noto Serif SC"', "serif"],
        mono: ['"JetBrains Mono"', '"Noto Sans SC"', "monospace"],
        serif: ['"Noto Serif SC"', '"Songti SC"', "serif"],
        sans: ['"Noto Sans SC"', '"Space Grotesk"', "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.8s ease-out forwards",
        "fade-up": "fadeUp 0.8s ease-out forwards",
        "fade-down": "fadeDown 0.8s ease-out forwards",
        "scale-in": "scaleIn 0.6s ease-out forwards",
        "float": "float 6s ease-in-out infinite",
        "float-slow": "float 12s ease-in-out infinite",
        "gradient-shift": "gradientShift 8s ease infinite",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "spin-slow": "spin 20s linear infinite",
        "bounce-slow": "bounce 2s ease-in-out infinite",
        "ping-slow": "ping 3s cubic-bezier(0,0,0.2,1) infinite",
        "marquee": "marquee 40s linear infinite",
        "aurora": "aurora 15s ease infinite",
        "shimmer": "shimmer 2.5s linear infinite",
        "border-flow": "borderFlow 4s linear infinite",
        "orbit": "orbit 8s linear infinite",
        "pulse-ring": "pulseRing 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-in-left": "slideInLeft 0.6s ease-out forwards",
        "slide-in-right": "slideInRight 0.6s ease-out forwards",
        "blink": "blink 1s step-end infinite",
        "wiggle": "wiggle 0.5s ease-in-out infinite",
        // 国画风动画
        "ink-spread": "inkSpread 2.5s ease-out forwards",
        "brush-draw": "brushDraw 2s ease-in-out forwards",
        "scroll-unroll": "scrollUnroll 1.5s ease-out forwards",
        "seal-stamp": "sealStamp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "ink-drip": "inkDrip 4s ease-in-out infinite",
        "paper-fade": "paperFade 1.2s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeDown: {
          "0%": { opacity: "0", transform: "translateY(-40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "33%": { transform: "translateY(-20px) translateX(10px)" },
          "66%": { transform: "translateY(10px) translateX(-15px)" },
        },
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(168,50,50,0.2), 0 0 40px rgba(168,50,50,0.08)" },
          "50%": { boxShadow: "0 0 30px rgba(168,50,50,0.35), 0 0 60px rgba(168,50,50,0.15)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        aurora: {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg) scale(1)" },
          "33%": { transform: "translate(30px, -20px) rotate(120deg) scale(1.1)" },
          "66%": { transform: "translate(-20px, 30px) rotate(240deg) scale(0.95)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        borderFlow: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg) translateX(60px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(60px) rotate(-360deg)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.8)", opacity: "0.8" },
          "100%": { transform: "scale(2)", opacity: "0" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        // 国画风关键帧
        inkSpread: {
          "0%": { transform: "scale(0.3)", opacity: "0", filter: "blur(8px)" },
          "60%": { opacity: "0.8", filter: "blur(2px)" },
          "100%": { transform: "scale(1)", opacity: "1", filter: "blur(0)" },
        },
        brushDraw: {
          "0%": { strokeDashoffset: "1000", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { strokeDashoffset: "0", opacity: "1" },
        },
        scrollUnroll: {
          "0%": { clipPath: "inset(0 100% 0 0)", opacity: "0" },
          "100%": { clipPath: "inset(0 0 0 0)", opacity: "1" },
        },
        sealStamp: {
          "0%": { transform: "scale(2) rotate(-15deg)", opacity: "0" },
          "60%": { transform: "scale(0.9) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        inkDrip: {
          "0%, 100%": { transform: "translateY(0) scale(1)", opacity: "0.6" },
          "50%": { transform: "translateY(20px) scale(0.8)", opacity: "0.2" },
        },
        paperFade: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
