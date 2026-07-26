/**
 * Adaptive Motion Learning — learns user preferences and adapts motion generation.
 *
 * This is an original AI-native module that builds a user preference profile
 * from observed interactions. Instead of requiring explicit configuration,
 * the engine watches which motions the user creates, keeps, and discards,
 * then uses that signal to steer future generation toward the user's taste.
 *
 * Four core capabilities:
 * 1. Preference observation — record motion interactions (created, accepted,
 *    rejected, modified) and extract preference signals.
 * 2. Taste profiling — aggregate observations into a multi-dimensional
 *    preference profile (easing, duration, intensity, transform, palette).
 * 3. Recommendation — suggest motion parameters that match the user's
 *    established taste.
 * 4. Drift detection — notice when the user's taste shifts over time and
 *    reweight the profile accordingly.
 *
 * The preference model uses exponentially-weighted moving averages so recent
 * observations carry more weight than old ones, naturally tracking taste drift.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single observed interaction with a motion. */
export interface MotionObservation {
  /** Timestamp of the observation. */
  timestamp: number;
  /** The motion component that was interacted with. */
  component: MotionComponent;
  /** The type of interaction. */
  action: ObservationAction;
  /** Optional: what the user changed (for "modified" actions). */
  modifications?: Partial<MotionPreferences>;
}

export type ObservationAction = "created" | "accepted" | "rejected" | "modified";

/** Multi-dimensional preference profile. */
export interface MotionPreferences {
  /** Preferred easing family → weight (0..1). */
  easingPreferences: Record<string, number>;
  /** Preferred duration bucket → weight (0..1). */
  durationPreferences: Record<string, number>;
  /** Preferred intensity range. */
  intensityRange: { min: number; max: number };
  /** Preferred transform types → weight. */
  transformPreferences: Record<string, number>;
  /** Preferred palette colors (hex). */
  palettePreferences: string[];
  /** Preferred iteration behavior. */
  iterationPreferences: { finite: number; infinite: number };
}

/** A recommendation based on learned preferences. */
export interface PreferenceRecommendation {
  /** Recommended easing family. */
  easing: string;
  /** Recommended duration in ms. */
  durationMs: number;
  /** Recommended intensity. */
  intensity: number;
  /** Recommended transform type. */
  transformType: string;
  /** Recommended palette. */
  palette: string[];
  /** Recommended iteration count. */
  iterationCount: number | "infinite";
  /** Confidence in the recommendation (0..1). */
  confidence: number;
  /** Summary. */
  summary: string;
}

/** A taste profile report. */
export interface TasteProfile {
  /** Number of observations recorded. */
  observationCount: number;
  /** Whether there's enough data for recommendations. */
  hasProfile: boolean;
  /** The current preference profile. */
  preferences: MotionPreferences;
  /** Top 3 preferred easings. */
  topEasings: Array<{ name: string; weight: number }>;
  /** Top 3 preferred durations. */
  topDurations: Array<{ bucket: string; weight: number }>;
  /** Preferred intensity range. */
  intensityProfile: { min: number; max: number; average: number };
  /** Whether taste has drifted recently. */
  driftDetected: boolean;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Adaptive Learning Engine
// ---------------------------------------------------------------------------

/**
 * The learning engine maintains an in-memory preference profile per project.
 * Observations are fed via recordObservation(); recommendations and reports
 * are produced via recommend() and getTasteProfile().
 */
export class AdaptiveMotionLearner {
  private observations: MotionObservation[] = [];
  private preferences: MotionPreferences;
  private lastPreferences: MotionPreferences | null = null;
  private readonly decayFactor = 0.85; // EWMA decay
  private readonly minObservationsForProfile = 3;

  constructor() {
    this.preferences = this.emptyPreferences();
  }

  /** Record a new motion interaction. */
  recordObservation(observation: MotionObservation): void {
    this.observations.push(observation);
    this.lastPreferences = JSON.parse(JSON.stringify(this.preferences));
    this.updatePreferences(observation);
  }

  /** Get the current taste profile. */
  getTasteProfile(): TasteProfile {
    const hasProfile = this.observations.length >= this.minObservationsForProfile;
    const topEasings = this.topN(this.preferences.easingPreferences, 3);
    const topDurations = this.topN(this.preferences.durationPreferences, 3);
    const intensityAverage =
      (this.preferences.intensityRange.min + this.preferences.intensityRange.max) / 2;
    const driftDetected = this.detectDrift();

    return {
      observationCount: this.observations.length,
      hasProfile,
      preferences: this.preferences,
      topEasings: topEasings.map(([name, weight]) => ({ name, weight })),
      topDurations: topDurations.map(([bucket, weight]) => ({ bucket, weight })),
      intensityProfile: {
        min: this.preferences.intensityRange.min,
        max: this.preferences.intensityRange.max,
        average: intensityAverage,
      },
      driftDetected,
      summary: this.formatProfileSummary(hasProfile, driftDetected),
    };
  }

  /** Recommend motion parameters based on learned preferences. */
  recommend(): PreferenceRecommendation | null {
    if (this.observations.length < this.minObservationsForProfile) {
      return null;
    }

    const topEasing = this.topN(this.preferences.easingPreferences, 1)[0];
    const topDuration = this.topN(this.preferences.durationPreferences, 1)[0];
    const topTransform = this.topN(this.preferences.transformPreferences, 1)[0];
    const intensity =
      (this.preferences.intensityRange.min + this.preferences.intensityRange.max) / 2;
    const useInfinite =
      this.preferences.iterationPreferences.infinite >
      this.preferences.iterationPreferences.finite;

    const confidence = Math.min(1, this.observations.length / 10);

    const durationMs = this.parseDurationBucket(topDuration?.[0] ?? "normal");
    const palette = this.preferences.palettePreferences.slice(0, 4);

    return {
      easing: topEasing?.[0] ?? "ease-out",
      durationMs,
      intensity,
      transformType: topTransform?.[0] ?? "fade",
      palette,
      iterationCount: useInfinite ? "infinite" : 1,
      confidence,
      summary: `Recommended based on ${this.observations.length} observations: ${topEasing?.[0] ?? "ease-out"} easing, ${durationMs}ms, intensity ${intensity.toFixed(2)} (confidence ${(confidence * 100).toFixed(0)}%)`,
    };
  }

  /** Get all recorded observations. */
  getObservations(): MotionObservation[] {
    return [...this.observations];
  }

  /** Clear all observations and reset the profile. */
  reset(): void {
    this.observations = [];
    this.preferences = this.emptyPreferences();
    this.lastPreferences = null;
  }

  // -----------------------------------------------------------------------
  // Private methods
  // -----------------------------------------------------------------------

  private emptyPreferences(): MotionPreferences {
    return {
      easingPreferences: {},
      durationPreferences: {},
      intensityRange: { min: 0.5, max: 1.0 },
      transformPreferences: {},
      palettePreferences: [],
      iterationPreferences: { finite: 0.5, infinite: 0.5 },
    };
  }

  private updatePreferences(observation: MotionObservation): void {
    const component = observation.component;
    const weight = this.actionWeight(observation.action);

    // Easing preference
    const easingName = this.extractEasingName(component.easing);
    this.updateWeighted(this.preferences.easingPreferences, easingName, weight);

    // Duration preference
    const durationBucket = this.bucketDuration(component.durationMs);
    this.updateWeighted(this.preferences.durationPreferences, durationBucket, weight);

    // Intensity preference
    const intensity = this.estimateIntensity(component);
    this.preferences.intensityRange.min =
      this.preferences.intensityRange.min * this.decayFactor +
      Math.min(intensity, this.preferences.intensityRange.min) * (1 - this.decayFactor);
    this.preferences.intensityRange.max =
      this.preferences.intensityRange.max * this.decayFactor +
      Math.max(intensity, this.preferences.intensityRange.max) * (1 - this.decayFactor);

    // Transform preference
    const transformType = this.extractTransformType(component);
    this.updateWeighted(this.preferences.transformPreferences, transformType, weight);

    // Palette preference
    const colors = this.extractColors(component);
    for (const color of colors) {
      if (!this.preferences.palettePreferences.includes(color)) {
        this.preferences.palettePreferences.push(color);
        if (this.preferences.palettePreferences.length > 8) {
          this.preferences.palettePreferences.shift();
        }
      }
    }

    // Iteration preference
    if (component.iterationCount === "infinite") {
      this.preferences.iterationPreferences.infinite =
        this.preferences.iterationPreferences.infinite * this.decayFactor + weight * (1 - this.decayFactor);
    } else {
      this.preferences.iterationPreferences.finite =
        this.preferences.iterationPreferences.finite * this.decayFactor + weight * (1 - this.decayFactor);
    }
  }

  private actionWeight(action: ObservationAction): number {
    switch (action) {
      case "accepted": return 1.0;
      case "created": return 0.7;
      case "modified": return 0.5;
      case "rejected": return -0.3;
      default: return 0;
    }
  }

  private updateWeighted(
    target: Record<string, number>,
    key: string,
    weight: number,
  ): void {
    const current = target[key] ?? 0;
    target[key] = current * this.decayFactor + weight * (1 - this.decayFactor);
  }

  private extractEasingName(easing: Easing): string {
    if ("name" in easing) return (easing as { name: string }).name;
    if ("stiffness" in easing) return "spring";
    return "ease-out";
  }

  private bucketDuration(durationMs: number): string {
    if (durationMs < 300) return "micro";
    if (durationMs < 600) return "fast";
    if (durationMs < 1000) return "normal";
    if (durationMs < 1500) return "slow";
    return "cinematic";
  }

  private parseDurationBucket(bucket: string): number {
    switch (bucket) {
      case "micro": return 250;
      case "fast": return 500;
      case "normal": return 800;
      case "slow": return 1200;
      case "cinematic": return 1800;
      default: return 800;
    }
  }

  private estimateIntensity(component: MotionComponent): number {
    let intensity = 0.5;
    const keyframes = component.keyframes ?? [];
    for (const kf of keyframes) {
      const props = kf.properties ?? {};
      if ("scale" in props && typeof props.scale === "number") {
        intensity = Math.max(intensity, Math.abs(props.scale - 1));
      }
      if ("translateX" in props && typeof props.translateX === "number") {
        intensity = Math.max(intensity, Math.abs(props.translateX) / 200);
      }
      if ("translateY" in props && typeof props.translateY === "number") {
        intensity = Math.max(intensity, Math.abs(props.translateY) / 200);
      }
      if ("rotate" in props && typeof props.rotate === "number") {
        intensity = Math.max(intensity, Math.abs(props.rotate) / 360);
      }
    }
    return Math.min(2, intensity);
  }

  private extractTransformType(component: MotionComponent): string {
    const keyframes = component.keyframes ?? [];
    for (const kf of keyframes) {
      const props = kf.properties ?? {};
      if ("opacity" in props) return "fade";
      if ("scale" in props) {
        const s = Number(props.scale ?? 1);
        return s > 1 ? "scale-up" : "scale-down";
      }
      if ("translateY" in props) {
        const y = Number(props.translateY ?? 0);
        return y > 0 ? "slide-down" : "slide-up";
      }
      if ("translateX" in props) {
        const x = Number(props.translateX ?? 0);
        return x > 0 ? "slide-right" : "slide-left";
      }
      if ("rotate" in props) return "rotate";
    }
    return "fade";
  }

  private extractColors(component: MotionComponent): string[] {
    const colors: string[] = [];
    const style = component.style ?? {};
    if (typeof style.backgroundColor === "string") colors.push(style.backgroundColor);
    if (typeof style.color === "string") colors.push(style.color);
    if (typeof style.borderColor === "string") colors.push(style.borderColor);
    return colors;
  }

  private topN(obj: Record<string, number>, n: number): Array<[string, number]> {
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }

  private detectDrift(): boolean {
    if (!this.lastPreferences || this.observations.length < 5) return false;
    // Compare current top easing to last top easing
    const currentTop = this.topN(this.preferences.easingPreferences, 1)[0];
    const lastTop = this.topN(this.lastPreferences.easingPreferences, 1)[0];
    if (!currentTop || !lastTop) return false;
    return currentTop[0] !== lastTop[0];
  }

  private formatProfileSummary(hasProfile: boolean, driftDetected: boolean): string {
    if (!hasProfile) {
      return `Learning: ${this.observations.length} observation(s) recorded — need ${this.minObservationsForProfile} to build a profile`;
    }
    const topEasing = this.topN(this.preferences.easingPreferences, 1)[0];
    const driftNote = driftDetected ? " (taste drift detected)" : "";
    return `Profile ready: ${this.observations.length} observations, preferred easing "${topEasing?.[0] ?? "unknown"}"${driftNote}`;
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton (per-process)
// ---------------------------------------------------------------------------

const learners = new Map<string, AdaptiveMotionLearner>();

/** Get or create a learner for a project. */
export function getLearner(projectId: string): AdaptiveMotionLearner {
  if (!learners.has(projectId)) {
    learners.set(projectId, new AdaptiveMotionLearner());
  }
  return learners.get(projectId)!;
}

/** Record an observation for a project. */
export function recordMotionObservation(
  projectId: string,
  observation: Omit<MotionObservation, "timestamp">,
): void {
  const learner = getLearner(projectId);
  learner.recordObservation({ ...observation, timestamp: Date.now() });
}

/** Get the taste profile for a project. */
export function getProjectTasteProfile(projectId: string): TasteProfile {
  return getLearner(projectId).getTasteProfile();
}

/** Get a recommendation for a project. */
export function recommendForProject(projectId: string): PreferenceRecommendation | null {
  return getLearner(projectId).recommend();
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatTasteProfile(profile: TasteProfile): string {
  const lines = [
    `Taste Profile:`,
    `  Observations: ${profile.observationCount}`,
    `  Profile ready: ${profile.hasProfile ? "yes" : "no"}`,
    `  Taste drift: ${profile.driftDetected ? "detected" : "stable"}`,
    ``,
    `Top easings:`,
    ...profile.topEasings.map((e) => `  - ${e.name}: ${(e.weight * 100).toFixed(0)}%`),
    `Top durations:`,
    ...profile.topDurations.map((d) => `  - ${d.bucket}: ${(d.weight * 100).toFixed(0)}%`),
    `Intensity range: ${profile.intensityProfile.min.toFixed(2)} - ${profile.intensityProfile.max.toFixed(2)} (avg ${profile.intensityProfile.average.toFixed(2)})`,
    ``,
    profile.summary,
  ];
  return lines.join("\n");
}

export function formatRecommendation(rec: PreferenceRecommendation): string {
  const lines = [
    `Recommendation:`,
    `  Easing: ${rec.easing}`,
    `  Duration: ${rec.durationMs}ms`,
    `  Intensity: ${rec.intensity.toFixed(2)}`,
    `  Transform: ${rec.transformType}`,
    `  Palette: ${rec.palette.join(", ")}`,
    `  Iteration: ${rec.iterationCount}`,
    `  Confidence: ${(rec.confidence * 100).toFixed(0)}%`,
    ``,
    rec.summary,
  ];
  return lines.join("\n");
}
