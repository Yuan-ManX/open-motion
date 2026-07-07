import { useEffect, useRef } from "react";

interface WaveLayer {
  amplitude: number;
  frequency: number;
  speed: number;
  offset: number;
  opacity: number;
  color: string;
  yRatio: number;
  lineWidth: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  layer: number;
  size: number;
  opacity: number;
  phase: number;
}

export function InkWaves() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number>();
  const timeRef = useRef(0);

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
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", onMouseMove);

    // 水墨波形层 - ink wave layers (slow, contemplative rhythm)
    const layers: WaveLayer[] = [
      { amplitude: 35, frequency: 0.0035, speed: 0.0001, offset: 0, opacity: 0.025, color: "242, 239, 230", yRatio: 0.45, lineWidth: 1 },
      { amplitude: 50, frequency: 0.0025, speed: 0.00007, offset: Math.PI / 3, opacity: 0.02, color: "154, 154, 154", yRatio: 0.55, lineWidth: 1.5 },
      { amplitude: 30, frequency: 0.0042, speed: 0.00013, offset: Math.PI / 2, opacity: 0.018, color: "107, 107, 107", yRatio: 0.65, lineWidth: 1 },
      { amplitude: 70, frequency: 0.0018, speed: 0.00005, offset: Math.PI, opacity: 0.015, color: "242, 239, 230", yRatio: 0.75, lineWidth: 2 },
      { amplitude: 25, frequency: 0.005, speed: 0.00016, offset: Math.PI * 1.5, opacity: 0.012, color: "154, 154, 154", yRatio: 0.85, lineWidth: 1 },
    ];

    // 墨粒子 - ink particles drifting slowly along waves
    const particles: Particle[] = [];
    for (let i = 0; i < 50; i++) {
      const layer = Math.floor(Math.random() * layers.length);
      particles.push({
        x: Math.random() * width,
        y: 0,
        vx: 0.06 + Math.random() * 0.18,
        layer,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.15 + 0.05,
        phase: Math.random() * Math.PI * 2,
      });
    }

    function getWaveY(layer: WaveLayer, x: number, t: number): number {
      const baseY = height * layer.yRatio;
      const mouseInfluence = (mouseRef.current.x - 0.5) * 20;
      const wave1 = Math.sin(x * layer.frequency + t * layer.speed * 20 + layer.offset) * layer.amplitude;
      const wave2 = Math.sin(x * layer.frequency * 2.3 + t * layer.speed * 12 + layer.offset) * layer.amplitude * 0.3;
      return baseY + wave1 + wave2 + mouseInfluence * layer.yRatio;
    }

    function drawWave(layer: WaveLayer, t: number) {
      ctx.beginPath();
      const step = 3;
      for (let x = 0; x <= width; x += step) {
        const y = getWaveY(layer, x, t);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // 填充波形下方 - ink wash fill
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, height * layer.yRatio, 0, height);
      gradient.addColorStop(0, `rgba(${layer.color}, ${layer.opacity})`);
      gradient.addColorStop(1, `rgba(${layer.color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fill();

      // 描边波形线 - wave stroke
      ctx.beginPath();
      for (let x = 0; x <= width; x += step) {
        const y = getWaveY(layer, x, t);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = `rgba(${layer.color}, ${layer.opacity * 1.5})`;
      ctx.lineWidth = layer.lineWidth;
      ctx.stroke();
    }

    function drawParticles(t: number) {
      for (const p of particles) {
        const layer = layers[p.layer];
        p.x += p.vx;
        if (p.x > width + 10) p.x = -10;

        const waveY = getWaveY(layer, p.x, t);
        const floatOffset = Math.sin(t * 0.0004 + p.phase) * 5;
        p.y = waveY + floatOffset - 5;

        // 鼠标吸引 - mouse attraction
        const mx = mouseRef.current.x * width;
        const my = mouseRef.current.y * height;
        const dist = Math.hypot(p.x - mx, p.y - my);
        const attractStrength = Math.max(0, 1 - dist / 200) * 0.5;

        const radius = p.size + attractStrength * 3;
        const opacity = p.opacity + attractStrength * 0.2;

        // 墨粒子光晕
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 4);
        gradient.addColorStop(0, `rgba(242, 239, 230, ${opacity})`);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 4, 0, Math.PI * 2);
        ctx.fill();

        // 墨粒子核心
        ctx.fillStyle = `rgba(242, 239, 230, ${opacity * 2})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function animate() {
      timeRef.current += 16;
      const t = timeRef.current;

      ctx.clearRect(0, 0, width, height);

      // 绘制波形层 - 从远到近
      for (const layer of layers) {
        drawWave(layer, t);
      }

      // 绘制墨粒子
      drawParticles(t);

      rafRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
