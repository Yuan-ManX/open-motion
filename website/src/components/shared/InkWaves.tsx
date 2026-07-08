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
  blur: number;
}

interface InkStreak {
  x: number;
  layer: number;
  length: number;
  vx: number;
  opacity: number;
  phase: number;
  yOffset: number;
}

interface InkWash {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  opacity: number;
  phase: number;
  color: string;
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

    // 水墨波形层 - ink wave layers (mountain-water rhythm)
    const layers: WaveLayer[] = [
      { amplitude: 28, frequency: 0.0032, speed: 0.00009, offset: 0, opacity: 0.022, color: "242, 239, 230", yRatio: 0.42, lineWidth: 0.8, blur: 0.5 },
      { amplitude: 45, frequency: 0.0024, speed: 0.00006, offset: Math.PI / 3, opacity: 0.028, color: "180, 175, 165", yRatio: 0.54, lineWidth: 1.2, blur: 0.8 },
      { amplitude: 38, frequency: 0.0038, speed: 0.00011, offset: Math.PI / 2, opacity: 0.024, color: "120, 118, 112", yRatio: 0.66, lineWidth: 1, blur: 0.6 },
      { amplitude: 62, frequency: 0.0016, speed: 0.00004, offset: Math.PI, opacity: 0.02, color: "154, 150, 142", yRatio: 0.78, lineWidth: 1.8, blur: 1 },
      { amplitude: 22, frequency: 0.0046, speed: 0.00014, offset: Math.PI * 1.5, opacity: 0.016, color: "200, 196, 186", yRatio: 0.88, lineWidth: 0.8, blur: 0.4 },
    ];

    // 墨痕流线 - ink streaks drifting along waves (elongated, not dots)
    const streaks: InkStreak[] = [];
    for (let i = 0; i < 28; i++) {
      const layer = Math.floor(Math.random() * layers.length);
      streaks.push({
        x: Math.random() * width,
        layer,
        length: 40 + Math.random() * 120,
        vx: 0.04 + Math.random() * 0.12,
        opacity: Math.random() * 0.08 + 0.03,
        phase: Math.random() * Math.PI * 2,
        yOffset: (Math.random() - 0.5) * 12,
      });
    }

    // 墨晕 - large soft ink washes slowly drifting
    const washes: InkWash[] = [];
    const washColors = ["242, 239, 230", "154, 150, 142", "107, 105, 100", "200, 196, 186"];
    for (let i = 0; i < 7; i++) {
      washes.push({
        x: Math.random() * width,
        y: height * (0.35 + Math.random() * 0.5),
        radius: 120 + Math.random() * 180,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.03,
        opacity: 0.015 + Math.random() * 0.025,
        phase: Math.random() * Math.PI * 2,
        color: washColors[i % washColors.length],
      });
    }

    function getWaveY(layer: WaveLayer, x: number, t: number): number {
      const baseY = height * layer.yRatio;
      const mouseInfluence = (mouseRef.current.x - 0.5) * 16;
      const wave1 = Math.sin(x * layer.frequency + t * layer.speed * 18 + layer.offset) * layer.amplitude;
      const wave2 = Math.sin(x * layer.frequency * 2.1 + t * layer.speed * 10 + layer.offset) * layer.amplitude * 0.28;
      const wave3 = Math.sin(x * layer.frequency * 0.6 + t * layer.speed * 6) * layer.amplitude * 0.4;
      return baseY + wave1 + wave2 + wave3 + mouseInfluence * layer.yRatio;
    }

    function drawWave(layer: WaveLayer, t: number) {
      const step = 4;

      // 填充波形下方 - ink wash fill with soft gradient
      ctx.beginPath();
      ctx.moveTo(0, getWaveY(layer, 0, t));
      for (let x = step; x <= width; x += step) {
        ctx.lineTo(x, getWaveY(layer, x, t));
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, height * layer.yRatio, 0, height);
      gradient.addColorStop(0, `rgba(${layer.color}, ${layer.opacity})`);
      gradient.addColorStop(0.6, `rgba(${layer.color}, ${layer.opacity * 0.3})`);
      gradient.addColorStop(1, `rgba(${layer.color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fill();

      // 描边波形线 - wave stroke with brush-like softness
      ctx.save();
      ctx.shadowColor = `rgba(${layer.color}, ${layer.opacity * 0.8})`;
      ctx.shadowBlur = layer.blur * 4;
      ctx.beginPath();
      for (let x = 0; x <= width; x += step) {
        const y = getWaveY(layer, x, t);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = `rgba(${layer.color}, ${layer.opacity * 1.4})`;
      ctx.lineWidth = layer.lineWidth;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }

    function drawInkWashes(t: number) {
      for (const w of washes) {
        w.x += w.vx;
        w.y += w.vy + Math.sin(t * 0.0002 + w.phase) * 0.15;
        if (w.x < -w.radius) w.x = width + w.radius;
        if (w.x > width + w.radius) w.x = -w.radius;
        if (w.y < 0) w.y = height;
        if (w.y > height) w.y = 0;

        const breath = 1 + Math.sin(t * 0.0005 + w.phase) * 0.08;
        const r = w.radius * breath;
        const mx = mouseRef.current.x * width;
        const my = mouseRef.current.y * height;
        const dist = Math.hypot(w.x - mx, w.y - my);
        const attract = Math.max(0, 1 - dist / 400) * 0.4;
        const opacity = w.opacity + attract * 0.02;

        const gradient = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r);
        gradient.addColorStop(0, `rgba(${w.color}, ${opacity})`);
        gradient.addColorStop(0.5, `rgba(${w.color}, ${opacity * 0.4})`);
        gradient.addColorStop(1, `rgba(${w.color}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawInkStreaks(t: number) {
      for (const s of streaks) {
        const layer = layers[s.layer];
        s.x += s.vx;
        if (s.x > width + s.length) s.x = -s.length;

        const baseY = getWaveY(layer, s.x + s.length / 2, t);
        const startY = getWaveY(layer, s.x, t) + s.yOffset;
        const endY = getWaveY(layer, s.x + s.length, t) + s.yOffset;
        const midY = baseY + s.yOffset + Math.sin(t * 0.0003 + s.phase) * 3;

        // 墨痕 - elongated ink streak along wave
        const opacity = s.opacity * (0.7 + Math.sin(t * 0.0006 + s.phase) * 0.3);
        const gradient = ctx.createLinearGradient(s.x, startY, s.x + s.length, endY);
        gradient.addColorStop(0, `rgba(${layer.color}, 0)`);
        gradient.addColorStop(0.5, `rgba(${layer.color}, ${opacity})`);
        gradient.addColorStop(1, `rgba(${layer.color}, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 0.6 + Math.sin(t * 0.0004 + s.phase) * 0.3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.x, startY);
        ctx.quadraticCurveTo(s.x + s.length / 2, midY, s.x + s.length, endY);
        ctx.stroke();
      }
    }

    function animate() {
      timeRef.current += 16;
      const t = timeRef.current;

      ctx.clearRect(0, 0, width, height);

      // 墨晕底层 - soft ink wash background
      drawInkWashes(t);

      // 绘制波形层 - 从远到近
      for (const layer of layers) {
        drawWave(layer, t);
      }

      // 墨痕流线
      drawInkStreaks(t);

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
