/**
 * Motion Emotion Intelligence — maps emotional states to motion parameters.
 *
 * This is an original AI-native module that bridges affective computing and
 * motion design. Instead of specifying technical parameters (easing, duration,
 * intensity), users express the desired emotional tone ("make it feel calm",
 * "add urgency", "convey excitement") and the engine translates that into
 * concrete motion properties.
 *
 * Four core capabilities:
 * 1. Emotion-to-Motion synthesis — given a target emotion, produce easing,
 *    duration, intensity, and transform recommendations.
 * 2. Motion-to-Emotion detection — analyze existing motion and infer the
 *    emotional tone it conveys (valence, arousal, dominance).
 * 3. Emotion blending — mix two or more emotions with weights to create
 *    nuanced affective motion (e.g., 70% calm + 30% melancholy).
 * 4. Emotion journey planning — sequence emotional states across a timeline
 *    to create an affective arc (e.g., calm → curious → excited → satisfied).
 *
 * The emotion model uses a VAD (Valence-Arousal-Dominance) space where:
 * - Valence: unpleasant (-1) to pleasant (+1)
 * - Arousal: calm (-1) to excited (+1)
 * - Dominance: submissive (-1) to dominant (+1)
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, Easing, Keyframe } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Emotion Model
// ---------------------------------------------------------------------------

/** VAD (Valence-Arousal-Dominance) emotion coordinates. */
export interface VAD {
  /** Valence: -1 (unpleasant) to +1 (pleasant). */
  valence: number;
  /** Arousal: -1 (calm) to +1 (excited). */
  arousal: number;
  /** Dominance: -1 (submissive) to +1 (dominant). */
  dominance: number;
}

/** A named emotion with VAD coordinates and motion parameters. */
export interface EmotionProfile {
  id: string;
  name: string;
  category: EmotionCategory;
  description: string;
  vad: VAD;
  /** Motion parameters that convey this emotion. */
  motion: EmotionMotionParams;
  /** Keywords that users might use to describe this emotion. */
  keywords: string[];
}

export type EmotionCategory =
  | "joy"
  | "sadness"
  | "anger"
  | "fear"
  | "surprise"
  | "trust"
  | "disgust"
  | "anticipation"
  | "calm"
  | "power";

/** Motion parameters derived from an emotion. */
export interface EmotionMotionParams {
  /** Recommended easing preset name. */
  easing: string;
  /** Recommended duration in ms. */
  durationMs: number;
  /** Intensity multiplier (0.1 to 2.0). */
  intensity: number;
  /** Recommended transform type. */
  transformType: EmotionTransform;
  /** Recommended iteration count (1 or "infinite"). */
  iterationCount: number | "infinite";
  /** Color palette recommendation (hex colors). */
  palette: string[];
  /** Stagger interval in ms for multi-component sequences. */
  staggerMs: number;
}

export type EmotionTransform =
  | "fade"
  | "scale-up"
  | "scale-down"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "rotate"
  | "shake"
  | "pulse"
  | "bounce"
  | "swing"
  | "tilt"
  | "blur";

// ---------------------------------------------------------------------------
// Emotion Library — 16 primary emotion profiles
// ---------------------------------------------------------------------------

export const EMOTION_PROFILES: EmotionProfile[] = [
  {
    id: "joy",
    name: "Joy",
    category: "joy",
    description: "Bright, bouncy, upward motion — conveys happiness and delight.",
    vad: { valence: 0.9, arousal: 0.6, dominance: 0.3 },
    motion: {
      easing: "bounce",
      durationMs: 600,
      intensity: 1.3,
      transformType: "bounce",
      iterationCount: 1,
      palette: ["#FFD700", "#FFA500", "#FF6B6B", "#4ECDC4"],
      staggerMs: 80,
    },
    keywords: ["happy", "joy", "delight", "cheerful", "joyful", "快乐", "喜悦"],
  },
  {
    id: "excitement",
    name: "Excitement",
    category: "joy",
    description: "Fast, energetic, multi-axis motion — conveys high energy and enthusiasm.",
    vad: { valence: 0.8, arousal: 0.9, dominance: 0.5 },
    motion: {
      easing: "elastic",
      durationMs: 400,
      intensity: 1.6,
      transformType: "scale-up",
      iterationCount: 1,
      palette: ["#FF1744", "#FF9100", "#FFEA00", "#00E676"],
      staggerMs: 50,
    },
    keywords: ["excited", "excitement", "energetic", "thrilled", "兴奋", "激动"],
  },
  {
    id: "calm",
    name: "Calm",
    category: "calm",
    description: "Slow, smooth, gentle motion — conveys peace and tranquility.",
    vad: { valence: 0.5, arousal: -0.8, dominance: 0.2 },
    motion: {
      easing: "smooth",
      durationMs: 1500,
      intensity: 0.4,
      transformType: "fade",
      iterationCount: 1,
      palette: ["#A8DADC", "#457B9D", "#1D3557", "#F1FAEE"],
      staggerMs: 200,
    },
    keywords: ["calm", "peaceful", "serene", "tranquil", "gentle", "平静", "宁静"],
  },
  {
    id: "sadness",
    name: "Sadness",
    category: "sadness",
    description: "Slow, downward, heavy motion — conveys sorrow and melancholy.",
    vad: { valence: -0.8, arousal: -0.5, dominance: -0.4 },
    motion: {
      easing: "ease-in-out",
      durationMs: 2000,
      intensity: 0.3,
      transformType: "slide-down",
      iterationCount: 1,
      palette: ["#2C3E50", "#34495E", "#7F8C8D", "#BDC3C7"],
      staggerMs: 300,
    },
    keywords: ["sad", "sadness", "melancholy", "sorrowful", "gloomy", "悲伤", "忧郁"],
  },
  {
    id: "anger",
    name: "Anger",
    category: "anger",
    description: "Sharp, aggressive, shaking motion — conveys fury and intensity.",
    vad: { valence: -0.7, arousal: 0.8, dominance: 0.6 },
    motion: {
      easing: "linear",
      durationMs: 200,
      intensity: 1.8,
      transformType: "shake",
      iterationCount: 3,
      palette: ["#8B0000", "#FF0000", "#FF4500", "#2F0000"],
      staggerMs: 30,
    },
    keywords: ["angry", "anger", "furious", "rage", "wrath", "愤怒", "狂怒"],
  },
  {
    id: "fear",
    name: "Fear",
    category: "fear",
    description: "Trembling, retreating, uncertain motion — conveys anxiety and dread.",
    vad: { valence: -0.6, arousal: 0.4, dominance: -0.7 },
    motion: {
      easing: "ease-in",
      durationMs: 800,
      intensity: 0.9,
      transformType: "shake",
      iterationCount: 2,
      palette: ["#1A1A2E", "#16213E", "#0F3460", "#533483"],
      staggerMs: 60,
    },
    keywords: ["fear", "afraid", "scared", "anxious", "dread", "恐惧", "害怕"],
  },
  {
    id: "surprise",
    name: "Surprise",
    category: "surprise",
    description: "Sudden, expansive, quick motion — conveys astonishment and wonder.",
    vad: { valence: 0.3, arousal: 0.9, dominance: -0.2 },
    motion: {
      easing: "back",
      durationMs: 300,
      intensity: 1.5,
      transformType: "scale-up",
      iterationCount: 1,
      palette: ["#E91E63", "#9C27B0", "#3F51B5", "#00BCD4"],
      staggerMs: 40,
    },
    keywords: ["surprised", "surprise", "astonished", "shocked", "amazed", "惊讶", "震惊"],
  },
  {
    id: "trust",
    name: "Trust",
    category: "trust",
    description: "Steady, reliable, smooth motion — conveys dependability and security.",
    vad: { valence: 0.6, arousal: -0.3, dominance: 0.5 },
    motion: {
      easing: "ease-out",
      durationMs: 1000,
      intensity: 0.6,
      transformType: "fade",
      iterationCount: 1,
      palette: ["#2E86AB", "#A23B72", "#F18F01", "#C73E1D"],
      staggerMs: 120,
    },
    keywords: ["trust", "reliable", "secure", "dependable", "stable", "信任", "可靠"],
  },
  {
    id: "anticipation",
    name: "Anticipation",
    category: "anticipation",
    description: "Slow build, tension, forward-leaning motion — conveys expectation and readiness.",
    vad: { valence: 0.4, arousal: 0.3, dominance: 0.1 },
    motion: {
      easing: "ease-in",
      durationMs: 1200,
      intensity: 0.7,
      transformType: "slide-up",
      iterationCount: 1,
      palette: ["#F39C12", "#E67E22", "#D35400", "#A04000"],
      staggerMs: 100,
    },
    keywords: ["anticipation", "expectant", "waiting", "ready", "eager", "期待", "预期"],
  },
  {
    id: "power",
    name: "Power",
    category: "power",
    description: "Strong, grounded, expansive motion — conveys authority and strength.",
    vad: { valence: 0.2, arousal: 0.5, dominance: 0.9 },
    motion: {
      easing: "cubic-bezier",
      durationMs: 800,
      intensity: 1.4,
      transformType: "scale-up",
      iterationCount: 1,
      palette: ["#1A1A1A", "#404040", "#808080", "#FFFFFF"],
      staggerMs: 90,
    },
    keywords: ["power", "powerful", "strong", "authoritative", "dominant", "力量", "权威"],
  },
  {
    id: "melancholy",
    name: "Melancholy",
    category: "sadness",
    description: "Slow, fading, nostalgic motion — conveys wistful sadness and longing.",
    vad: { valence: -0.4, arousal: -0.6, dominance: -0.2 },
    motion: {
      easing: "ease-in-out",
      durationMs: 1800,
      intensity: 0.35,
      transformType: "fade",
      iterationCount: 1,
      palette: ["#5D4E37", "#8B7355", "#BFA890", "#D4C5A0"],
      staggerMs: 250,
    },
    keywords: ["melancholy", "nostalgic", "wistful", "longing", "pensive", "忧郁", "怀念"],
  },
  {
    id: "serenity",
    name: "Serenity",
    category: "calm",
    description: "Very slow, barely perceptible motion — conveys deep peace and contentment.",
    vad: { valence: 0.7, arousal: -0.9, dominance: 0.4 },
    motion: {
      easing: "smooth",
      durationMs: 2500,
      intensity: 0.2,
      transformType: "fade",
      iterationCount: 1,
      palette: ["#E8F1F2", "#B8D8D8", "#7A9E9F", "#4F6367"],
      staggerMs: 400,
    },
    keywords: ["serene", "serenity", "placid", "still", "quiet", "静谧", "安详"],
  },
  {
    id: "playful",
    name: "Playful",
    category: "joy",
    description: "Bouncy, varied, asymmetric motion — conveys fun and lightheartedness.",
    vad: { valence: 0.8, arousal: 0.5, dominance: 0.2 },
    motion: {
      easing: "bounce",
      durationMs: 500,
      intensity: 1.2,
      transformType: "bounce",
      iterationCount: "infinite",
      palette: ["#FF6B9D", "#C44569", "#F8B500", "#00D2D3"],
      staggerMs: 70,
    },
    keywords: ["playful", "fun", "lighthearted", "whimsical", "cheeky", "顽皮", "有趣"],
  },
  {
    id: "mystery",
    name: "Mystery",
    category: "anticipation",
    description: "Slow, obscured, uncertain motion — conveys intrigue and suspense.",
    vad: { valence: -0.1, arousal: 0.2, dominance: -0.5 },
    motion: {
      easing: "ease-in-out",
      durationMs: 1600,
      intensity: 0.5,
      transformType: "blur",
      iterationCount: 1,
      palette: ["#1A0D2E", "#3D1E6D", "#6A3093", "#A8E6CF"],
      staggerMs: 180,
    },
    keywords: ["mystery", "mysterious", "intrigue", "suspense", "enigmatic", "神秘", "悬疑"],
  },
  {
    id: "urgency",
    name: "Urgency",
    category: "fear",
    description: "Fast, sharp, pressing motion — conveys immediate importance and alarm.",
    vad: { valence: -0.3, arousal: 0.9, dominance: -0.3 },
    motion: {
      easing: "linear",
      durationMs: 250,
      intensity: 1.7,
      transformType: "pulse",
      iterationCount: 3,
      palette: ["#FF0040", "#FF8C00", "#FFD700", "#FF0040"],
      staggerMs: 20,
    },
    keywords: ["urgent", "urgency", "pressing", "critical", "emergency", "紧急", "急迫"],
  },
  {
    id: "luxury",
    name: "Luxury",
    category: "trust",
    description: "Slow, refined, deliberate motion — conveys exclusivity and premium quality.",
    vad: { valence: 0.7, arousal: -0.4, dominance: 0.7 },
    motion: {
      easing: "cubic-bezier",
      durationMs: 1400,
      intensity: 0.55,
      transformType: "fade",
      iterationCount: 1,
      palette: ["#1A1A1A", "#D4AF37", "#8B7355", "#FFFFFF"],
      staggerMs: 160,
    },
    keywords: ["luxury", "luxurious", "premium", "elegant", "refined", "奢华", "精致"],
  },
];

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/** Get an emotion profile by ID. */
export function getEmotion(emotionId: string): EmotionProfile | null {
  return EMOTION_PROFILES.find((e) => e.id === emotionId) ?? null;
}

/** List all available emotions. */
export function listEmotions(category?: EmotionCategory): EmotionProfile[] {
  if (category) return EMOTION_PROFILES.filter((e) => e.category === category);
  return [...EMOTION_PROFILES];
}

/** Detect emotion from user text by matching keywords. */
export function detectEmotionFromText(text: string): EmotionProfile | null {
  const lower = text.toLowerCase();
  let bestMatch: EmotionProfile | null = null;
  let bestScore = 0;
  for (const emotion of EMOTION_PROFILES) {
    for (const keyword of emotion.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        const score = keyword.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = emotion;
        }
      }
    }
  }
  return bestMatch;
}

// ---------------------------------------------------------------------------
// Emotion-to-Motion Synthesis
// ---------------------------------------------------------------------------

export interface EmotionSynthesisResult {
  /** The target emotion. */
  emotion: EmotionProfile;
  /** Generated easing. */
  easing: Easing;
  /** Recommended duration in ms. */
  durationMs: number;
  /** Recommended intensity. */
  intensity: number;
  /** Recommended transform type. */
  transformType: EmotionTransform;
  /** Generated keyframes for the emotion. */
  keyframes: Keyframe[];
  /** Color palette. */
  palette: string[];
  /** Summary of the synthesis. */
  summary: string;
}

/** Synthesize motion parameters from a target emotion. */
export function synthesizeFromEmotion(emotionId: string): EmotionSynthesisResult | null {
  const emotion = getEmotion(emotionId);
  if (!emotion) return null;

  const m = emotion.motion;
  const easing = easingPreset(m.easing as never);
  const keyframes = generateEmotionKeyframes(emotion);

  return {
    emotion,
    easing,
    durationMs: m.durationMs,
    intensity: m.intensity,
    transformType: m.transformType,
    keyframes,
    palette: m.palette,
    summary: `Synthesized "${emotion.name}" motion: ${m.easing} easing, ${m.durationMs}ms, intensity ${m.intensity}, ${m.transformType} transform`,
  };
}

/** Generate keyframes that convey the emotion. */
function generateEmotionKeyframes(emotion: EmotionProfile): Keyframe[] {
  const m = emotion.motion;
  const intensity = m.intensity;

  switch (m.transformType) {
    case "fade":
      return [
        { offset: 0, properties: { opacity: 0 } },
        { offset: 1, properties: { opacity: 1 } },
      ];
    case "scale-up":
      return [
        { offset: 0, properties: { scale: 0, opacity: 0 } },
        { offset: 0.6, properties: { scale: 1.1 * intensity, opacity: 1 } },
        { offset: 1, properties: { scale: 1, opacity: 1 } },
      ];
    case "scale-down":
      return [
        { offset: 0, properties: { scale: 1.3 * intensity, opacity: 0 } },
        { offset: 1, properties: { scale: 1, opacity: 1 } },
      ];
    case "slide-up":
      return [
        { offset: 0, properties: { translateY: 60 * intensity, opacity: 0 } },
        { offset: 1, properties: { translateY: 0, opacity: 1 } },
      ];
    case "slide-down":
      return [
        { offset: 0, properties: { translateY: -60 * intensity, opacity: 0 } },
        { offset: 1, properties: { translateY: 0, opacity: 1 } },
      ];
    case "slide-left":
      return [
        { offset: 0, properties: { translateX: 80 * intensity, opacity: 0 } },
        { offset: 1, properties: { translateX: 0, opacity: 1 } },
      ];
    case "slide-right":
      return [
        { offset: 0, properties: { translateX: -80 * intensity, opacity: 0 } },
        { offset: 1, properties: { translateX: 0, opacity: 1 } },
      ];
    case "rotate":
      return [
        { offset: 0, properties: { rotate: -45 * intensity, opacity: 0 } },
        { offset: 1, properties: { rotate: 0, opacity: 1 } },
      ];
    case "shake":
      return [
        { offset: 0, properties: { translateX: 0 } },
        { offset: 0.2, properties: { translateX: -10 * intensity } },
        { offset: 0.4, properties: { translateX: 10 * intensity } },
        { offset: 0.6, properties: { translateX: -8 * intensity } },
        { offset: 0.8, properties: { translateX: 8 * intensity } },
        { offset: 1, properties: { translateX: 0 } },
      ];
    case "pulse":
      return [
        { offset: 0, properties: { scale: 1, opacity: 1 } },
        { offset: 0.5, properties: { scale: 1.15 * intensity, opacity: 0.9 } },
        { offset: 1, properties: { scale: 1, opacity: 1 } },
      ];
    case "bounce":
      return [
        { offset: 0, properties: { translateY: 0, scale: 1 } },
        { offset: 0.3, properties: { translateY: -40 * intensity, scale: 1.1 } },
        { offset: 0.5, properties: { translateY: 0, scale: 0.95 } },
        { offset: 0.7, properties: { translateY: -20 * intensity, scale: 1.05 } },
        { offset: 1, properties: { translateY: 0, scale: 1 } },
      ];
    case "swing":
      return [
        { offset: 0, properties: { rotate: -15 * intensity } },
        { offset: 0.5, properties: { rotate: 15 * intensity } },
        { offset: 1, properties: { rotate: 0 } },
      ];
    case "tilt":
      return [
        { offset: 0, properties: { rotate: 0, translateY: 0 } },
        { offset: 1, properties: { rotate: 5 * intensity, translateY: -10 } },
      ];
    case "blur":
      return [
        { offset: 0, properties: { opacity: 0, blur: 20 } },
        { offset: 0.5, properties: { opacity: 0.5, blur: 10 } },
        { offset: 1, properties: { opacity: 1, blur: 0 } },
      ];
    default:
      return [
        { offset: 0, properties: { opacity: 0 } },
        { offset: 1, properties: { opacity: 1 } },
      ];
  }
}

// ---------------------------------------------------------------------------
// Motion-to-Emotion Detection
// ---------------------------------------------------------------------------

export interface EmotionDetectionResult {
  /** Detected emotion ID. */
  emotionId: string;
  /** Detected emotion name. */
  emotionName: string;
  /** Confidence score (0..1). */
  confidence: number;
  /** VAD coordinates inferred from the motion. */
  vad: VAD;
  /** All emotion scores sorted by match. */
  scores: Array<{ emotionId: string; emotionName: string; score: number }>;
  /** Summary. */
  summary: string;
}

/** Detect the emotional tone of an existing motion component. */
export function detectEmotionFromMotion(component: MotionComponent): EmotionDetectionResult {
  // Infer VAD from motion properties
  const vad = inferVADFromComponent(component);

  // Score against all emotion profiles
  const scores = EMOTION_PROFILES.map((emotion) => {
    const score = vadSimilarity(vad, emotion.vad);
    return { emotionId: emotion.id, emotionName: emotion.name, score };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0];
  const confidence = best.score;

  return {
    emotionId: best.emotionId,
    emotionName: best.emotionName,
    confidence,
    vad,
    scores: scores.slice(0, 5),
    summary: `Detected "${best.emotionName}" (confidence: ${(confidence * 100).toFixed(1)}%) — VAD(${vad.valence.toFixed(2)}, ${vad.arousal.toFixed(2)}, ${vad.dominance.toFixed(2)})`,
  };
}

/** Infer VAD coordinates from a motion component's properties. */
function inferVADFromComponent(component: MotionComponent): VAD {
  let valence = 0;
  let arousal = 0;
  let dominance = 0;

  // Duration: short = high arousal, long = low arousal
  if (component.durationMs < 400) arousal += 0.6;
  else if (component.durationMs < 800) arousal += 0.3;
  else if (component.durationMs > 1500) arousal -= 0.5;
  else if (component.durationMs > 1000) arousal -= 0.2;

  // Easing: bounce/elastic = positive valence + high arousal
  const easingName = "name" in component.easing ? (component.easing as { name: string }).name : "";
  if (easingName === "bounce" || easingName === "elastic") {
    valence += 0.5;
    arousal += 0.4;
  } else if (easingName === "smooth" || easingName === "ease-out") {
    valence += 0.2;
    arousal -= 0.2;
  } else if (easingName === "linear") {
    valence -= 0.1;
    arousal += 0.1;
  }

  // Spring stiffness: high = high arousal + dominance
  if ("stiffness" in component.easing) {
    const spring = component.easing as { stiffness: number; damping: number };
    if (spring.stiffness > 200) {
      arousal += 0.4;
      dominance += 0.3;
    } else if (spring.stiffness < 100) {
      arousal -= 0.2;
      dominance -= 0.1;
    }
  }

  // Iteration count: infinite = high arousal (energetic)
  if (component.iterationCount === "infinite") {
    arousal += 0.3;
    valence += 0.1;
  }

  // Keyframe analysis
  const keyframes = component.keyframes ?? [];
  for (const kf of keyframes) {
    const props = kf.properties ?? {};
    // Scale up = positive valence + dominance
    if ("scale" in props && typeof props.scale === "number") {
      if (props.scale > 1) {
        valence += 0.1;
        dominance += 0.1;
      } else if (props.scale < 1) {
        valence -= 0.05;
        dominance -= 0.05;
      }
    }
    // TranslateY down = negative valence
    if ("translateY" in props && typeof props.translateY === "number") {
      if (props.translateY > 30) valence -= 0.1;
      else if (props.translateY < -30) valence += 0.05;
    }
    // Rotation = arousal
    if ("rotate" in props && typeof props.rotate === "number") {
      if (Math.abs(props.rotate) > 30) arousal += 0.1;
    }
  }

  // Normalize to -1..1
  valence = Math.max(-1, Math.min(1, valence));
  arousal = Math.max(-1, Math.min(1, arousal));
  dominance = Math.max(-1, Math.min(1, dominance));

  return { valence, arousal, dominance };
}

/** Compute cosine similarity between two VAD vectors. */
function vadSimilarity(a: VAD, b: VAD): number {
  const dot = a.valence * b.valence + a.arousal * b.arousal + a.dominance * b.dominance;
  const magA = Math.sqrt(a.valence ** 2 + a.arousal ** 2 + a.dominance ** 2);
  const magB = Math.sqrt(b.valence ** 2 + b.arousal ** 2 + b.dominance ** 2);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// ---------------------------------------------------------------------------
// Emotion Blending
// ---------------------------------------------------------------------------

export interface BlendedEmotionResult {
  /** Blended VAD coordinates. */
  vad: VAD;
  /** Blended motion parameters. */
  motion: EmotionMotionParams;
  /** The emotions that were blended with weights. */
  components: Array<{ emotionId: string; emotionName: string; weight: number }>;
  /** Generated keyframes. */
  keyframes: Keyframe[];
  /** Summary. */
  summary: string;
}

/** Blend multiple emotions with weights to create a nuanced affective motion. */
export function blendEmotions(
  emotions: Array<{ emotionId: string; weight: number }>,
): BlendedEmotionResult | null {
  if (emotions.length === 0) return null;

  // Normalize weights
  const totalWeight = emotions.reduce((sum, e) => sum + e.weight, 0);
  const normalized = emotions.map((e) => ({ ...e, weight: e.weight / totalWeight }));

  // Get emotion profiles
  const profiles = normalized
    .map((e) => ({ emotion: getEmotion(e.emotionId), weight: e.weight }))
    .filter((p) => p.emotion !== null) as Array<{ emotion: EmotionProfile; weight: number }>;

  if (profiles.length === 0) return null;

  // Blend VAD
  const vad: VAD = {
    valence: profiles.reduce((sum, p) => sum + p.emotion.vad.valence * p.weight, 0),
    arousal: profiles.reduce((sum, p) => sum + p.emotion.vad.arousal * p.weight, 0),
    dominance: profiles.reduce((sum, p) => sum + p.emotion.vad.dominance * p.weight, 0),
  };

  // Blend motion params
  const motion: EmotionMotionParams = {
    easing: profiles[0].emotion.motion.easing,
    durationMs: Math.round(profiles.reduce((sum, p) => sum + p.emotion.motion.durationMs * p.weight, 0)),
    intensity: profiles.reduce((sum, p) => sum + p.emotion.motion.intensity * p.weight, 0),
    transformType: profiles[0].emotion.motion.transformType,
    iterationCount: profiles.reduce(
      (sum, p) => {
        const ic = p.emotion.motion.iterationCount;
        return typeof ic === "number" ? sum + ic * p.weight : sum + 1 * p.weight;
      },
      0,
    ) >= 1.5
      ? "infinite"
      : 1,
    palette: profiles.flatMap((p) => p.emotion.motion.palette).slice(0, 4),
    staggerMs: Math.round(profiles.reduce((sum, p) => sum + p.emotion.motion.staggerMs * p.weight, 0)),
  };

  // Generate keyframes from the dominant emotion
  const dominant = profiles.reduce((max, p) => (p.weight > max.weight ? p : max), profiles[0]);
  const keyframes = generateEmotionKeyframes(dominant.emotion);

  return {
    vad,
    motion,
    components: profiles.map((p) => ({
      emotionId: p.emotion.id,
      emotionName: p.emotion.name,
      weight: Number(p.weight.toFixed(3)),
    })),
    keyframes,
    summary: `Blended ${profiles.length} emotions: ${profiles.map((p) => `${p.emotion.name} (${(p.weight * 100).toFixed(0)}%)`).join(" + ")}`,
  };
}

// ---------------------------------------------------------------------------
// Emotion Journey Planning
// ---------------------------------------------------------------------------

export interface EmotionJourneyStep {
  /** Emotion ID. */
  emotionId: string;
  /** Emotion name. */
  emotionName: string;
  /** Start time in ms. */
  startMs: number;
  /** Duration in ms. */
  durationMs: number;
  /** Motion params for this step. */
  motion: EmotionMotionParams;
}

export interface EmotionJourneyResult {
  /** Journey steps in sequence. */
  steps: EmotionJourneyStep[];
  /** Total duration in ms. */
  totalDurationMs: number;
  /** VAD trajectory. */
  vadTrajectory: Array<{ timeMs: number; vad: VAD }>;
  /** Summary. */
  summary: string;
}

/**
 * Plan an emotion journey — a sequence of emotional states that flow
 * naturally across a timeline to create an affective arc.
 */
export function planEmotionJourney(
  emotionIds: string[],
  totalDurationMs = 5000,
): EmotionJourneyResult | null {
  const emotions = emotionIds.map((id) => getEmotion(id)).filter((e) => e !== null) as EmotionProfile[];
  if (emotions.length === 0) return null;

  const stepDuration = Math.round(totalDurationMs / emotions.length);
  const steps: EmotionJourneyStep[] = [];
  const vadTrajectory: Array<{ timeMs: number; vad: VAD }> = [];

  let currentTime = 0;
  for (const emotion of emotions) {
    steps.push({
      emotionId: emotion.id,
      emotionName: emotion.name,
      startMs: currentTime,
      durationMs: stepDuration,
      motion: emotion.motion,
    });
    vadTrajectory.push({ timeMs: currentTime, vad: emotion.vad });
    currentTime += stepDuration;
  }
  // Add final VAD point
  if (emotions.length > 0) {
    vadTrajectory.push({ timeMs: currentTime, vad: emotions[emotions.length - 1].vad });
  }

  return {
    steps,
    totalDurationMs: currentTime,
    vadTrajectory,
    summary: `Planned ${steps.length}-step emotion journey: ${emotions.map((e) => e.name).join(" → ")} over ${currentTime}ms`,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatEmotionReport(result: EmotionSynthesisResult): string {
  const lines = [
    `Emotion: ${result.emotion.name}`,
    `Category: ${result.emotion.category}`,
    `Description: ${result.emotion.description}`,
    `VAD: valence=${result.emotion.vad.valence.toFixed(2)}, arousal=${result.emotion.vad.arousal.toFixed(2)}, dominance=${result.emotion.vad.dominance.toFixed(2)}`,
    ``,
    `Motion Parameters:`,
    `  Easing: ${result.emotion.motion.easing}`,
    `  Duration: ${result.durationMs}ms`,
    `  Intensity: ${result.intensity}`,
    `  Transform: ${result.transformType}`,
    `  Iteration: ${result.emotion.motion.iterationCount}`,
    `  Stagger: ${result.emotion.motion.staggerMs}ms`,
    `  Palette: ${result.palette.join(", ")}`,
    ``,
    `Keyframes: ${result.keyframes.length} keyframes generated`,
  ];
  return lines.join("\n");
}

export function formatDetectionReport(result: EmotionDetectionResult): string {
  const lines = [
    `Detected Emotion: ${result.emotionName} (confidence: ${(result.confidence * 100).toFixed(1)}%)`,
    `VAD: valence=${result.vad.valence.toFixed(2)}, arousal=${result.vad.arousal.toFixed(2)}, dominance=${result.vad.dominance.toFixed(2)}`,
    ``,
    `Top matches:`,
    ...result.scores.map(
      (s, i) => `  ${i + 1}. ${s.emotionName}: ${(s.score * 100).toFixed(1)}%`,
    ),
  ];
  return lines.join("\n");
}

export function formatBlendReport(result: BlendedEmotionResult): string {
  const lines = [
    `Blended Emotion:`,
    `  VAD: valence=${result.vad.valence.toFixed(2)}, arousal=${result.vad.arousal.toFixed(2)}, dominance=${result.vad.dominance.toFixed(2)}`,
    `  Components:`,
    ...result.components.map(
      (c) => `    - ${c.emotionName}: ${(c.weight * 100).toFixed(0)}%`,
    ),
    ``,
    `Motion Parameters:`,
    `  Easing: ${result.motion.easing}`,
    `  Duration: ${result.motion.durationMs}ms`,
    `  Intensity: ${result.motion.intensity.toFixed(2)}`,
    `  Transform: ${result.motion.transformType}`,
    `  Stagger: ${result.motion.staggerMs}ms`,
  ];
  return lines.join("\n");
}

export function formatJourneyReport(result: EmotionJourneyResult): string {
  const lines = [
    `Emotion Journey: ${result.steps.length} steps over ${result.totalDurationMs}ms`,
    ``,
    `Sequence:`,
    ...result.steps.map(
      (s, i) =>
        `  ${i + 1}. [${s.startMs}ms - ${s.startMs + s.durationMs}ms] ${s.emotionName} (${s.motion.easing}, ${s.durationMs}ms)`,
    ),
    ``,
    `VAD Trajectory:`,
    ...result.vadTrajectory.map(
      (t) =>
        `  ${t.timeMs}ms: valence=${t.vad.valence.toFixed(2)}, arousal=${t.vad.arousal.toFixed(2)}, dominance=${t.vad.dominance.toFixed(2)}`,
    ),
  ];
  return lines.join("\n");
}
