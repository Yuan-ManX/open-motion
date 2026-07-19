import { useEffect, useRef } from "react";
import type { RuntimeLayerSpec, RenderedNode } from "../../motion/cssRenderer.js";

interface RuntimeLayerProps {
  node: RenderedNode;
  className: string;
}

/**
 * Mounts a JS-driven animation layer inside the canvas. The cssRenderer emits
 * a `runtime` marker on nodes that need a RAF loop — particle emitters,
 * audio-reactive bindings, and live expressions. This component owns the
 * loop lifecycle and writes results directly to the DOM via refs.
 *
 * Each driver is isolated: a particle layer paints to its own <canvas>, an
 * audio binding mutates a target layer's style, and an expression writes a
 * custom property on its host element. Drivers clean up on unmount.
 */
export function RuntimeLayer({ node, className }: RuntimeLayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!node.runtime) return;
    const spec: RuntimeLayerSpec = node.runtime;
    let cancelled = false;

    if (spec.kind === "particle") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cfg = spec.config as {
        rate: number; lifespan: number; gravity: number; spread: number; speed: number;
        startColor: string; endColor: string; startSize: number; endSize: number;
        startOpacity: number; endOpacity: number; blendMode: string;
      };
      const w = canvas.width;
      const h = canvas.height;
      interface Particle {
        x: number; y: number; vx: number; vy: number;
        born: number; life: number; seed: number;
      }
      const particles: Particle[] = [];
      let lastSpawn = performance.now();
      const blendMode = cfg.blendMode === "normal" ? "source-over" : cfg.blendMode;

      const tick = (nowMs: number) => {
        if (cancelled) return;
        const dt = Math.min(50, nowMs - lastSpawn);
        // Spawn new particles based on rate.
        const spawnInterval = 1000 / Math.max(0.1, cfg.rate);
        while (nowMs - lastSpawn > spawnInterval) {
          lastSpawn += spawnInterval;
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * (cfg.spread * Math.PI) / 180;
          const speed = cfg.speed * (0.7 + Math.random() * 0.6);
          particles.push({
            x: w / 2, y: h / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            born: lastSpawn,
            life: cfg.lifespan,
            seed: Math.random(),
          });
          if (particles.length > 500) particles.shift();
        }
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          const age = nowMs - p.born;
          if (age >= p.life) { particles.splice(i, 1); continue; }
          p.vy += (cfg.gravity * dt) / 1000;
          p.x += (p.vx * dt) / 1000;
          p.y += (p.vy * dt) / 1000;
          const t = age / p.life;
          const size = cfg.startSize + (cfg.endSize - cfg.startSize) * t;
          const opacity = cfg.startOpacity + (cfg.endOpacity - cfg.startOpacity) * t;
          ctx.fillStyle = lerpColor(cfg.startColor, cfg.endColor, t);
          ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.1, size), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else if (spec.kind === "expression") {
      // Live expression evaluation. The host element's style is updated each
      // frame with the computed value. Helper functions (wiggle, loopOut,
      // ease, random) are injected into the expression scope.
      const host = hostRef.current;
      if (!host) return;
      const cfg = spec.config;
      const prop = cfg.property;
      const expression = cfg.expression;
      const start = performance.now();
      // Lightweight deterministic PRNG so wiggle() / random() are stable
      // across frames within a session.
      let seedState = 12345;
      const rng = () => {
        seedState = (seedState * 1664525 + 1013904223) >>> 0;
        return seedState / 0xffffffff;
      };
      // Pre-compute a wiggle table so wiggle(freq, amp) is consistent across
      // frames and ensures deterministic behavior.
      const wiggleTable = new Float32Array(2048);
      for (let i = 0; i < wiggleTable.length; i++) wiggleTable[i] = rng() * 2 - 1;
      const wiggle = (freq: number, amp: number) => {
        const t = (performance.now() - start) / 1000;
        const idx = Math.floor((t * freq * 16) % wiggleTable.length);
        return wiggleTable[idx] * amp;
      };
      const loopOut = (mode = "cycle") => {
        // Returns a normalized phase 0..1 that loops the duration.
        const elapsed = (performance.now() - start) % 1000;
        return mode === "pingpong" ? elapsed / 500 : elapsed / 1000;
      };
      const ease = (t: number, a: number = 0, b: number = 1) => {
        // Simplified cubic ease: ease(t, start, end) — returns eased value
        // mapped from normalized t (0..1) into the [a, b] range.
        const u = Math.max(0, Math.min(1, t));
        const eased = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        return a + (b - a) * eased;
      };
      const random = (min = 0, max = 1) => min + rng() * (max - min);

      const tick = (nowMs: number) => {
        if (cancelled) return;
        const time = nowMs - start;
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function(
            "time", "index", "duration", "value",
            "wiggle", "loopOut", "ease", "random",
            `return (${expression});`,
          );
          const result = fn(time, 0, 1000, 0, wiggle, loopOut, ease, random);
          if (typeof result === "number") {
            applyPropertyToHost(host, prop, result);
          }
        } catch {
          // Expression threw — silently ignore to avoid log spam.
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else if (spec.kind === "audio") {
      // Audio-reactive binding. Looks up the source audio element by ID,
      // creates an AnalyserNode, and drives the host element's property
      // based on the selected frequency band level.
      const host = hostRef.current;
      if (!host) return;
      const cfg = spec.config as {
        audioComponentId: string; property: string; band: string;
        min: number; max: number; smoothing: number;
      };
      // Find the audio element rendered elsewhere in the canvas by matching
      // its data-om-name attribute to the audio component's name.
      const audioEl = document.querySelector<HTMLAudioElement>(
        `[data-om-component-id="${cfg.audioComponentId}"]`,
      );
      if (!audioEl) return;
      let analyser: AnalyserNode | null = null;
      let audioCtx: AudioContext | null = null;
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AudioCtx();
        const source = audioCtx.createMediaElementSource(audioEl);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = cfg.smoothing;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch {
        // AudioContext may fail if the element is cross-origin or already
        // connected — bail out gracefully.
        return;
      }
      if (!analyser) return;
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const bandIndex = cfg.band === "bass" ? 0
        : cfg.band === "mid" ? Math.floor(analyser.frequencyBinCount / 3)
        : cfg.band === "treble" ? Math.floor((analyser.frequencyBinCount * 2) / 3)
        : 0;
      const bandEnd = cfg.band === "bass" ? Math.floor(analyser.frequencyBinCount / 3)
        : cfg.band === "mid" ? Math.floor((analyser.frequencyBinCount * 2) / 3)
        : cfg.band === "treble" ? analyser.frequencyBinCount
        : analyser.frequencyBinCount;

      const tick = () => {
        if (cancelled) return;
        analyser!.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = bandIndex; i < bandEnd; i++) sum += freqData[i];
        const avg = sum / Math.max(1, bandEnd - bandIndex) / 255;
        const value = cfg.min + (cfg.max - cfg.min) * avg;
        applyPropertyToHost(host, cfg.property, value);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        cancelled = true;
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        if (audioCtx && audioCtx.state !== "closed") {
          void audioCtx.close();
        }
      };
    }

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [node.runtime, node.componentId, className]);

  // Particle layers render a <canvas> child; expression/audio layers render
  // an empty host div that the CSS rule styles (the runtime just mutates
  // inline properties on top).
  if (node.runtime?.kind === "particle") {
    const cfg = node.runtime.config as { width?: number; height?: number };
    const w = Number(cfg.width ?? 400);
    const h = Number(cfg.height ?? 300);
    return (
      <div
        ref={hostRef}
        className={className}
        data-om-name={node.name}
        data-om-component-id={node.componentId}
        style={{ width: w, height: h, pointerEvents: "none" }}
      >
        <canvas ref={canvasRef} width={w} height={h} style={{ width: "100%", height: "100%" }} />
      </div>
    );
  }
  return (
    <div
      ref={hostRef}
      className={className}
      data-om-name={node.name}
      data-om-component-id={node.componentId}
    >
      {node.content}
    </div>
  );
}

/** Apply a numeric property value to a host element via inline style. */
function applyPropertyToHost(host: HTMLElement, prop: string, value: number): void {
  switch (prop) {
    case "opacity":
      host.style.opacity = String(Math.max(0, Math.min(1, value)));
      break;
    case "scale":
      host.style.transform = `scale(${value})`;
      break;
    case "translateX":
      host.style.transform = `translateX(${value}px)`;
      break;
    case "translateY":
      host.style.transform = `translateY(${value}px)`;
      break;
    case "rotate":
      host.style.transform = `rotate(${value}deg)`;
      break;
    case "backgroundColor":
      host.style.backgroundColor = numberToColor(value);
      break;
    default:
      // Generic property write — useful for custom properties.
      (host.style as unknown as Record<string, string>)[prop] = String(value);
  }
}

function numberToColor(value: number): string {
  // Map a 0..1 value to a grayscale hex color.
  const v = Math.max(0, Math.min(1, value));
  const hex = Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function parseHex(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const full = m.length === 3
    ? m.split("").map((c) => c + c).join("")
    : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [r, g, b];
}
