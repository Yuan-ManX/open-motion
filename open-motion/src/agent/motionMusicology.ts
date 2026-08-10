/**
 * Motion Musicology Engine — analyzes motion as musical composition.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A note — a single motion event. */
export interface MotionNote {
  componentId: string;
  componentName: string | null;
  /** Pitch class 0..11 (C=0, C#=1, ..., B=11). */
  pitch: number;
  /** Octave 0..8. */
  octave: number;
  /** Note name. */
  noteName: string;
  /** Onset time in ms. */
  onsetMs: number;
  /** Duration in ms. */
  durationMs: number;
  /** Velocity 0..127 (MIDI standard). */
  velocity: number;
  /** Articulation. */
  articulation: "legato" | "staccato" | "tenuto" | "accent" | "marcato" | "sustain";
  /** Description. */
  description: string;
}

/** A chord — multiple simultaneous notes. */
export interface MotionChord {
  /** Time in ms. */
  timeMs: number;
  /** Member component IDs. */
  componentIds: string[];
  /** Member notes. */
  notes: MotionNote[];
  /** Chord quality. */
  quality: "major" | "minor" | "diminished" | "augmented" | "sus4" | "sus2" | "power" | "cluster";
  /** Root pitch class. */
  root: number;
  /** Chord name. */
  name: string;
  /** Description. */
  description: string;
}

/** A melodic phrase — a contiguous sequence of notes. */
export interface MelodicPhrase {
  /** Phrase number. */
  index: number;
  /** Start time in ms. */
  startMs: number;
  /** End time in ms. */
  endMs: number;
  /** Note sequence. */
  notes: MotionNote[];
  /** Contour: ascending, descending, arch, V-shape, flat, undulating. */
  contour: "ascending" | "descending" | "arch" | "v-shape" | "flat" | "undulating";
  /** Range: highest pitch - lowest pitch in semitones. */
  range: number;
  /** Description. */
  description: string;
}

/** Rhythmic analysis. */
export interface RhythmicAnalysis {
  /** Tempo in BPM. */
  bpm: number;
  /** Time signature (inferred). */
  timeSignature: "2/4" | "3/4" | "4/4" | "6/8" | "5/4" | "7/8" | "free";
  /** Beat pattern. */
  beatPattern: number[];
  /** Syncopation level 0..1. */
  syncopation: number;
  /** Groove consistency 0..1. */
  grooveConsistency: number;
  /** Description. */
  description: string;
}

/** Dynamic analysis. */
export interface DynamicAnalysis {
  /** Overall dynamic marking. */
  overall: "pp" | "p" | "mp" | "mf" | "f" | "ff";
  /** Dynamic changes over time. */
  changes: Array<{
    timeMs: number;
    from: string;
    to: string;
    type: "crescendo" | "decrescendo" | "sforzando" | "subito";
  }>;
  /** Dynamic range 0..1. */
  range: number;
  /** Description. */
  description: string;
}

/** Musical form analysis. */
export interface FormAnalysis {
  /** Form type. */
  type: "through-composed" | "AABA" | "ABAB" | "ABA" | "sonata" | "rondo" | "theme-and-variations" | "binary" | "ternary";
  /** Sections. */
  sections: Array<{
    label: string;
    startMs: number;
    endMs: number;
    componentCount: number;
    description: string;
  }>;
  /** Description. */
  description: string;
}

/** Musicology analysis result. */
export interface MusicologyAnalysis {
  notes: MotionNote[];
  chords: MotionChord[];
  phrases: MelodicPhrase[];
  rhythm: RhythmicAnalysis;
  dynamics: DynamicAnalysis;
  form: FormAnalysis;
  /** Key (tonal center). */
  key: string;
  /** Scale type. */
  scale: "major" | "minor" | "dorian" | "mixolydian" | "lydian" | "phrygian" | "locrian" | "chromatic" | "pentatonic";
  /** Overall mood. */
  mood: string;
  /** Harmonic complexity 0..1. */
  harmonicComplexity: number;
  /** Melodic interest 0..1. */
  melodicInterest: number;
  /** Rhythmic vitality 0..1. */
  rhythmicVitality: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Pitch Mapping
// ---------------------------------------------------------------------------

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Map a component to a pitch based on its primary animated property. */
function mapToPitch(comp: MotionComponent): { pitch: number; octave: number; noteName: string } {
  // Use the first keyframe property to determine pitch
  const firstKf = comp.keyframes?.[0];
  const props = (firstKf?.properties ?? {}) as Record<string, string | number>;

  // Map property names to pitch classes
  const pitchMap: Record<string, number> = {
    translateX: 0,   // C
    translateY: 2,   // D
    translateZ: 4,   // E
    scale: 5,        // F
    scaleX: 5,
    scaleY: 7,       // G
    rotate: 9,       // A
    opacity: 11,     // B
    color: 1,        // C#
    backgroundColor: 3, // D#
    boxShadow: 6,    // F#
    blur: 8,         // G#
    brightness: 10,  // A#
  };

  let pitch = 0;
  for (const key of Object.keys(props)) {
    if (key in pitchMap) {
      pitch = pitchMap[key];
      break;
    }
  }

  // Octave: map duration to octave (shorter = higher octave)
  const octave = comp.durationMs < 300 ? 6 :
    comp.durationMs < 600 ? 5 :
    comp.durationMs < 1200 ? 4 :
    comp.durationMs < 2400 ? 3 : 2;

  const noteName = PITCH_NAMES[pitch] + octave;
  return { pitch, octave, noteName };
}

/** Compute MIDI velocity from component intensity. */
function computeVelocity(comp: MotionComponent): number {
  const kfCount = comp.keyframes?.length ?? 0;
  const durationFactor = comp.durationMs < 500 ? 0.9 : comp.durationMs < 1500 ? 0.5 : 0.2;
  const intensity = durationFactor * 0.6 + Math.min(1, kfCount / 8) * 0.4;
  return Math.round(30 + intensity * 90); // 30..120
}

/** Determine articulation from easing. */
function computeArticulation(comp: MotionComponent): MotionNote["articulation"] {
  const easingName =
    typeof comp.easing === "object" && comp.easing !== null && "name" in comp.easing
      ? String((comp.easing as { name?: unknown }).name ?? "ease")
      : "ease";

  if (easingName.includes("bounce") || easingName.includes("elastic")) return "marcato";
  if (easingName.includes("snappy") || easingName.includes("back")) return "staccato";
  if (easingName.includes("smooth") || easingName.includes("soft")) return "legato";
  if (easingName.includes("linear")) return "tenuto";
  if (comp.durationMs < 300) return "staccato";
  if (comp.durationMs > 2000) return "sustain";
  return "accent";
}

// ---------------------------------------------------------------------------
// Note Extraction
// ---------------------------------------------------------------------------

/** Extract notes from components. */
function extractNotes(spec: MotionSpec): MotionNote[] {
  return spec.components.map((comp) => {
    const { pitch, octave, noteName } = mapToPitch(comp);
    const velocity = computeVelocity(comp);
    const articulation = computeArticulation(comp);

    return {
      componentId: comp.id,
      componentName: comp.name,
      pitch,
      octave,
      noteName,
      onsetMs: comp.delayMs,
      durationMs: comp.durationMs,
      velocity,
      articulation,
      description: `${noteName} (vel ${velocity}, ${articulation}) at ${comp.delayMs}ms for ${comp.durationMs}ms`,
    };
  });
}

// ---------------------------------------------------------------------------
// Chord Detection
// ---------------------------------------------------------------------------

/** Detect chords from simultaneous notes. */
function detectChords(notes: MotionNote[]): MotionChord[] {
  const chords: MotionChord[] = [];
  const TOLERANCE_MS = 100;

  // Group notes by onset time
  const groups = new Map<number, MotionNote[]>();
  for (const note of notes) {
    const bucket = Math.round(note.onsetMs / TOLERANCE_MS) * TOLERANCE_MS;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(note);
  }

  for (const [timeMs, groupNotes] of groups) {
    if (groupNotes.length < 2) continue;

    // Determine chord quality from pitch classes
    const pitchClasses = [...new Set(groupNotes.map((n) => n.pitch))].sort((a, b) => a - b);
    const root = pitchClasses[0];

    let quality: MotionChord["quality"] = "cluster";
    if (pitchClasses.length === 2) {
      const interval = (pitchClasses[1] - pitchClasses[0] + 12) % 12;
      if (interval === 7) quality = "power";
      else if (interval === 5) quality = "sus4";
      else if (interval === 2) quality = "sus2";
    } else if (pitchClasses.length === 3) {
      const intervals = [
        (pitchClasses[1] - pitchClasses[0] + 12) % 12,
        (pitchClasses[2] - pitchClasses[1] + 12) % 12,
      ];
      if (intervals[0] === 4 && intervals[1] === 3) quality = "major";
      else if (intervals[0] === 3 && intervals[1] === 4) quality = "minor";
      else if (intervals[0] === 3 && intervals[1] === 3) quality = "diminished";
      else if (intervals[0] === 4 && intervals[1] === 4) quality = "augmented";
    }

    const rootName = PITCH_NAMES[root];
    const name = `${rootName}${quality === "major" ? "" : quality === "minor" ? "m" : quality === "diminished" ? "dim" : quality === "augmented" ? "aug" : quality === "power" ? "5" : quality === "sus4" ? "sus4" : quality === "sus2" ? "sus2" : "-cluster"}`;

    chords.push({
      timeMs,
      componentIds: groupNotes.map((n) => n.componentId),
      notes: groupNotes,
      quality,
      root,
      name,
      description: `${name} chord at ${timeMs}ms — ${groupNotes.length} note(s)`,
    });
  }

  return chords.sort((a, b) => a.timeMs - b.timeMs);
}

// ---------------------------------------------------------------------------
// Phrase Detection
// ---------------------------------------------------------------------------

/** Detect melodic phrases from note sequences. */
function detectPhrases(notes: MotionNote[]): MelodicPhrase[] {
  if (notes.length === 0) return [];

  const sorted = [...notes].sort((a, b) => a.onsetMs - b.onsetMs);
  const phrases: MelodicPhrase[] = [];
  const GAP_THRESHOLD = 500; // ms gap to start a new phrase

  let currentPhrase: MotionNote[] = [sorted[0]];
  let phraseStart = sorted[0].onsetMs;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = curr.onsetMs - (prev.onsetMs + prev.durationMs);

    if (gap > GAP_THRESHOLD) {
      // Close current phrase
      phrases.push(buildPhrase(phrases.length, phraseStart, prev.onsetMs + prev.durationMs, currentPhrase));
      currentPhrase = [curr];
      phraseStart = curr.onsetMs;
    } else {
      currentPhrase.push(curr);
    }
  }
  // Close last phrase
  if (currentPhrase.length > 0) {
    const last = currentPhrase[currentPhrase.length - 1];
    phrases.push(buildPhrase(phrases.length, phraseStart, last.onsetMs + last.durationMs, currentPhrase));
  }

  return phrases;
}

/** Build a phrase object with contour analysis. */
function buildPhrase(index: number, startMs: number, endMs: number, notes: MotionNote[]): MelodicPhrase {
  const midiNotes = notes.map((n) => n.octave * 12 + n.pitch);
  const lowest = Math.min(...midiNotes);
  const highest = Math.max(...midiNotes);
  const range = highest - lowest;

  // Determine contour
  let contour: MelodicPhrase["contour"] = "flat";
  if (notes.length >= 3) {
    const first = midiNotes[0];
    const mid = midiNotes[Math.floor(midiNotes.length / 2)];
    const last = midiNotes[midiNotes.length - 1];
    const ascCount = midiNotes.filter((n, i) => i > 0 && n > midiNotes[i - 1]).length;
    const descCount = midiNotes.filter((n, i) => i > 0 && n < midiNotes[i - 1]).length;

    if (first < mid && mid > last && ascCount > descCount) contour = "arch";
    else if (first > mid && mid < last && descCount > ascCount) contour = "v-shape";
    else if (ascCount > descCount * 2) contour = "ascending";
    else if (descCount > ascCount * 2) contour = "descending";
    else if (Math.abs(ascCount - descCount) <= 1 && range <= 4) contour = "flat";
    else contour = "undulating";
  }

  return {
    index,
    startMs,
    endMs,
    notes,
    contour,
    range,
    description: `Phrase ${index + 1}: ${contour} contour, range ${range} semitone(s), ${notes.length} note(s)`,
  };
}

// ---------------------------------------------------------------------------
// Rhythmic Analysis
// ---------------------------------------------------------------------------

/** Analyze rhythm. */
function analyzeRhythm(spec: MotionSpec): RhythmicAnalysis {
  if (spec.components.length === 0) {
    return {
      bpm: 0,
      timeSignature: "free",
      beatPattern: [],
      syncopation: 0,
      grooveConsistency: 0,
      description: "No rhythmic content",
    };
  }

  // BPM: estimate from average duration
  const avgDuration = spec.components.reduce((sum, c) => sum + c.durationMs, 0) / spec.components.length;
  const bpm = Math.round(60000 / avgDuration);

  // Time signature: estimate from onset patterns
  const onsets = spec.components.map((c) => c.delayMs).sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    intervals.push(onsets[i] - onsets[i - 1]);
  }
  const avgInterval = intervals.length > 0 ? intervals.reduce((s, v) => s + v, 0) / intervals.length : avgDuration;

  let timeSignature: RhythmicAnalysis["timeSignature"] = "4/4";
  const beatsPerMeasure = Math.round(avgDuration / Math.max(50, avgInterval));
  if (beatsPerMeasure === 2) timeSignature = "2/4";
  else if (beatsPerMeasure === 3) timeSignature = "3/4";
  else if (beatsPerMeasure === 6) timeSignature = "6/8";
  else if (beatsPerMeasure === 5) timeSignature = "5/4";
  else if (beatsPerMeasure === 7) timeSignature = "7/8";

  // Syncopation: how often onsets fall off the beat
  const beatDuration = avgInterval;
  let syncopated = 0;
  for (const onset of onsets) {
    const offset = (onset % beatDuration) / beatDuration;
    if (offset > 0.25 && offset < 0.75) syncopated++;
  }
  const syncopation = onsets.length > 0 ? syncopated / onsets.length : 0;

  // Groove consistency: variance of intervals (lower variance = higher consistency)
  const intervalVariance = intervals.length > 0
    ? intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / intervals.length
    : 0;
  const grooveConsistency = avgInterval > 0 ? Math.max(0, 1 - Math.sqrt(intervalVariance) / avgInterval) : 0;

  const beatPattern = intervals.slice(0, 8);

  return {
    bpm,
    timeSignature,
    beatPattern,
    syncopation,
    grooveConsistency,
    description: `${bpm} BPM in ${timeSignature}, syncopation ${(syncopation * 100).toFixed(0)}%, groove consistency ${(grooveConsistency * 100).toFixed(0)}%`,
  };
}

// ---------------------------------------------------------------------------
// Dynamic Analysis
// ---------------------------------------------------------------------------

/** Analyze dynamics. */
function analyzeDynamics(spec: MotionSpec, notes: MotionNote[]): DynamicAnalysis {
  if (notes.length === 0) {
    return { overall: "mp", changes: [], range: 0, description: "No dynamic content" };
  }

  const avgVelocity = notes.reduce((sum, n) => sum + n.velocity, 0) / notes.length;
  const maxVel = Math.max(...notes.map((n) => n.velocity));
  const minVel = Math.min(...notes.map((n) => n.velocity));

  const overall: DynamicAnalysis["overall"] =
    avgVelocity < 45 ? "pp" :
    avgVelocity < 60 ? "p" :
    avgVelocity < 75 ? "mp" :
    avgVelocity < 90 ? "mf" :
    avgVelocity < 105 ? "f" : "ff";

  // Detect dynamic changes
  const changes: DynamicAnalysis["changes"] = [];
  const sorted = [...notes].sort((a, b) => a.onsetMs - b.onsetMs);
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].velocity - sorted[i - 1].velocity;
    if (Math.abs(diff) >= 20) {
      changes.push({
        timeMs: sorted[i].onsetMs,
        from: sorted[i - 1].velocity < 60 ? "p" : sorted[i - 1].velocity < 90 ? "mf" : "f",
        to: sorted[i].velocity < 60 ? "p" : sorted[i].velocity < 90 ? "mf" : "f",
        type: diff > 30 ? "sforzando" : diff > 0 ? "crescendo" : diff < -30 ? "subito" : "decrescendo",
      });
    }
  }

  const range = maxVel > 0 ? (maxVel - minVel) / 127 : 0;

  return {
    overall,
    changes,
    range,
    description: `${overall} with ${changes.length} dynamic change(s), range ${(range * 100).toFixed(0)}%`,
  };
}

// ---------------------------------------------------------------------------
// Form Analysis
// ---------------------------------------------------------------------------

/** Analyze musical form. */
function analyzeForm(spec: MotionSpec): FormAnalysis {
  if (spec.components.length === 0) {
    return { type: "through-composed", sections: [], description: "No form" };
  }

  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const sectionCount = Math.min(4, Math.max(1, Math.floor(spec.components.length / 3)));
  const sectionDuration = timelineEnd / sectionCount;

  const sections: FormAnalysis["sections"] = [];
  const labels = ["A", "B", "C", "D"];

  for (let i = 0; i < sectionCount; i++) {
    const startMs = i * sectionDuration;
    const endMs = (i + 1) * sectionDuration;
    const compsInSection = spec.components.filter(
      (c) => c.delayMs >= startMs && c.delayMs < endMs,
    );
    sections.push({
      label: labels[i],
      startMs,
      endMs,
      componentCount: compsInSection.length,
      description: `Section ${labels[i]}: ${compsInSection.length} component(s)`,
    });
  }

  // Determine form type
  let type: FormAnalysis["type"] = "through-composed";
  if (sectionCount === 2) type = "binary";
  else if (sectionCount === 3) type = "ternary";
  else if (sectionCount === 4) {
    // Check for AABA pattern (sections with similar component counts)
    const counts = sections.map((s) => s.componentCount);
    if (counts[0] === counts[1] && counts[1] === counts[3]) type = "AABA";
    else if (counts[0] === counts[2] && counts[1] === counts[3]) type = "ABAB";
    else type = "sonata";
  }

  return {
    type,
    sections,
    description: `${type} form with ${sectionCount} section(s)`,
  };
}

// ---------------------------------------------------------------------------
// Key Detection
// ---------------------------------------------------------------------------

/** Detect the tonal center (key) from note distribution. */
function detectKey(notes: MotionNote[]): { key: string; scale: MusicologyAnalysis["scale"] } {
  if (notes.length === 0) return { key: "C", scale: "major" };

  // Count pitch class occurrences
  const counts = new Array(12).fill(0);
  for (const note of notes) {
    counts[note.pitch]++;
  }

  // Find the most common pitch class as the root
  let maxCount = 0;
  let root = 0;
  for (let i = 0; i < 12; i++) {
    if (counts[i] > maxCount) {
      maxCount = counts[i];
      root = i;
    }
  }

  // Determine scale from pitch distribution
  const majorScale = [0, 2, 4, 5, 7, 9, 11];
  const minorScale = [0, 2, 3, 5, 7, 8, 10];

  let majorScore = 0;
  let minorScore = 0;
  for (let i = 0; i < 12; i++) {
    if (majorScale.includes((i - root + 12) % 12)) majorScore += counts[i];
    if (minorScale.includes((i - root + 12) % 12)) minorScore += counts[i];
  }

  const key = PITCH_NAMES[root];
  const scale: MusicologyAnalysis["scale"] = majorScore >= minorScore ? "major" : "minor";

  return { key, scale };
}

// ---------------------------------------------------------------------------
// Complexity Metrics
// ---------------------------------------------------------------------------

/** Compute harmonic complexity from chord diversity. */
function computeHarmonicComplexity(chords: MotionChord[]): number {
  if (chords.length === 0) return 0;
  const qualities = new Set(chords.map((c) => c.quality));
  const uniqueRoots = new Set(chords.map((c) => c.root));
  return Math.min(1, (qualities.size / 8 + uniqueRoots.size / 12) / 2);
}

/** Compute melodic interest from phrase variety. */
function computeMelodicInterest(phrases: MelodicPhrase[]): number {
  if (phrases.length === 0) return 0;
  const contours = new Set(phrases.map((p) => p.contour));
  const avgRange = phrases.reduce((sum, p) => sum + p.range, 0) / phrases.length;
  return Math.min(1, (contours.size / 6 + Math.min(1, avgRange / 24)) / 2);
}

/** Compute rhythmic vitality from syncopation and groove. */
function computeRhythmicVitality(rhythm: RhythmicAnalysis): number {
  return Math.min(1, (rhythm.syncopation + rhythm.grooveConsistency) / 2);
}

// ---------------------------------------------------------------------------
// Main Analysis
// ---------------------------------------------------------------------------

/** Analyze the musicology of a motion composition. */
export function analyzeMusicology(spec: MotionSpec): MusicologyAnalysis {
  if (spec.components.length === 0) {
    return {
      notes: [],
      chords: [],
      phrases: [],
      rhythm: { bpm: 0, timeSignature: "free", beatPattern: [], syncopation: 0, grooveConsistency: 0, description: "No rhythmic content" },
      dynamics: { overall: "mp", changes: [], range: 0, description: "No dynamic content" },
      form: { type: "through-composed", sections: [], description: "No form" },
      key: "C",
      scale: "major",
      mood: "silent",
      harmonicComplexity: 0,
      melodicInterest: 0,
      rhythmicVitality: 0,
      summary: "No components — the score is empty.",
    };
  }

  const notes = extractNotes(spec);
  const chords = detectChords(notes);
  const phrases = detectPhrases(notes);
  const rhythm = analyzeRhythm(spec);
  const dynamics = analyzeDynamics(spec, notes);
  const form = analyzeForm(spec);
  const { key, scale } = detectKey(notes);

  const harmonicComplexity = computeHarmonicComplexity(chords);
  const melodicInterest = computeMelodicInterest(phrases);
  const rhythmicVitality = computeRhythmicVitality(rhythm);

  // Mood: combine key, scale, and dynamics
  const moodParts: string[] = [];
  if (scale === "minor") moodParts.push("melancholic");
  else moodParts.push("bright");
  if (dynamics.overall === "pp" || dynamics.overall === "p") moodParts.push("intimate");
  else if (dynamics.overall === "f" || dynamics.overall === "ff") moodParts.push("energetic");
  else moodParts.push("balanced");
  if (rhythm.syncopation > 0.4) moodParts.push("playful");
  else if (rhythm.grooveConsistency > 0.7) moodParts.push("steady");
  if (harmonicComplexity > 0.6) moodParts.push("complex");
  const mood = moodParts.join(", ");

  const summary =
    `Musicology: ${key} ${scale}, ${rhythm.bpm} BPM ${rhythm.timeSignature}, ` +
    `${form.type} form, ${notes.length} note(s), ${chords.length} chord(s), ${phrases.length} phrase(s), ` +
    `mood: ${mood}`;

  return {
    notes,
    chords,
    phrases,
    rhythm,
    dynamics,
    form,
    key,
    scale,
    mood,
    harmonicComplexity,
    melodicInterest,
    rhythmicVitality,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a musicology analysis as a human-readable report. */
export function formatMusicologyReport(analysis: MusicologyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Musicology Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // Score
  lines.push("## Score");
  lines.push(`- Key: ${analysis.key} ${analysis.scale}`);
  lines.push(`- Tempo: ${analysis.rhythm.bpm} BPM (${analysis.rhythm.timeSignature})`);
  lines.push(`- Dynamics: ${analysis.dynamics.overall}`);
  lines.push(`- Form: ${analysis.form.type}`);
  lines.push(`- Mood: ${analysis.mood}`);
  lines.push("");

  // Notes
  lines.push("## Notes");
  if (analysis.notes.length === 0) {
    lines.push("- No notes detected");
  } else {
    for (const n of analysis.notes) {
      lines.push(`- ${n.noteName} (vel ${n.velocity}, ${n.articulation}) at ${n.onsetMs}ms — ${n.componentName ?? n.componentId}`);
    }
  }
  lines.push("");

  // Chords
  lines.push("## Harmony");
  if (analysis.chords.length === 0) {
    lines.push("- No chords detected");
  } else {
    for (const c of analysis.chords) {
      lines.push(`- ${c.name} at ${c.timeMs}ms — ${c.notes.length} note(s)`);
    }
  }
  lines.push("");

  // Phrases
  lines.push("## Melodic Phrases");
  if (analysis.phrases.length === 0) {
    lines.push("- No phrases detected");
  } else {
    for (const p of analysis.phrases) {
      lines.push(`- Phrase ${p.index + 1}: ${p.contour}, range ${p.range} st, ${p.notes.length} note(s)`);
    }
  }
  lines.push("");

  // Rhythm
  lines.push("## Rhythm");
  lines.push(`- BPM: ${analysis.rhythm.bpm}`);
  lines.push(`- Time signature: ${analysis.rhythm.timeSignature}`);
  lines.push(`- Syncopation: ${(analysis.rhythm.syncopation * 100).toFixed(0)}%`);
  lines.push(`- Groove consistency: ${(analysis.rhythm.grooveConsistency * 100).toFixed(0)}%`);
  lines.push("");

  // Dynamics
  lines.push("## Dynamics");
  lines.push(`- Overall: ${analysis.dynamics.overall}`);
  lines.push(`- Range: ${(analysis.dynamics.range * 100).toFixed(0)}%`);
  if (analysis.dynamics.changes.length > 0) {
    lines.push("- Changes:");
    for (const c of analysis.dynamics.changes) {
      lines.push(`  - ${c.type} at ${c.timeMs}ms (${c.from} → ${c.to})`);
    }
  }
  lines.push("");

  // Complexity
  lines.push("## Complexity");
  lines.push(`- Harmonic complexity: ${(analysis.harmonicComplexity * 100).toFixed(0)}%`);
  lines.push(`- Melodic interest: ${(analysis.melodicInterest * 100).toFixed(0)}%`);
  lines.push(`- Rhythmic vitality: ${(analysis.rhythmicVitality * 100).toFixed(0)}%`);

  return lines.join("\n");
}
