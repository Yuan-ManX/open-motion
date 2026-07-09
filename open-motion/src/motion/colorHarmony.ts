/**
 * Color harmony utilities based on HSL color theory.
 * Generates harmonious color palettes from a base color.
 */

export type ColorScheme = "complementary" | "analogous" | "triadic" | "monochrome";

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface HarmonyResult {
  scheme: ColorScheme;
  base: string;
  colors: string[];
}

/** Parse a hex color (#rgb or #rrggbb) into HSL. */
export function hexToHsl(hex: string): HslColor {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

/** Convert HSL back to a hex color string. */
export function hslToHex(hsl: HslColor): string {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, hsl.s)) / 100;
  const l = Math.max(0, Math.min(100, hsl.l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a harmonious color palette from a base color.
 * - complementary: base + opposite hue (180° apart)
 * - analogous: base + neighbors (±30°)
 * - triadic: base + two colors 120° apart
 * - monochrome: same hue, varying lightness
 */
export function generateHarmony(baseHex: string, scheme: ColorScheme): HarmonyResult {
  const base = hexToHsl(baseHex);
  const colors: string[] = [baseHex];

  switch (scheme) {
    case "complementary":
      colors.push(hslToHex({ h: base.h + 180, s: base.s, l: base.l }));
      colors.push(hslToHex({ h: base.h + 180, s: base.s * 0.7, l: Math.min(85, base.l + 15) }));
      colors.push(hslToHex({ h: base.h, s: base.s * 0.6, l: Math.min(90, base.l + 20) }));
      break;
    case "analogous":
      colors.push(hslToHex({ h: base.h + 30, s: base.s, l: base.l }));
      colors.push(hslToHex({ h: base.h - 30, s: base.s, l: base.l }));
      colors.push(hslToHex({ h: base.h + 60, s: base.s * 0.8, l: Math.min(85, base.l + 10) }));
      break;
    case "triadic":
      colors.push(hslToHex({ h: base.h + 120, s: base.s, l: base.l }));
      colors.push(hslToHex({ h: base.h + 240, s: base.s, l: base.l }));
      colors.push(hslToHex({ h: base.h + 60, s: base.s * 0.5, l: Math.min(90, base.l + 25) }));
      break;
    case "monochrome":
      colors.push(hslToHex({ h: base.h, s: base.s, l: Math.min(90, base.l + 20) }));
      colors.push(hslToHex({ h: base.h, s: base.s, l: Math.max(10, base.l - 20) }));
      colors.push(hslToHex({ h: base.h, s: base.s * 0.5, l: Math.min(95, base.l + 30) }));
      break;
  }

  return { scheme, base: baseHex, colors };
}

/** Detect if a style value is a hex color. */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value);
}
