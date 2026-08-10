/** Motion Synesthesia Engine — cross-modal sensory mapping for motion design. */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A sensory translation of a motion component. */
export interface SensoryTranslation {
  /** Component id being translated. */
  componentId: string;
  /** Visual color mapping. */
  color: ColorMapping;
  /** Auditory mapping. */
  sound: SoundMapping;
  /** Tactile mapping. */
  texture: TextureMapping;
  /** Overall sensory character. */
  character: string;
}

export interface ColorMapping {
  /** Hue 0-360. */
  hue: number;
  /** Saturation 0-100. */
  saturation: number;
  /** Lightness 0-100. */
  lightness: number;
  /** Hex color. */
  hex: string;
  /** Color name. */
  name: string;
  /** Rationale. */
  rationale: string;
}

export interface SoundMapping {
  /** Pitch in Hz. */
  pitch: number;
  /** Note name. */
  note: string;
  /** Instrument suggestion. */
  instrument: string;
  /** Tempo in BPM. */
  tempo: number;
  /** Volume 0-1. */
  volume: number;
  /** Rationale. */
  rationale: string;
}

export interface TextureMapping {
  /** Surface quality. */
  surface: "smooth" | "rough" | "soft" | "hard" | "liquid" | "granular" | "crystalline" | "elastic";
  /** Weight 0-1. */
  weight: number;
  /** Temperature -1..1 (cold to warm). */
  temperature: number;
  /** Rationale. */
  rationale: string;
}

/** A composed sensory experience for a motion spec. */
export interface SynestheticExperience {
  /** Per-component translations. */
  translations: SensoryTranslation[];
  /** Overall palette. */
  palette: string[];
  /** Overall soundscape. */
  soundscape: string;
  /** Overall tactile character. */
  tactileCharacter: string;
  /** Composed summary. */
  summary: string;
}

/** Reverse mapping: sensory input → motion parameters. */
export interface SensoryToMotionMapping {
  /** Source modality. */
  modality: "color" | "sound" | "texture" | "emotion";
  /** Source value. */
  sourceValue: string | number;
  /** Mapped duration in ms. */
  durationMs: number;
  /** Mapped easing preset. */
  easingPreset: string;
  /** Mapped intensity 0-1. */
  intensity: number;
  /** Mapped hue (for visual output). */
  hue?: number;
  /** Rationale. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Color Mapping
// ---------------------------------------------------------------------------

/** Map a motion component to a color. */
function mapToColor(comp: MotionComponent): ColorMapping {
  // Duration → hue: short = warm (red/orange), long = cool (blue/purple)
  // 200ms → ~20° (red-orange), 5000ms → ~270° (violet)
  const durationHue = Math.max(0, Math.min(360, 20 + (comp.durationMs - 200) / 4800 * 250));

  // Intensity (from easing) → saturation
  const intensity = estimateIntensity(comp);
  const saturation = Math.round(30 + intensity * 70);

  // Lightness based on opacity
  const opacity = extractOpacity(comp);
  const lightness = Math.round(30 + opacity * 50);

  const hex = hslToHex(durationHue, saturation, lightness);
  const name = hueToName(durationHue);

  return {
    hue: Math.round(durationHue),
    saturation,
    lightness,
    hex,
    name,
    rationale: `Duration ${comp.durationMs}ms → hue ${Math.round(durationHue)}° (${name}); intensity ${intensity.toFixed(2)} → saturation ${saturation}%; opacity ${opacity.toFixed(2)} → lightness ${lightness}%`,
  };
}

/** Estimate motion intensity on a 0..1 scale. */
function estimateIntensity(comp: MotionComponent): number {
  const durationFactor = comp.durationMs < 500 ? 0.9 : comp.durationMs < 1500 ? 0.6 : 0.3;
  const keyframeFactor = Math.min(1, (comp.keyframes?.length ?? 2) / 8);
  const easing = comp.easing;
  let easingFactor = 0.5;
  if (easing && typeof easing === "object") {
    if (easing.type === "spring") easingFactor = 0.8;
    else if (easing.type === "preset") {
      const intense = ["bounce", "elastic", "back", "snappy"];
      const calm = ["smooth", "soft", "ease-in-out"];
      if (intense.includes(easing.name)) easingFactor = 0.8;
      else if (calm.includes(easing.name)) easingFactor = 0.4;
    }
  }
  return Math.min(1, durationFactor * 0.4 + keyframeFactor * 0.2 + easingFactor * 0.4);
}

/** Extract opacity from component keyframes or style. */
function extractOpacity(comp: MotionComponent): number {
  const style = comp.style as Record<string, unknown> | undefined;
  if (style && typeof style.opacity === "number") return style.opacity;
  if (comp.keyframes && comp.keyframes.length > 0) {
    const lastKf = comp.keyframes[comp.keyframes.length - 1];
    const props = lastKf.properties as Record<string, string | number> | undefined;
    if (props && typeof props.opacity === "number") return props.opacity as number;
  }
  return 1;
}

/** Convert HSL to hex color. */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Map hue to a color name. */
function hueToName(hue: number): string {
  if (hue < 15) return "Red";
  if (hue < 45) return "Orange";
  if (hue < 70) return "Yellow";
  if (hue < 100) return "Lime";
  if (hue < 150) return "Green";
  if (hue < 190) return "Cyan";
  if (hue < 230) return "Blue";
  if (hue < 270) return "Indigo";
  if (hue < 310) return "Violet";
  if (hue < 340) return "Magenta";
  return "Red";
}

// ---------------------------------------------------------------------------
// Sound Mapping
// ---------------------------------------------------------------------------

/** Map a motion component to a sound. */
function mapToSound(comp: MotionComponent): SoundMapping {
  // Duration → pitch: short = high pitch, long = low pitch
  // 200ms → ~880 Hz (A5), 5000ms → ~110 Hz (A2)
  const pitch = Math.max(80, Math.min(880, 880 - (comp.durationMs - 200) / 4800 * 770));

  // Map to nearest note
  const note = freqToNote(pitch);

  // Intensity → instrument
  const intensity = estimateIntensity(comp);
  let instrument: string;
  if (intensity > 0.75) instrument = "Marimba";
  else if (intensity > 0.5) instrument = "Piano";
  else if (intensity > 0.3) instrument = "Cello";
  else instrument = "Pad";

  // Tempo from iteration count
  const isLooping = comp.iterationCount === "infinite" || (typeof comp.iterationCount === "number" && comp.iterationCount > 1);
  const tempo = isLooping
    ? Math.round(60000 / comp.durationMs)
    : 60; // One-shot = slow tempo

  const volume = 0.3 + intensity * 0.7;

  return {
    pitch: Math.round(pitch),
    note,
    instrument,
    tempo,
    volume: Math.min(1, volume),
    rationale: `Duration ${comp.durationMs}ms → pitch ${Math.round(pitch)} Hz (${note}); intensity ${intensity.toFixed(2)} → ${instrument}; loop ${isLooping ? "yes" : "no"} → tempo ${tempo} BPM`,
  };
}

/** Convert frequency to note name. */
function freqToNote(freq: number): string {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const a4 = 440;
  const semitones = Math.round(12 * Math.log2(freq / a4));
  const noteIndex = ((semitones + 9) % 12 + 12) % 12;
  const octave = 4 + Math.floor((semitones + 9) / 12);
  return `${notes[noteIndex]}${octave}`;
}

// ---------------------------------------------------------------------------
// Texture Mapping
// ---------------------------------------------------------------------------

/** Map a motion component to a tactile texture. */
function mapToTexture(comp: MotionComponent): TextureMapping {
  const intensity = estimateIntensity(comp);
  const easing = comp.easing;

  let surface: TextureMapping["surface"] = "smooth";

  if (easing && typeof easing === "object") {
    if (easing.type === "spring") {
      const stiffness = "stiffness" in easing && typeof easing.stiffness === "number" ? easing.stiffness : 170;
      surface = stiffness > 250 ? "elastic" : "soft";
    } else if (easing.type === "preset") {
      switch (easing.name) {
        case "bounce":
        case "elastic":
        case "back":
          surface = "elastic";
          break;
        case "snappy":
          surface = "crystalline";
          break;
        case "smooth":
        case "soft":
          surface = "soft";
          break;
        case "linear":
          surface = "smooth";
          break;
        default:
          surface = intensity > 0.6 ? "rough" : "smooth";
      }
    }
  }

  // Weight from duration: longer = heavier
  const weight = Math.min(1, comp.durationMs / 3000);

  // Temperature from hue (if available) or intensity
  const temperature = intensity > 0.6 ? 0.5 : intensity < 0.3 ? -0.5 : 0;

  return {
    surface,
    weight,
    temperature,
    rationale: `Easing ${JSON.stringify(easing)} → surface ${surface}; duration ${comp.durationMs}ms → weight ${weight.toFixed(2)}; intensity ${intensity.toFixed(2)} → temperature ${temperature.toFixed(2)}`,
  };
}

// ---------------------------------------------------------------------------
// Character Composition
// ---------------------------------------------------------------------------

/** Compose a sensory character description. */
function composeCharacter(color: ColorMapping, sound: SoundMapping, texture: TextureMapping): string {
  const chars: string[] = [];

  // Color character
  if (color.saturation > 70) chars.push("vivid");
  else if (color.saturation < 40) chars.push("muted");
  else chars.push("balanced");

  // Sound character
  if (sound.pitch > 500) chars.push("bright");
  else if (sound.pitch < 200) chars.push("deep");
  else chars.push("mid-range");

  // Texture character
  chars.push(texture.surface);

  return chars.join(", ");
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/** Translate a motion component into a multi-sensory experience. */
export function translateComponent(comp: MotionComponent): SensoryTranslation {
  const color = mapToColor(comp);
  const sound = mapToSound(comp);
  const texture = mapToTexture(comp);
  const character = composeCharacter(color, sound, texture);

  return {
    componentId: comp.id,
    color,
    sound,
    texture,
    character,
  };
}

/** Translate an entire motion spec into a synesthetic experience. */
export function translateSpec(spec: MotionSpec): SynestheticExperience {
  const translations = spec.components.map(translateComponent);

  // Compose palette
  const palette = translations.map((t) => `${t.color.name} (${t.color.hex})`);

  // Compose soundscape
  const instruments = new Set(translations.map((t) => t.sound.instrument));
  const avgTempo = translations.length > 0
    ? Math.round(translations.reduce((sum, t) => sum + t.sound.tempo, 0) / translations.length)
    : 60;
  const soundscape = `${Array.from(instruments).join(" + ")} at ~${avgTempo} BPM`;

  // Compose tactile character
  const surfaces = new Set(translations.map((t) => t.texture.surface));
  const tactileCharacter = Array.from(surfaces).join(" / ");

  const summary = `Translated ${translations.length} component(s) into a synesthetic experience: ${palette.length} colors, ${instruments.size} instrument(s), ${surfaces.size} texture(s)`;

  return {
    translations,
    palette,
    soundscape,
    tactileCharacter,
    summary,
  };
}

/** Reverse map a sensory input to motion parameters. */
export function mapSensoryToMotion(modality: SensoryToMotionMapping["modality"], value: string | number): SensoryToMotionMapping {
  switch (modality) {
    case "color": {
      const hue = typeof value === "string" ? hexToHue(value) : (value as number);
      // Hue → duration: 0° (red) = short, 270° (violet) = long
      const durationMs = Math.round(200 + (hue / 360) * 4800);
      const easingPreset = hue < 60 ? "snappy" : hue < 180 ? "smooth" : "soft";
      return {
        modality,
        sourceValue: value,
        durationMs,
        easingPreset,
        intensity: 1 - hue / 360,
        hue,
        rationale: `Hue ${Math.round(hue)}° → duration ${durationMs}ms, easing ${easingPreset}, intensity ${(1 - hue / 360).toFixed(2)}`,
      };
    }
    case "sound": {
      const freq = typeof value === "number" ? value : noteToFreq(value);
      // Frequency → duration: high = short, low = long
      const durationMs = Math.round(880 / freq * 1000);
      const easingPreset = freq > 500 ? "bounce" : freq > 200 ? "smooth" : "soft";
      return {
        modality,
        sourceValue: value,
        durationMs,
        easingPreset,
        intensity: Math.min(1, freq / 880),
        rationale: `Frequency ${Math.round(freq)} Hz → duration ${durationMs}ms, easing ${easingPreset}, intensity ${Math.min(1, freq / 880).toFixed(2)}`,
      };
    }
    case "texture": {
      const surface = typeof value === "string" ? value : "smooth";
      const easingMap: Record<string, string> = {
        smooth: "smooth",
        rough: "snappy",
        soft: "soft",
        hard: "snappy",
        liquid: "ease-in-out",
        granular: "linear",
        crystalline: "sharp",
        elastic: "elastic",
      };
      const durationMap: Record<string, number> = {
        smooth: 1500,
        rough: 600,
        soft: 2000,
        hard: 400,
        liquid: 1800,
        granular: 1200,
        crystalline: 800,
        elastic: 1000,
      };
      return {
        modality,
        sourceValue: value,
        durationMs: durationMap[surface] ?? 1500,
        easingPreset: easingMap[surface] ?? "smooth",
        intensity: surface === "rough" || surface === "crystalline" ? 0.8 : 0.5,
        rationale: `Surface ${surface} → duration ${durationMap[surface] ?? 1500}ms, easing ${easingMap[surface] ?? "smooth"}`,
      };
    }
    case "emotion": {
      const emotion = typeof value === "string" ? value : "neutral";
      const emotionMap: Record<string, { duration: number; easing: string; intensity: number }> = {
        joy: { duration: 800, easing: "bounce", intensity: 0.9 },
        calm: { duration: 2500, easing: "soft", intensity: 0.3 },
        anger: { duration: 400, easing: "snappy", intensity: 1.0 },
        fear: { duration: 600, easing: "elastic", intensity: 0.7 },
        surprise: { duration: 500, easing: "back", intensity: 0.9 },
        trust: { duration: 1800, easing: "smooth", intensity: 0.4 },
        anticipation: { duration: 1200, easing: "ease-in", intensity: 0.6 },
        sadness: { duration: 3000, easing: "soft", intensity: 0.2 },
      };
      const mapping = emotionMap[emotion] ?? { duration: 1500, easing: "smooth", intensity: 0.5 };
      return {
        modality,
        sourceValue: value,
        durationMs: mapping.duration,
        easingPreset: mapping.easing,
        intensity: mapping.intensity,
        rationale: `Emotion "${emotion}" → duration ${mapping.duration}ms, easing ${mapping.easing}, intensity ${mapping.intensity}`,
      };
    }
  }
}

/** Convert hex color to hue. */
function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = h * 60;
  if (h < 0) h += 360;
  return h;
}

/** Convert note name to frequency. */
function noteToFreq(note: string): number {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return 440;
  const noteIndex = notes.indexOf(match[1]);
  const octave = parseInt(match[2], 10);
  const semitones = (octave - 4) * 12 + (noteIndex - 9);
  return 440 * Math.pow(2, semitones / 12);
}

/** Format a synesthetic experience as a human-readable report. */
export function formatSynestheticReport(experience: SynestheticExperience): string {
  const lines: string[] = [
    "Motion Synesthesia Report",
    "=========================",
    "",
    `Components translated: ${experience.translations.length}`,
    `Color palette: ${experience.palette.join(", ")}`,
    `Soundscape: ${experience.soundscape}`,
    `Tactile character: ${experience.tactileCharacter}`,
    "",
    "Per-component translations:",
  ];

  for (const t of experience.translations) {
    lines.push(`  • ${t.componentId}:`);
    lines.push(`    Color: ${t.color.name} (${t.color.hex}) — H:${t.color.hue}° S:${t.color.saturation}% L:${t.color.lightness}%`);
    lines.push(`    Sound: ${t.sound.note} (${t.sound.pitch} Hz) on ${t.sound.instrument} at ${t.sound.tempo} BPM`);
    lines.push(`    Texture: ${t.texture.surface}, weight ${t.texture.weight.toFixed(2)}, temp ${t.texture.temperature.toFixed(2)}`);
    lines.push(`    Character: ${t.character}`);
  }

  lines.push("");
  lines.push(`Summary: ${experience.summary}`);
  return lines.join("\n");
}
