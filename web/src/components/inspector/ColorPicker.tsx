import { useState, useRef, useEffect, useCallback } from "react";

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeHex(input: string): string {
  let s = input.trim();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return "#000000";
  return s.toLowerCase();
}

interface Props {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const ref = useRef<HTMLDivElement | null>(null);
  const safeValue = normalizeHex(value);
  const { h, s, l } = hexToHsl(safeValue);

  useEffect(() => {
    setHexInput(safeValue);
  }, [safeValue]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const updateFromHsl = (nh: number, ns: number, nl: number) => {
    const hex = hslToHex(nh, ns, nl);
    setHexInput(hex);
    onChange(hex);
  };

  const onHexCommit = () => {
    const normalized = normalizeHex(hexInput);
    setHexInput(normalized);
    onChange(normalized);
  };

  const slBg = `hsl(${h}, 100%, 50%)`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 rounded border border-edge bg-panel2 flex-shrink-0"
        style={{ backgroundColor: safeValue }}
        title={label ? `${label}: ${safeValue}` : safeValue}
        aria-label={label ? `Open color picker for ${label}` : "Open color picker"}
      />
      {open && (
        <div className="absolute z-50 mt-1 p-2 bg-panel border border-edge rounded-lg shadow-xl" style={{ width: 200 }}>
          {/* Saturation/Lightness square */}
          <div
            className="relative w-full h-32 rounded cursor-crosshair mb-2"
            style={{ backgroundColor: slBg }}
            onMouseDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const move = (ev: MouseEvent) => {
                const sx = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                const sy = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
                updateFromHsl(h, Math.round(sx * 100), Math.round((1 - sy) * 100));
              };
              move(e.nativeEvent);
              const onMove = (ev: MouseEvent) => move(ev);
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          >
            <div
              className="absolute inset-0 rounded"
              style={{ background: "linear-gradient(to right, #fff, transparent)" }}
            />
            <div
              className="absolute inset-0 rounded"
              style={{ background: "linear-gradient(to top, #000, transparent)" }}
            />
            <div
              className="absolute w-3 h-3 border-2 border-white rounded-full pointer-events-none"
              style={{
                left: `${s}%`,
                top: `${100 - l}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>

          {/* Hue slider */}
          <div className="mb-2">
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={h}
              onChange={(e) => updateFromHsl(Number(e.target.value), s, l)}
              className="w-full h-3 rounded appearance-none cursor-pointer"
              style={{
                background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
              }}
              aria-label="Hue"
            />
          </div>

          {/* Hex input */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={onHexCommit}
              onKeyDown={(e) => e.key === "Enter" && onHexCommit()}
              className="flex-1 bg-panel2 border border-edge rounded px-2 py-1 text-xs text-gray-100 font-mono focus:outline-none focus:border-accent"
              aria-label="Hex color value"
            />
          </div>
        </div>
      )}
    </div>
  );
}
