import { useEffect, useRef, useState } from "react";

export function GradientBg() {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.3 });
  const rafRef = useRef<number>();
  const targetRef = useRef({ x: 0.5, y: 0.3 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      targetRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };

    const animate = () => {
      const target = targetRef.current;
      setMousePos((prev) => ({
        x: prev.x + (target.x - prev.x) * 0.04,
        y: prev.y + (target.y - prev.y) * 0.04,
      }));
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    window.addEventListener("mousemove", onMove);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* 墨色底 - ink base */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink2 to-ink" />

      {/* 鼠标跟随墨晕 - mouse-following ink wash */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(900px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(242, 239, 230, 0.04), transparent 50%)`,
        }}
      />

      {/* 墨韵层次 - ink wash layers */}
      <div
        className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full opacity-[0.04] blur-3xl animate-aurora"
        style={{ background: "radial-gradient(circle, #f2efe6, transparent 70%)" }}
      />
      <div
        className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.03] blur-3xl animate-aurora"
        style={{ background: "radial-gradient(circle, #9a9a9a, transparent 70%)", animationDelay: "5s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full opacity-[0.025] blur-3xl animate-aurora"
        style={{ background: "radial-gradient(circle, #6b6b6b, transparent 70%)", animationDelay: "10s" }}
      />

      {/* 朱砂淡彩 - subtle cinnabar wash */}
      <div
        className="absolute top-1/2 left-1/2 w-[500px] h-[500px] rounded-full opacity-[0.015] blur-3xl animate-aurora"
        style={{ background: "radial-gradient(circle, #a83232, transparent 70%)", animationDelay: "3s" }}
      />

      {/* 宣纸纹理 - rice paper texture */}
      <div className="absolute inset-0 bg-paper-texture opacity-60" />

      {/* 细网格 - fine ink grid */}
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute inset-0 bg-grid-fine opacity-30" />

      {/* 飞白纹理 - dry brush texture */}
      <div className="absolute inset-0 bg-feibai opacity-40" />

      {/* 噪点 - film grain */}
      <div className="absolute inset-0 bg-noise" />

      {/* 电影感渐晕 - cinematic vignette */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-ink to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      <div className="absolute left-0 inset-y-0 w-32 bg-gradient-to-r from-ink to-transparent" />
      <div className="absolute right-0 inset-y-0 w-32 bg-gradient-to-l from-ink to-transparent" />
    </div>
  );
}
