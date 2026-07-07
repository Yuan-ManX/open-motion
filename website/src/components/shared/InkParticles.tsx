import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  life: number;
  maxLife: number;
  type: "ink" | "mist" | "cinnabar";
}

export function InkParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
      // 鼠标移动时生成粒子
      if (Math.random() < 0.3) {
        spawnParticle(e.clientX, e.clientY);
      }
    };
    window.addEventListener("mousemove", onMouseMove);

    function spawnParticle(x: number, y: number) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.5 + 0.1;

      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.2,
        radius: Math.random() * 60 + 20,
        opacity: 0,
        life: 0,
        maxLife: Math.random() * 200 + 100,
        type: Math.random() < 0.85 ? "ink" : Math.random() < 0.7 ? "mist" : "cinnabar",
      });

      // 限制粒子数量
      if (particlesRef.current.length > 80) {
        particlesRef.current.shift();
      }
    }

    // 初始环境粒子
    function spawnAmbient() {
      if (particlesRef.current.length < 30) {
        spawnParticle(
          Math.random() * width,
          Math.random() * height
        );
      }
    }
    const ambientInterval = setInterval(spawnAmbient, 200);

    function getColor(p: Particle): string {
      if (p.type === "cinnabar") return `rgba(168, 50, 50, ${p.opacity * 0.015})`;
      if (p.type === "mist") return `rgba(154, 154, 154, ${p.opacity * 0.02})`;
      return `rgba(242, 239, 230, ${p.opacity * 0.025})`;
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.005; // 轻微上浮
        p.vx *= 0.99;
        p.vy *= 0.99;

        // 生命周期：淡入 → 持续 → 淡出
        const lifeRatio = p.life / p.maxLife;
        if (lifeRatio < 0.2) {
          p.opacity = lifeRatio / 0.2;
        } else if (lifeRatio > 0.7) {
          p.opacity = (1 - lifeRatio) / 0.3;
        } else {
          p.opacity = 1;
        }

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        // 绘制墨晕
        const gradient = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, p.radius
        );
        gradient.addColorStop(0, getColor(p));
        gradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      clearInterval(ambientInterval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
