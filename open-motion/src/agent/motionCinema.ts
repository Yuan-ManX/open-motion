/**
 * Motion Cinema Engine — analyzes motion as a cinematic sequence.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A cinematic shot. */
export interface CinematicShot {
  componentId: string;
  componentName: string | null;
  /** Shot size. */
  size: "extreme-wide" | "wide" | "medium-wide" | "medium" | "medium-close" | "close-up" | "extreme-close-up";
  /** Shot angle. */
  angle: "eye-level" | "high" | "low" | "dutch" | "overhead" | "worms-eye";
  /** Camera movement. */
  cameraMovement: "static" | "pan" | "tilt" | "dolly" | "zoom" | "crane" | "tracking" | "handheld" | "steady-cam";
  /** Shot duration in ms. */
  durationMs: number;
  /** Description. */
  description: string;
}

/** A cut or transition between shots. */
interface CutOrTransition {
  /** Type: cut (abrupt) or transition (smooth). */
  kind: "cut" | "transition";
  /** Time in ms. */
  timeMs: number;
  /** Transition type (if kind is transition). */
  transitionType?: "dissolve" | "fade" | "wipe" | "iris" | "morph" | "crossfade";
  /** From component ID. */
  from: string;
  /** To component ID. */
  to: string;
  /** Description. */
  description: string;
}

/** Mise-en-scène analysis. */
export interface MiseEnScene {
  /** Composition balance 0..1. */
  balance: number;
  /** Depth of field. */
  depthOfField: "shallow" | "medium" | "deep";
  /** Color palette. */
  colorPalette: "warm" | "cool" | "neutral" | "monochrome" | "saturated" | "desaturated";
  /** Lighting. */
  lighting: "low-key" | "high-key" | "chiaroscuro" | "natural" | "artificial" | "backlit";
  /** Density (number of simultaneous elements). */
  density: number;
  /** Description. */
  description: string;
}

/** Narrative structure. */
export interface NarrativeStructure {
  /** Structure type. */
  type: "three-act" | "five-act" | "heros-journey" | "kishōtenketsu" | "episodic" | "non-linear" | "minimal";
  /** Acts detected. */
  acts: Array<{
    label: string;
    startMs: number;
    endMs: number;
    description: string;
  }>;
  /** Description. */
  description: string;
}

/** Pacing analysis. */
export interface PacingAnalysis {
  /** Average shot length in ms. */
  averageShotLength: number;
  /** Pace classification. */
  pace: "very-slow" | "slow" | "moderate" | "fast" | "very-fast";
  /** Rhythm: regular or irregular. */
  rhythm: "regular" | "irregular" | "accelerating" | "decelerating";
  /** Description. */
  description: string;
}

/** Montage analysis. */
export interface MontageAnalysis {
  /** Montage type. */
  type: "sequential" | "dialectical" | "rhythmic" | "tonal" | "overtonal" | "intellectual" | "none";
  /** Sequence length. */
  sequenceLength: number;
  /** Description. */
  description: string;
}

/** Genre classification. */
export interface GenreAnalysis {
  /** Primary genre. */
  primary: "action" | "drama" | "comedy" | "documentary" | "experimental" | "horror" | "romance" | "thriller" | "musical" | "silent";
  /** Secondary genre. */
  secondary: string | null;
  /** Confidence 0..1. */
  confidence: number;
  /** Description. */
  description: string;
}

/** Cinema analysis result. */
export interface CinemaAnalysis {
  shots: CinematicShot[];
  cuts: CutOrTransition[];
  miseEnScene: MiseEnScene;
  narrative: NarrativeStructure;
  pacing: PacingAnalysis;
  montage: MontageAnalysis;
  genre: GenreAnalysis;
  /** Total runtime in ms. */
  runtime: number;
  /** Frame count (approximate, keyframe-based). */
  frameCount: number;
  /** Aspect ratio guess. */
  aspectRatio: string;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Shot Analysis
// ---------------------------------------------------------------------------

/** Classify a component as a cinematic shot. */
function classifyShot(comp: MotionComponent): CinematicShot {
  const firstKf = comp.keyframes?.[0];
  const props = (firstKf?.properties ?? {}) as Record<string, string | number>;
  const kfs = comp.keyframes ?? [];

  // Shot size: based on scale and duration
  let size: CinematicShot["size"] = "medium";
  const hasScale = "scale" in props;
  const scaleValue = hasScale ? Number(props.scale) : 1;

  if (kfs.length === 0 || comp.durationMs > 3000) {
    size = "extreme-wide";
  } else if (comp.durationMs > 1500) {
    size = "wide";
  } else if (comp.durationMs > 800) {
    size = scaleValue > 1.2 ? "close-up" : "medium-wide";
  } else if (comp.durationMs > 300) {
    size = scaleValue > 1.5 ? "extreme-close-up" : "medium";
  } else {
    size = scaleValue > 1.5 ? "extreme-close-up" : "medium-close";
  }

  // Shot angle: based on translateY
  let angle: CinematicShot["angle"] = "eye-level";
  if ("translateY" in props && typeof props.translateY === "number") {
    if (props.translateY < -50) angle = "high";
    else if (props.translateY > 50) angle = "low";
    else if (props.translateY < -200) angle = "overhead";
    else if (props.translateY > 200) angle = "worms-eye";
  }
  if ("rotate" in props && typeof props.rotate === "number" && Math.abs(props.rotate) > 15) {
    angle = "dutch";
  }

  // Camera movement: based on property types
  let cameraMovement: CinematicShot["cameraMovement"] = "static";
  if (kfs.length >= 2) {
    const allProps = kfs.map((k) => (k.properties ?? {}) as Record<string, string | number>);
    const hasTranslateX = allProps.some((p) => "translateX" in p);
    const hasTranslateY = allProps.some((p) => "translateY" in p);
    const hasScaleChange = allProps.some((p) => "scale" in p);
    const hasRotate = allProps.some((p) => "rotate" in p);

    if (hasTranslateX && hasTranslateY) cameraMovement = "tracking";
    else if (hasTranslateX) cameraMovement = "pan";
    else if (hasTranslateY) cameraMovement = "tilt";
    else if (hasScaleChange) cameraMovement = "zoom";
    else if (hasRotate) cameraMovement = "handheld";

    // Long durations with movement = crane or steady-cam
    if (comp.durationMs > 2000 && cameraMovement !== "static") {
      cameraMovement = comp.durationMs > 4000 ? "steady-cam" : "crane";
    }
  }

  return {
    componentId: comp.id,
    componentName: comp.name,
    size,
    angle,
    cameraMovement,
    durationMs: comp.durationMs,
    description: `${size} shot, ${angle} angle, ${cameraMovement} camera — ${comp.durationMs}ms`,
  };
}

/** Extract shots from components. */
function extractShots(spec: MotionSpec): CinematicShot[] {
  return [...spec.components]
    .sort((a, b) => a.delayMs - b.delayMs)
    .map((comp) => classifyShot(comp));
}

// ---------------------------------------------------------------------------
// Cut & Transition Detection
// ---------------------------------------------------------------------------

/** Detect cuts and transitions between shots. */
function detectCuts(spec: MotionSpec): CutOrTransition[] {
  const cuts: CutOrTransition[] = [];
  if (spec.components.length < 2) return cuts;

  const sorted = [...spec.components].sort((a, b) => a.delayMs - b.delayMs);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevEnd = prev.delayMs + prev.durationMs;
    const gap = curr.delayMs - prevEnd;

    if (gap <= 50) {
      // Hard cut
      cuts.push({
        kind: "cut",
        timeMs: curr.delayMs,
        from: prev.id,
        to: curr.id,
        description: `Hard cut at ${curr.delayMs}ms — ${prev.name ?? prev.id} → ${curr.name ?? curr.id}`,
      });
    } else if (gap <= 300) {
      // Quick dissolve
      cuts.push({
        kind: "transition",
        timeMs: curr.delayMs,
        transitionType: "dissolve",
        from: prev.id,
        to: curr.id,
        description: `Dissolve transition at ${curr.delayMs}ms`,
      });
    } else if (gap <= 800) {
      // Fade or wipe
      const currProps = (curr.keyframes?.[0]?.properties ?? {}) as Record<string, string | number>;
      const transitionType: CutOrTransition["transitionType"] =
        "opacity" in currProps ? "fade" : "wipe";
      cuts.push({
        kind: "transition",
        timeMs: curr.delayMs,
        transitionType,
        from: prev.id,
        to: curr.id,
        description: `${transitionType} transition at ${curr.delayMs}ms`,
      });
    } else if (gap <= 2000) {
      // Iris or morph (longer gap)
      cuts.push({
        kind: "transition",
        timeMs: curr.delayMs,
        transitionType: "iris",
        from: prev.id,
        to: curr.id,
        description: `Iris transition at ${curr.delayMs}ms`,
      });
    }
    // Gaps > 2000 are scene changes, not transitions
  }

  return cuts;
}

// ---------------------------------------------------------------------------
// Mise-en-scène Analysis
// ---------------------------------------------------------------------------

/** Analyze the mise-en-scène of the composition. */
function analyzeMiseEnScene(spec: MotionSpec): MiseEnScene {
  if (spec.components.length === 0) {
    return {
      balance: 0.5,
      depthOfField: "medium",
      colorPalette: "neutral",
      lighting: "natural",
      density: 0,
      description: "Empty scene",
    };
  }

  // Balance: based on positional distribution
  let leftCount = 0;
  let rightCount = 0;
  for (const comp of spec.components) {
    const props = (comp.keyframes?.[0]?.properties ?? {}) as Record<string, string | number>;
    if ("translateX" in props && typeof props.translateX === "number") {
      if (props.translateX < 0) leftCount++;
      else if (props.translateX > 0) rightCount++;
    }
  }
  const total = leftCount + rightCount;
  const balance = total === 0 ? 0.5 : 1 - Math.abs(leftCount - rightCount) / total;

  // Depth of field: based on blur usage
  let blurCount = 0;
  for (const comp of spec.components) {
    const props = (comp.keyframes?.[0]?.properties ?? {}) as Record<string, string | number>;
    if ("blur" in props) blurCount++;
  }
  const depthOfField: MiseEnScene["depthOfField"] =
    blurCount > spec.components.length / 2 ? "shallow" :
    blurCount > 0 ? "medium" : "deep";

  // Color palette
  let warmCount = 0;
  let coolCount = 0;
  let saturatedCount = 0;
  for (const comp of spec.components) {
    const props = (comp.keyframes?.[0]?.properties ?? {}) as Record<string, string | number>;
    if ("color" in props || "backgroundColor" in props) {
      const colorVal = String(props.color ?? props.backgroundColor ?? "");
      if (/red|orange|yellow|warm/i.test(colorVal)) warmCount++;
      else if (/blue|cyan|green|cool/i.test(colorVal)) coolCount++;
      saturatedCount++;
    }
  }
  let colorPalette: MiseEnScene["colorPalette"] = "neutral";
  if (saturatedCount === 0) colorPalette = "monochrome";
  else if (warmCount > coolCount * 2) colorPalette = "warm";
  else if (coolCount > warmCount * 2) colorPalette = "cool";
  else if (saturatedCount > spec.components.length / 2) colorPalette = "saturated";
  else if (saturatedCount < spec.components.length / 4) colorPalette = "desaturated";

  // Lighting: based on brightness
  let brightnessSum = 0;
  let brightnessCount = 0;
  for (const comp of spec.components) {
    const props = (comp.keyframes?.[0]?.properties ?? {}) as Record<string, string | number>;
    if ("brightness" in props && typeof props.brightness === "number") {
      brightnessSum += props.brightness;
      brightnessCount++;
    }
  }
  let lighting: MiseEnScene["lighting"] = "natural";
  if (brightnessCount > 0) {
    const avgBrightness = brightnessSum / brightnessCount;
    if (avgBrightness < 0.3) lighting = "low-key";
    else if (avgBrightness > 0.8) lighting = "high-key";
    else if (avgBrightness > 0.5 && avgBrightness < 0.7) lighting = "chiaroscuro";
  }

  // Density: average simultaneous components
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const samples = 10;
  let densitySum = 0;
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * timelineEnd;
    const active = spec.components.filter(
      (c) => c.delayMs <= t && c.delayMs + c.durationMs >= t,
    );
    densitySum += active.length;
  }
  const density = densitySum / samples;

  return {
    balance,
    depthOfField,
    colorPalette,
    lighting,
    density,
    description: `${colorPalette} palette, ${lighting} lighting, ${depthOfField} DoF, balance ${(balance * 100).toFixed(0)}%, density ${density.toFixed(1)}`,
  };
}

// ---------------------------------------------------------------------------
// Narrative Structure
// ---------------------------------------------------------------------------

/** Detect narrative structure. */
function detectNarrative(spec: MotionSpec): NarrativeStructure {
  if (spec.components.length === 0) {
    return {
      type: "minimal",
      acts: [],
      description: "No narrative — empty composition",
    };
  }

  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const componentCount = spec.components.length;

  // Detect structure type by component count and pattern
  let type: NarrativeStructure["type"] = "minimal";
  const acts: NarrativeStructure["acts"] = [];

  if (componentCount >= 8) {
    // Five-act structure (suitable for complex compositions)
    type = "five-act";
    const actLength = timelineEnd / 5;
    const actLabels = ["Exposition", "Rising Action", "Climax", "Falling Action", "Resolution"];
    for (let i = 0; i < 5; i++) {
      acts.push({
        label: actLabels[i],
        startMs: i * actLength,
        endMs: (i + 1) * actLength,
        description: `${actLabels[i]} — ${i * actLength}ms to ${(i + 1) * actLength}ms`,
      });
    }
  } else if (componentCount >= 5) {
    // Three-act structure
    type = "three-act";
    const actLength = timelineEnd / 3;
    acts.push({ label: "Setup", startMs: 0, endMs: actLength, description: `Setup — 0 to ${actLength}ms` });
    acts.push({ label: "Confrontation", startMs: actLength, endMs: 2 * actLength, description: `Confrontation — ${actLength} to ${2 * actLength}ms` });
    acts.push({ label: "Resolution", startMs: 2 * actLength, endMs: timelineEnd, description: `Resolution — ${2 * actLength} to ${timelineEnd}ms` });
  } else if (componentCount >= 3) {
    // Kishōtenketsu (Asian 4-act structure without conflict)
    type = "kishōtenketsu";
    const actLength = timelineEnd / 4;
    const actLabels = ["Ki (Introduction)", "Shō (Development)", "Ten (Twist)", "Ketsu (Conclusion)"];
    for (let i = 0; i < 4; i++) {
      acts.push({
        label: actLabels[i],
        startMs: i * actLength,
        endMs: (i + 1) * actLength,
        description: `${actLabels[i]} — ${i * actLength}ms to ${(i + 1) * actLength}ms`,
      });
    }
  } else if (componentCount === 2) {
    // Hero's journey (simplified)
    type = "heros-journey";
    const midpoint = timelineEnd / 2;
    acts.push({ label: "Departure", startMs: 0, endMs: midpoint, description: `Departure — 0 to ${midpoint}ms` });
    acts.push({ label: "Return", startMs: midpoint, endMs: timelineEnd, description: `Return — ${midpoint} to ${timelineEnd}ms` });
  } else {
    // Single shot — episodic or minimal
    type = componentCount === 1 ? "minimal" : "episodic";
    acts.push({
      label: "Single Beat",
      startMs: 0,
      endMs: timelineEnd,
      description: `Single beat — 0 to ${timelineEnd}ms`,
    });
  }

  return {
    type,
    acts,
    description: `${type} structure with ${acts.length} act(s)`,
  };
}

// ---------------------------------------------------------------------------
// Pacing Analysis
// ---------------------------------------------------------------------------

/** Analyze pacing of the composition. */
function analyzePacing(spec: MotionSpec): PacingAnalysis {
  if (spec.components.length === 0) {
    return {
      averageShotLength: 0,
      pace: "moderate",
      rhythm: "regular",
      description: "No pacing — empty composition",
    };
  }

  const durations = spec.components.map((c) => c.durationMs);
  const averageShotLength = durations.reduce((a, b) => a + b, 0) / durations.length;

  let pace: PacingAnalysis["pace"] = "moderate";
  if (averageShotLength < 200) pace = "very-fast";
  else if (averageShotLength < 500) pace = "fast";
  else if (averageShotLength < 1500) pace = "moderate";
  else if (averageShotLength < 3000) pace = "slow";
  else pace = "very-slow";

  // Rhythm: based on variance of durations
  const variance = durations.reduce((s, d) => s + Math.pow(d - averageShotLength, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / Math.max(1, averageShotLength);

  let rhythm: PacingAnalysis["rhythm"] = "regular";
  if (cv > 0.5) rhythm = "irregular";
  else {
    // Check for accelerating or decelerating pattern
    const sorted = [...spec.components].sort((a, b) => a.delayMs - b.delayMs);
    const sortedDurs = sorted.map((c) => c.durationMs);
    let increasing = 0;
    let decreasing = 0;
    for (let i = 1; i < sortedDurs.length; i++) {
      if (sortedDurs[i] > sortedDurs[i - 1]) increasing++;
      else if (sortedDurs[i] < sortedDurs[i - 1]) decreasing++;
    }
    if (increasing > decreasing * 1.5) rhythm = "decelerating";
    else if (decreasing > increasing * 1.5) rhythm = "accelerating";
  }

  return {
    averageShotLength,
    pace,
    rhythm,
    description: `${pace} pace, ${rhythm} rhythm, avg shot ${averageShotLength.toFixed(0)}ms`,
  };
}

// ---------------------------------------------------------------------------
// Montage Analysis
// ---------------------------------------------------------------------------

/** Analyze montage type. */
function analyzeMontage(spec: MotionSpec, cuts: CutOrTransition[]): MontageAnalysis {
  if (spec.components.length < 3) {
    return {
      type: "none",
      sequenceLength: spec.components.length,
      description: "No montage — too few shots",
    };
  }

  // Determine montage type from cut patterns
  const cutCount = cuts.filter((c) => c.kind === "cut").length;
  const transitionCount = cuts.filter((c) => c.kind === "transition").length;
  const totalCuts = cutCount + transitionCount;

  let type: MontageAnalysis["type"] = "sequential";
  if (cutCount > transitionCount * 2) {
    // Many hard cuts — could be dialectical or rhythmic
    const durations = spec.components.map((c) => c.durationMs);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / durations.length;
    const cv = Math.sqrt(variance) / Math.max(1, avg);

    if (cv < 0.2) type = "rhythmic";
    else if (cv > 0.7) type = "dialectical";
    else type = "tonal";
  } else if (transitionCount > cutCount) {
    type = "tonal";
  } else if (totalCuts > 5 && spec.components.length > 6) {
    type = "intellectual";
  }

  return {
    type,
    sequenceLength: spec.components.length,
    description: `${type} montage — ${spec.components.length} shot sequence`,
  };
}

// ---------------------------------------------------------------------------
// Genre Classification
// ---------------------------------------------------------------------------

/** Classify the genre of the composition. */
function classifyGenre(spec: MotionSpec, pacing: PacingAnalysis, miseEnScene: MiseEnScene): GenreAnalysis {
  const totalKfs = spec.components.reduce((s, c) => s + (c.keyframes?.length ?? 0), 0);
  const avgKfs = totalKfs / Math.max(1, spec.components.length);

  let primary: GenreAnalysis["primary"] = "drama";
  let confidence = 0.5;
  const scores: Record<string, number> = {
    action: 0,
    drama: 0,
    comedy: 0,
    documentary: 0,
    experimental: 0,
    horror: 0,
    romance: 0,
    thriller: 0,
    musical: 0,
    silent: 0,
  };

  // Action: fast pace, many keyframes, saturated colors
  if (pacing.pace === "very-fast" || pacing.pace === "fast") scores.action += 0.3;
  if (avgKfs > 3) scores.action += 0.2;
  if (miseEnScene.colorPalette === "saturated") scores.action += 0.2;

  // Drama: moderate pace, natural lighting
  if (pacing.pace === "moderate") scores.drama += 0.3;
  if (miseEnScene.lighting === "natural") scores.drama += 0.2;

  // Comedy: fast to moderate pace, high-key lighting
  if (pacing.pace === "fast" || pacing.pace === "moderate") scores.comedy += 0.2;
  if (miseEnScene.lighting === "high-key") scores.comedy += 0.3;

  // Documentary: slow pace, neutral palette
  if (pacing.pace === "slow" || pacing.pace === "very-slow") scores.documentary += 0.3;
  if (miseEnScene.colorPalette === "neutral") scores.documentary += 0.2;

  // Experimental: irregular rhythm, unusual palette
  if (pacing.rhythm === "irregular") scores.experimental += 0.4;
  if (miseEnScene.colorPalette === "monochrome") scores.experimental += 0.2;

  // Horror: low-key lighting, slow pace
  if (miseEnScene.lighting === "low-key") scores.horror += 0.4;
  if (pacing.pace === "slow") scores.horror += 0.2;

  // Romance: warm palette, moderate pace
  if (miseEnScene.colorPalette === "warm") scores.romance += 0.3;
  if (pacing.pace === "moderate") scores.romance += 0.2;

  // Thriller: fast pace, chiaroscuro lighting
  if (pacing.pace === "fast") scores.thriller += 0.3;
  if (miseEnScene.lighting === "chiaroscuro") scores.thriller += 0.3;

  // Musical: regular rhythm, saturated palette
  if (pacing.rhythm === "regular" && spec.components.length > 4) scores.musical += 0.3;
  if (miseEnScene.colorPalette === "saturated") scores.musical += 0.2;

  // Silent: monochrome, very slow or very fast
  if (miseEnScene.colorPalette === "monochrome") scores.silent += 0.4;

  // Find primary and secondary
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  primary = sorted[0][0] as GenreAnalysis["primary"];
  confidence = sorted[0][1];
  const secondary = sorted[1][1] > 0.1 ? sorted[1][0] : null;

  return {
    primary,
    secondary,
    confidence,
    description: `${primary}${secondary ? `/${secondary}` : ""} (confidence ${(confidence * 100).toFixed(0)}%)`,
  };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/** Analyze a motion composition as a cinematic sequence. */
export function analyzeCinema(spec: MotionSpec): CinemaAnalysis {
  if (spec.components.length === 0) {
    return {
      shots: [],
      cuts: [],
      miseEnScene: {
        balance: 0.5,
        depthOfField: "medium",
        colorPalette: "neutral",
        lighting: "natural",
        density: 0,
        description: "Empty scene",
      },
      narrative: {
        type: "minimal",
        acts: [],
        description: "No narrative — empty composition",
      },
      pacing: {
        averageShotLength: 0,
        pace: "moderate",
        rhythm: "regular",
        description: "No pacing — empty composition",
      },
      montage: {
        type: "none",
        sequenceLength: 0,
        description: "No montage — empty composition",
      },
      genre: {
        primary: "drama",
        secondary: null,
        confidence: 0,
        description: "No genre — empty composition",
      },
      runtime: 0,
      frameCount: 0,
      aspectRatio: "16:9",
      summary: "Cinema: empty composition",
    };
  }

  const shots = extractShots(spec);
  const cuts = detectCuts(spec);
  const miseEnScene = analyzeMiseEnScene(spec);
  const pacing = analyzePacing(spec);
  const narrative = detectNarrative(spec);
  const montage = analyzeMontage(spec, cuts);
  const genre = classifyGenre(spec, pacing, miseEnScene);

  const runtime = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const frameCount = spec.components.reduce((s, c) => s + (c.keyframes?.length ?? 0), 0);

  // Aspect ratio guess: based on translate ranges
  let xRange = 0;
  let yRange = 0;
  for (const comp of spec.components) {
    const props = (comp.keyframes?.[0]?.properties ?? {}) as Record<string, string | number>;
    if ("translateX" in props && typeof props.translateX === "number") xRange = Math.max(xRange, Math.abs(props.translateX));
    if ("translateY" in props && typeof props.translateY === "number") yRange = Math.max(yRange, Math.abs(props.translateY));
  }
  const aspectRatio = yRange > xRange * 1.5 ? "9:16" : xRange > yRange * 2 ? "21:9" : "16:9";

  const summary =
    `Cinema: ${genre.primary} genre, ${narrative.type} narrative, ${pacing.pace} pace, ` +
    `${shots.length} shot(s), ${cuts.length} cut(s)/transition(s), ` +
    `${(runtime / 1000).toFixed(1)}s runtime, ${frameCount} frame(s), ${aspectRatio}`;

  return {
    shots,
    cuts,
    miseEnScene,
    narrative,
    pacing,
    montage,
    genre,
    runtime,
    frameCount,
    aspectRatio,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a cinema analysis as a human-readable report. */
export function formatCinemaReport(analysis: CinemaAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Cinema Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // Shots
  lines.push("## Shots");
  if (analysis.shots.length === 0) {
    lines.push("- No shots detected");
  } else {
    for (const s of analysis.shots) {
      lines.push(`- [${s.size}] ${s.componentName ?? s.componentId} — ${s.angle}, ${s.cameraMovement}, ${s.durationMs}ms`);
    }
  }
  lines.push("");

  // Cuts & Transitions
  lines.push("## Cuts & Transitions");
  if (analysis.cuts.length === 0) {
    lines.push("- No cuts or transitions detected");
  } else {
    for (const c of analysis.cuts) {
      const typeStr = c.kind === "cut" ? "Cut" : `Transition (${c.transitionType})`;
      lines.push(`- ${typeStr} at ${c.timeMs}ms`);
    }
  }
  lines.push("");

  // Mise-en-scène
  lines.push("## Mise-en-scène");
  lines.push(`- ${analysis.miseEnScene.description}`);
  lines.push("");

  // Narrative
  lines.push("## Narrative Structure");
  lines.push(`- ${analysis.narrative.description}`);
  for (const act of analysis.narrative.acts) {
    lines.push(`  - ${act.label}: ${act.startMs}ms - ${act.endMs}ms`);
  }
  lines.push("");

  // Pacing
  lines.push("## Pacing");
  lines.push(`- ${analysis.pacing.description}`);
  lines.push("");

  // Montage
  lines.push("## Montage");
  lines.push(`- ${analysis.montage.description}`);
  lines.push("");

  // Genre
  lines.push("## Genre");
  lines.push(`- ${analysis.genre.description}`);

  return lines.join("\n");
}
