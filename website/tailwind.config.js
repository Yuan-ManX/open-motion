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
        ink: "#05060A",
        panel: "#0B0E14",
        panel2: "#131820",
        edge: "#1E2433",
        accent: "#6366F1",
        accent2: "#22D3EE",
        magenta: "#EC4899",
        violet: "#8B5CF6",
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"Noto Sans SC"', "monospace"],
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
        "marquee": "marquee 30s linear infinite",
        "aurora": "aurora 15s ease infinite",
        "shimmer": "shimmer 2.5s linear infinite",
        "border-flow": "borderFlow 4s linear infinite",
        "orbit": "orbit 8s linear infinite",
        "pulse-ring": "pulseRing 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-in-left": "slideInLeft 0.6s ease-out forwards",
        "slide-in-right": "slideInRight 0.6s ease-out forwards",
        "blink": "blink 1s step-end infinite",
        "wiggle": "wiggle 0.5s ease-in-out infinite",
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
          "0%, 100%": { boxShadow: "0 0 20px rgba(99,102,241,0.3), 0 0 40px rgba(99,102,241,0.1)" },
          "50%": { boxShadow: "0 0 30px rgba(99,102,241,0.5), 0 0 60px rgba(99,102,241,0.2)" },
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
      },
    },
  },
  plugins: [],
};
