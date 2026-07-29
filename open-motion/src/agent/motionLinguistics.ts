/**
 * Motion Linguistics Engine — analyzes motion as a structured language.
 *
 * This original AI-native module treats a motion composition as a linguistic
 * utterance. Components are morphemes (meaning-bearing units); keyframes are
 * phonemes (atomic gestures); easings determine prosody (rhythm of speech);
 * delays are syntactic pauses; durations are syllable lengths.
 *
 * Core concepts:
 * - Phonology: atomic motion sounds (plosives, fricatives, vowels, diphthongs)
 * - Morphology: word formation from keyframe clusters
 * - Syntax: phrase structure and grammatical relations
 * - Semantics: meaning derived from motion lexicon
 * - Pragmatics: contextual intent (assertion, question, command, exclamation)
 * - Prosody: stress, intonation, rhythm, tempo
 * - Discourse: coherence between motion phrases
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A motion phoneme — the smallest unit of motion sound. */
export interface MotionPhoneme {
  componentId: string;
  timeMs: number;
  /** Phoneme class. */
  class: "plosive" | "fricative" | "affricate" | "nasal" | "liquid" | "vowel" | "diphthong" | "sibilant";
  /** Voicing. */
  voicing: "voiced" | "voiceless" | "whisper";
  /** Place of articulation. */
  place: "bilabial" | "labiodental" | "dental" | "alveolar" | "palatal" | "velar" | "glottal";
  /** Manner of articulation. */
  manner: "stop" | "fricative" | "affricate" | "nasal" | "approximant" | "trill" | "lateral";
  /** Description. */
  description: string;
}

/** A motion morpheme — the smallest meaning-bearing unit. */
export interface MotionMorpheme {
  componentId: string;
  componentName: string | null;
  /** Morpheme type. */
  type: "root" | "prefix" | "suffix" | "infix" | "circumfix";
  /** Lexical category. */
  category: "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "determiner" | "interjection";
  /** Gloss (meaning). */
  gloss: string;
  /** Description. */
  description: string;
}

/** A syntactic phrase. */
export interface SyntacticPhrase {
  /** Phrase ID. */
  id: string;
  /** Phrase type. */
  type: "noun-phrase" | "verb-phrase" | "adjective-phrase" | "adverbial-phrase" | "prepositional-phrase";
  /** Head component ID. */
  head: string;
  /** Dependent component IDs. */
  dependents: string[];
  /** Start time in ms. */
  startMs: number;
  /** End time in ms. */
  endMs: number;
  /** Description. */
  description: string;
}

/** A clause. */
export interface MotionClause {
  /** Clause ID. */
  id: string;
  /** Clause type. */
  type: "declarative" | "interrogative" | "imperative" | "exclamative" | "subjunctive";
  /** Subject component ID (if any). */
  subject: string | null;
  /** Predicate head component ID. */
  predicate: string;
  /** Object component IDs. */
  objects: string[];
  /** Start time in ms. */
  startMs: number;
  /** End time in ms. */
  endMs: number;
  /** Description. */
  description: string;
}

/** Prosody analysis. */
export interface ProsodyAnalysis {
  /** Stress pattern (array of strong/weak). */
  stressPattern: Array<"strong" | "weak" | "secondary">;
  /** Intonation contour. */
  intonation: "rising" | "falling" | "level" | "rise-fall" | "fall-rise";
  /** Tempo (BPM equivalent). */
  tempo: number;
  /** Rhythm type. */
  rhythm: "stress-timed" | "syllable-timed" | "mora-timed";
  /** Pause count. */
  pauseCount: number;
  /** Description. */
  description: string;
}

/** Semantic analysis. */
export interface SemanticAnalysis {
  /** Lexical fields detected. */
  lexicalFields: string[];
  /** Semantic roles. */
  roles: Array<{
    componentId: string;
    role: "agent" | "patient" | "theme" | "experiencer" | "beneficiary" | "instrument" | "location" | "goal" | "source";
    description: string;
  }>;
  /** Polarity (positive/negative/neutral). */
  polarity: "positive" | "negative" | "neutral";
  /** Modality. */
  modality: "epistemic" | "deontic" | "dynamic" | "alethic";
  /** Tense. */
  tense: "past" | "present" | "future" | "aorist" | "perfect" | "imperfect";
  /** Aspect. */
  aspect: "perfective" | "imperfective" | "progressive" | "habitual" | "inchoative" | "cessative";
  /** Description. */
  description: string;
}

/** Pragmatic analysis. */
export interface PragmaticAnalysis {
  /** Speech act. */
  speechAct: "assertive" | "directive" | "commissive" | "expressive" | "declaration" | "verdictive";
  /** Illocutionary force. */
  illocutionaryForce: string;
  /** Politeness level 0..1. */
  politeness: number;
  /** Formality 0..1. */
  formality: number;
  /** Description. */
  description: string;
}

/** Discourse analysis. */
export interface DiscourseAnalysis {
  /** Coherence relations between clauses. */
  relations: Array<{
    fromClause: string;
    toClause: string;
    relation: "narration" | "background" | "result" | "cause" | "condition" | "elaboration" | "contrast" | "parallel";
    description: string;
  }>;
  /** Overall rhetorical structure. */
  rhetoricalStructure: "narrative" | "descriptive" | "expository" | "argumentative" | "dialogic";
  /** Cohesion score 0..1. */
  cohesion: number;
  /** Description. */
  description: string;
}

/** Linguistics analysis result. */
export interface LinguisticsAnalysis {
  phonemes: MotionPhoneme[];
  morphemes: MotionMorpheme[];
  phrases: SyntacticPhrase[];
  clauses: MotionClause[];
  prosody: ProsodyAnalysis;
  semantics: SemanticAnalysis;
  pragmatics: PragmaticAnalysis;
  discourse: DiscourseAnalysis;
  /** Detected language family. */
  languageFamily: string;
  /** Detected register. */
  register: "frozen" | "formal" | "consultative" | "casual" | "intimate";
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Phonology
// ---------------------------------------------------------------------------

/** Classify a keyframe transition as a phoneme. */
function classifyPhoneme(
  prevProps: Record<string, string | number>,
  currProps: Record<string, string | number>,
  durationMs: number,
): Omit<MotionPhoneme, "componentId" | "timeMs" | "description"> {
  let pClass: MotionPhoneme["class"] = "vowel";
  let voicing: MotionPhoneme["voicing"] = "voiced";
  let place: MotionPhoneme["place"] = "alveolar";
  let manner: MotionPhoneme["manner"] = "approximant";

  // Determine phoneme class from property changes
  const hasScale = "scale" in currProps || "scale" in prevProps;
  const hasRotate = "rotate" in currProps || "rotate" in prevProps;
  const hasTranslate = "translateX" in currProps || "translateY" in currProps ||
                       "translateX" in prevProps || "translateY" in prevProps;
  const hasOpacity = "opacity" in currProps || "opacity" in prevProps;
  const hasColor = "color" in currProps || "backgroundColor" in currProps ||
                   "color" in prevProps || "backgroundColor" in prevProps;
  const hasBlur = "blur" in currProps || "blur" in prevProps;

  // Plosive: abrupt, short, scale-based (explosion)
  if (durationMs < 200 && hasScale) {
    pClass = "plosive";
    manner = "stop";
    voicing = durationMs < 100 ? "voiceless" : "voiced";
    place = "bilabial";
  }
  // Fricative: prolonged, blur-based (hissing)
  else if (hasBlur && durationMs > 300) {
    pClass = "fricative";
    manner = "fricative";
    voicing = "voiced";
    place = "labiodental";
  }
  // Sibilant: sharp, rotate-based
  else if (hasRotate && durationMs < 400) {
    pClass = "sibilant";
    manner = "fricative";
    voicing = "voiced";
    place = "alveolar";
  }
  // Affricate: combination of plosive and fricative
  else if (hasScale && hasBlur) {
    pClass = "affricate";
    manner = "affricate";
    voicing = "voiced";
    place = "palatal";
  }
  // Nasal: smooth opacity (resonant)
  else if (hasOpacity && durationMs > 500) {
    pClass = "nasal";
    manner = "nasal";
    voicing = "voiced";
    place = "velar";
  }
  // Liquid: smooth translate (flowing)
  else if (hasTranslate && durationMs > 500) {
    pClass = "liquid";
    manner = "lateral";
    voicing = "voiced";
    place = "alveolar";
  }
  // Diphthong: two-vowel glide (color + translate)
  else if (hasColor && hasTranslate) {
    pClass = "diphthong";
    manner = "approximant";
    voicing = "voiced";
    place = "velar";
  }
  // Vowel: long, sustained
  else if (durationMs > 800) {
    pClass = "vowel";
    manner = "approximant";
    voicing = "voiced";
    place = "glottal";
  }

  return { class: pClass, voicing, place, manner };
}

/** Extract phonemes from a component's keyframes. */
function extractPhonemes(spec: MotionSpec): MotionPhoneme[] {
  const phonemes: MotionPhoneme[] = [];

  for (const comp of spec.components) {
    const kfs = comp.keyframes ?? [];
    if (kfs.length === 0) continue;

    // First keyframe is the initial phoneme
    if (kfs.length === 1) {
      const props = (kfs[0].properties ?? {}) as Record<string, string | number>;
      const p = classifyPhoneme({}, props, comp.durationMs);
      phonemes.push({
        componentId: comp.id,
        timeMs: comp.delayMs,
        ...p,
        description: `${p.class} (${p.place}/${p.manner}) at ${comp.delayMs}ms`,
      });
      continue;
    }

    // Subsequent keyframes are transitions (phonemes)
    for (let i = 1; i < kfs.length; i++) {
      const prevProps = (kfs[i - 1].properties ?? {}) as Record<string, string | number>;
      const currProps = (kfs[i].properties ?? {}) as Record<string, string | number>;
      const segDuration = (kfs[i].offset - kfs[i - 1].offset) * comp.durationMs;
      const timeMs = comp.delayMs + kfs[i].offset * comp.durationMs;
      const p = classifyPhoneme(prevProps, currProps, segDuration);
      phonemes.push({
        componentId: comp.id,
        timeMs,
        ...p,
        description: `${p.class} (${p.place}/${p.manner}) at ${timeMs}ms`,
      });
    }
  }

  return phonemes.sort((a, b) => a.timeMs - b.timeMs);
}

// ---------------------------------------------------------------------------
// Morphology
// ---------------------------------------------------------------------------

/** Classify a component as a morpheme. */
function classifyMorpheme(
  comp: MotionComponent,
  index: number,
  total: number,
): Omit<MotionMorpheme, "componentId" | "componentName" | "description"> {
  const firstKf = comp.keyframes?.[0];
  const props = (firstKf?.properties ?? {}) as Record<string, string | number>;
  const kfs = comp.keyframes ?? [];

  // Determine morpheme type by position
  let type: MotionMorpheme["type"] = "root";
  if (index === 0 && total > 1) type = "prefix";
  else if (index === total - 1 && total > 1) type = "suffix";
  else if (total > 3 && index === Math.floor(total / 2)) type = "infix";

  // Determine category by properties
  let category: MotionMorpheme["category"] = "verb";
  let gloss = "act";

  if ("color" in props || "backgroundColor" in props) {
    category = "adjective";
    gloss = "colored";
  } else if ("opacity" in props) {
    category = "adverb";
    gloss = "transparently";
  } else if ("scale" in props) {
    category = "verb";
    gloss = "scale";
  } else if ("rotate" in props) {
    category = "verb";
    gloss = "rotate";
  } else if ("translateX" in props || "translateY" in props) {
    category = "verb";
    gloss = "move";
  } else if ("blur" in props) {
    category = "adjective";
    gloss = "blurred";
  } else if ("brightness" in props) {
    category = "adjective";
    gloss = "bright";
  } else if (kfs.length === 0) {
    category = "noun";
    gloss = "object";
  } else if (comp.durationMs < 200) {
    category = "interjection";
    gloss = "burst";
  } else if (comp.durationMs > 2000) {
    category = "noun";
    gloss = "state";
  }

  return { type, category, gloss };
}

/** Extract morphemes from components. */
function extractMorphemes(spec: MotionSpec): MotionMorpheme[] {
  return spec.components.map((comp, index) => {
    const m = classifyMorpheme(comp, index, spec.components.length);
    return {
      componentId: comp.id,
      componentName: comp.name,
      ...m,
      description: `${m.type} (${m.category}) — "${m.gloss}"`,
    };
  });
}

// ---------------------------------------------------------------------------
// Syntax
// ---------------------------------------------------------------------------

/** Build syntactic phrases by grouping components. */
function buildPhrases(spec: MotionSpec): SyntacticPhrase[] {
  const phrases: SyntacticPhrase[] = [];
  if (spec.components.length === 0) return phrases;

  // Group by temporal overlap
  const sorted = [...spec.components].sort((a, b) => a.delayMs - b.delayMs);
  const groups: MotionComponent[][] = [];
  let currentGroup: MotionComponent[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = sorted[i];
    // If overlaps temporally with previous, add to group
    if (curr.delayMs <= prev.delayMs + prev.durationMs) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);

  // Convert each group to a phrase
  groups.forEach((group, idx) => {
    if (group.length === 0) return;
    // Determine phrase type by dominant component
    const head = group.reduce((longest, c) =>
      c.durationMs > longest.durationMs ? c : longest,
    );
    const dependents = group.filter((c) => c.id !== head.id).map((c) => c.id);

    const headProps = (head.keyframes?.[0]?.properties ?? {}) as Record<string, string | number>;
    let type: SyntacticPhrase["type"] = "verb-phrase";
    if ("color" in headProps || "backgroundColor" in headProps) {
      type = "adjective-phrase";
    } else if ("opacity" in headProps || "blur" in headProps) {
      type = "adverbial-phrase";
    } else if (head.durationMs > 1500) {
      type = "noun-phrase";
    }

    phrases.push({
      id: `phrase-${idx}`,
      type,
      head: head.id,
      dependents,
      startMs: Math.min(...group.map((c) => c.delayMs)),
      endMs: Math.max(...group.map((c) => c.delayMs + c.durationMs)),
      description: `${type} headed by ${head.name ?? head.id} with ${dependents.length} dependent(s)`,
    });
  });

  return phrases;
}

/** Build clauses from phrases. */
function buildClauses(spec: MotionSpec, phrases: SyntacticPhrase[]): MotionClause[] {
  const clauses: MotionClause[] = [];

  // A clause needs at least a predicate (verb phrase)
  const verbPhrases = phrases.filter((p) => p.type === "verb-phrase" || p.type === "noun-phrase");
  if (verbPhrases.length === 0) {
    // Single component = single clause
    if (spec.components.length > 0) {
      const comp = spec.components[0];
      clauses.push({
        id: "clause-0",
        type: "declarative",
        subject: null,
        predicate: comp.id,
        objects: [],
        startMs: comp.delayMs,
        endMs: comp.delayMs + comp.durationMs,
        description: `declarative clause — predicate ${comp.name ?? comp.id}`,
      });
    }
    return clauses;
  }

  verbPhrases.forEach((vp, idx) => {
    // Determine clause type by easing characteristics
    const headComp = spec.components.find((c) => c.id === vp.head);
    let type: MotionClause["type"] = "declarative";

    if (headComp) {
      const easingName =
        typeof headComp.easing === "object" && headComp.easing !== null && "name" in headComp.easing
          ? String((headComp.easing as { name?: unknown }).name ?? "ease")
          : "ease";
      if (headComp.durationMs < 300) type = "imperative";
      else if (easingName.includes("elastic") || easingName.includes("bounce")) type = "exclamative";
      else if (headComp.durationMs > 2000) type = "subjunctive";
    }

    // Find subject (the previous noun-phrase if any)
    const prevPhrases = phrases.slice(0, idx);
    const subjectPhrase = prevPhrases.reverse().find((p) => p.type === "noun-phrase");
    const subject = subjectPhrase?.head ?? null;

    // Find objects (dependents of the verb phrase)
    const objects = vp.dependents;

    clauses.push({
      id: `clause-${idx}`,
      type,
      subject,
      predicate: vp.head,
      objects,
      startMs: vp.startMs,
      endMs: vp.endMs,
      description: `${type} clause — subject ${subject ?? "∅"}, predicate ${vp.head}, ${objects.length} object(s)`,
    });
  });

  return clauses;
}

// ---------------------------------------------------------------------------
// Prosody
// ---------------------------------------------------------------------------

/** Analyze prosody of the composition. */
function analyzeProsody(spec: MotionSpec): ProsodyAnalysis {
  if (spec.components.length === 0) {
    return {
      stressPattern: [],
      intonation: "level",
      tempo: 0,
      rhythm: "syllable-timed",
      pauseCount: 0,
      description: "No prosody — empty utterance",
    };
  }

  // Stress pattern: based on component intensity
  const stressPattern: ProsodyAnalysis["stressPattern"] = spec.components.map((comp) => {
    const intensity = (comp.keyframes?.length ?? 1) * (comp.durationMs / 1000);
    if (intensity > 4) return "strong";
    if (intensity > 1.5) return "secondary";
    return "weak";
  });

  // Intonation: based on duration pattern
  const durations = spec.components.map((c) => c.durationMs);
  const lastDur = durations[durations.length - 1];
  const firstDur = durations[0];
  let intonation: ProsodyAnalysis["intonation"] = "level";
  if (lastDur < firstDur / 2) intonation = "rising";
  else if (lastDur > firstDur * 2) intonation = "falling";
  else if (durations.length > 2) {
    const mid = durations[Math.floor(durations.length / 2)];
    if (mid > firstDur * 1.5 && mid > lastDur * 1.5) intonation = "rise-fall";
    else if (mid < firstDur / 1.5 && mid < lastDur / 1.5) intonation = "fall-rise";
  }

  // Tempo: BPM equivalent
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const tempo = Math.round(60000 / avgDuration);

  // Rhythm type
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  const rhythm: ProsodyAnalysis["rhythm"] =
    stdDev / avgDuration > 0.5 ? "stress-timed" :
    stdDev / avgDuration > 0.2 ? "mora-timed" :
    "syllable-timed";

  // Pause count: gaps between components
  const sorted = [...spec.components].sort((a, b) => a.delayMs - b.delayMs);
  let pauseCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].delayMs - (sorted[i - 1].delayMs + sorted[i - 1].durationMs);
    if (gap > 100) pauseCount++;
  }

  return {
    stressPattern,
    intonation,
    tempo,
    rhythm,
    pauseCount,
    description: `${intonation} intonation, ${tempo} BPM, ${rhythm}, ${pauseCount} pause(s)`,
  };
}

// ---------------------------------------------------------------------------
// Semantics
// ---------------------------------------------------------------------------

/** Analyze semantics of the composition. */
function analyzeSemantics(spec: MotionSpec, morphemes: MotionMorpheme[]): SemanticAnalysis {
  // Lexical fields
  const lexicalFieldsSet = new Set<string>();
  for (const m of morphemes) {
    if (m.gloss.includes("move")) lexicalFieldsSet.add("motion");
    if (m.gloss.includes("color")) lexicalFieldsSet.add("color");
    if (m.gloss.includes("scale")) lexicalFieldsSet.add("size");
    if (m.gloss.includes("rotate")) lexicalFieldsSet.add("rotation");
    if (m.gloss.includes("transparent")) lexicalFieldsSet.add("visibility");
    if (m.gloss.includes("blur")) lexicalFieldsSet.add("focus");
    if (m.gloss.includes("bright")) lexicalFieldsSet.add("luminance");
    if (m.gloss.includes("burst")) lexicalFieldsSet.add("energy");
    if (m.gloss.includes("state")) lexicalFieldsSet.add("stasis");
  }
  const lexicalFields = Array.from(lexicalFieldsSet);

  // Semantic roles
  const roles: SemanticAnalysis["roles"] = morphemes.map((m) => {
    let role: SemanticAnalysis["roles"][number]["role"] = "theme";
    if (m.type === "root") role = "agent";
    else if (m.type === "prefix") role = "instrument";
    else if (m.type === "suffix") role = "patient";
    else if (m.type === "infix") role = "location";
    else if (m.category === "noun") role = "theme";
    else if (m.category === "verb") role = "agent";
    else if (m.category === "adjective") role = "experiencer";
    else if (m.category === "adverb") role = "beneficiary";
    return {
      componentId: m.componentId,
      role,
      description: `${m.componentName ?? m.componentId} as ${role}`,
    };
  });

  // Polarity: based on overall trajectory
  let polarity: SemanticAnalysis["polarity"] = "neutral";
  const totalKfs = spec.components.reduce((s, c) => s + (c.keyframes?.length ?? 0), 0);
  if (totalKfs > spec.components.length * 3) polarity = "positive";
  else if (totalKfs < spec.components.length) polarity = "negative";

  // Modality
  const hasLongDuration = spec.components.some((c) => c.durationMs > 2000);
  const modality: SemanticAnalysis["modality"] = hasLongDuration ? "epistemic" : "dynamic";

  // Tense: based on delay
  const avgDelay = spec.components.reduce((s, c) => s + c.delayMs, 0) / Math.max(1, spec.components.length);
  const tense: SemanticAnalysis["tense"] = avgDelay < 200 ? "present" : avgDelay < 1000 ? "past" : "future";

  // Aspect: based on duration
  const avgDuration = spec.components.reduce((s, c) => s + c.durationMs, 0) / Math.max(1, spec.components.length);
  const aspect: SemanticAnalysis["aspect"] =
    avgDuration < 300 ? "perfective" :
    avgDuration > 2000 ? "habitual" :
    "progressive";

  return {
    lexicalFields,
    roles,
    polarity,
    modality,
    tense,
    aspect,
    description: `${polarity} polarity, ${modality} modality, ${tense} tense, ${aspect} aspect, fields: ${lexicalFields.join(", ") || "none"}`,
  };
}

// ---------------------------------------------------------------------------
// Pragmatics
// ---------------------------------------------------------------------------

/** Analyze pragmatics of the composition. */
function analyzePragmatics(spec: MotionSpec, clauses: MotionClause[]): PragmaticAnalysis {
  let speechAct: PragmaticAnalysis["speechAct"] = "assertive";
  let illocutionaryForce = "assertion";

  if (clauses.some((c) => c.type === "imperative")) {
    speechAct = "directive";
    illocutionaryForce = "command";
  } else if (clauses.some((c) => c.type === "exclamative")) {
    speechAct = "expressive";
    illocutionaryForce = "exclamation";
  } else if (clauses.some((c) => c.type === "subjunctive")) {
    speechAct = "commissive";
    illocutionaryForce = "promise";
  } else if (clauses.length > 3) {
    speechAct = "declaration";
    illocutionaryForce = "declaration";
  } else {
    speechAct = "verdictive";
    illocutionaryForce = "assessment";
  }

  // Politeness: longer durations = more polite
  const avgDuration = spec.components.reduce((s, c) => s + c.durationMs, 0) / Math.max(1, spec.components.length);
  const politeness = Math.min(1, avgDuration / 2000);

  // Formality: based on regularity
  const durations = spec.components.map((c) => c.durationMs);
  const avg = durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length);
  const variance = durations.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / Math.max(1, durations.length);
  const stdDev = Math.sqrt(variance);
  const formality = Math.max(0, Math.min(1, 1 - (stdDev / Math.max(1, avg))));

  return {
    speechAct,
    illocutionaryForce,
    politeness,
    formality,
    description: `${speechAct} act — ${illocutionaryForce}, politeness ${(politeness * 100).toFixed(0)}%, formality ${(formality * 100).toFixed(0)}%`,
  };
}

// ---------------------------------------------------------------------------
// Discourse
// ---------------------------------------------------------------------------

/** Analyze discourse coherence. */
function analyzeDiscourse(spec: MotionSpec, clauses: MotionClause[]): DiscourseAnalysis {
  const relations: DiscourseAnalysis["relations"] = [];

  for (let i = 1; i < clauses.length; i++) {
    const prev = clauses[i - 1];
    const curr = clauses[i];
    const gap = curr.startMs - prev.endMs;

    let relation: DiscourseAnalysis["relations"][number]["relation"] = "narration";
    if (gap > 500) relation = "background";
    else if (curr.type === "exclamative") relation = "result";
    else if (curr.type === "subjunctive") relation = "condition";
    else if (curr.subject === prev.subject) relation = "elaboration";
    else if (curr.type !== prev.type) relation = "contrast";
    else if (gap < 50) relation = "parallel";

    relations.push({
      fromClause: prev.id,
      toClause: curr.id,
      relation,
      description: `${prev.id} → ${curr.id}: ${relation}`,
    });
  }

  // Rhetorical structure
  let rhetoricalStructure: DiscourseAnalysis["rhetoricalStructure"] = "narrative";
  if (clauses.length === 0) rhetoricalStructure = "descriptive";
  else if (clauses.every((c) => c.type === "declarative")) rhetoricalStructure = "expository";
  else if (clauses.some((c) => c.type === "imperative")) rhetoricalStructure = "argumentative";
  else if (clauses.length > 4) rhetoricalStructure = "dialogic";

  // Cohesion: based on temporal continuity
  let totalGap = 0;
  let totalDuration = 0;
  const sorted = [...spec.components].sort((a, b) => a.delayMs - b.delayMs);
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.max(0, sorted[i].delayMs - (sorted[i - 1].delayMs + sorted[i - 1].durationMs));
    totalGap += gap;
    totalDuration += sorted[i].durationMs;
  }
  const cohesion = totalDuration === 0 ? 1 : Math.max(0, 1 - totalGap / (totalGap + totalDuration));

  return {
    relations,
    rhetoricalStructure,
    cohesion,
    description: `${rhetoricalStructure} structure, ${relations.length} relation(s), cohesion ${(cohesion * 100).toFixed(0)}%`,
  };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/** Analyze a motion composition as a linguistic utterance. */
export function analyzeLinguistics(spec: MotionSpec): LinguisticsAnalysis {
  if (spec.components.length === 0) {
    return {
      phonemes: [],
      morphemes: [],
      phrases: [],
      clauses: [],
      prosody: {
        stressPattern: [],
        intonation: "level",
        tempo: 0,
        rhythm: "syllable-timed",
        pauseCount: 0,
        description: "No prosody — empty utterance",
      },
      semantics: {
        lexicalFields: [],
        roles: [],
        polarity: "neutral",
        modality: "dynamic",
        tense: "present",
        aspect: "perfective",
        description: "No semantics — empty utterance",
      },
      pragmatics: {
        speechAct: "assertive",
        illocutionaryForce: "assertion",
        politeness: 0.5,
        formality: 0.5,
        description: "No pragmatics — empty utterance",
      },
      discourse: {
        relations: [],
        rhetoricalStructure: "descriptive",
        cohesion: 1,
        description: "No discourse — empty utterance",
      },
      languageFamily: "isolate",
      register: "consultative",
      summary: "Linguistics: empty utterance",
    };
  }

  const phonemes = extractPhonemes(spec);
  const morphemes = extractMorphemes(spec);
  const phrases = buildPhrases(spec);
  const clauses = buildClauses(spec, phrases);
  const prosody = analyzeProsody(spec);
  const semantics = analyzeSemantics(spec, morphemes);
  const pragmatics = analyzePragmatics(spec, clauses);
  const discourse = analyzeDiscourse(spec, clauses);

  // Determine language family from phoneme distribution
  const classCounts: Record<string, number> = {};
  for (const p of phonemes) {
    classCounts[p.class] = (classCounts[p.class] ?? 0) + 1;
  }
  const dominantClass = Object.entries(classCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "vowel";
  const languageFamily =
    dominantClass === "plosive" ? "Indo-European" :
    dominantClass === "tonal" ? "Sino-Tibetan" :
    dominantClass === "fricative" ? "Afro-Asiatic" :
    dominantClass === "nasal" ? "Niger-Congo" :
    dominantClass === "vowel" ? "Austronesian" :
    "Ural-Altaic";

  // Determine register from politeness and formality
  const register: LinguisticsAnalysis["register"] =
    pragmatics.politeness > 0.8 && pragmatics.formality > 0.8 ? "frozen" :
    pragmatics.formality > 0.7 ? "formal" :
    pragmatics.formality > 0.4 ? "consultative" :
    pragmatics.formality > 0.2 ? "casual" :
    "intimate";

  const summary =
    `Linguistics: ${languageFamily} family, ${register} register, ` +
    `${phonemes.length} phoneme(s), ${morphemes.length} morpheme(s), ` +
    `${phrases.length} phrase(s), ${clauses.length} clause(s), ` +
    `${pragmatics.speechAct} act, ${discourse.rhetoricalStructure} structure`;

  return {
    phonemes,
    morphemes,
    phrases,
    clauses,
    prosody,
    semantics,
    pragmatics,
    discourse,
    languageFamily,
    register,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a linguistics analysis as a human-readable report. */
export function formatLinguisticsReport(analysis: LinguisticsAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Linguistics Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // Phonology
  lines.push("## Phonology");
  if (analysis.phonemes.length === 0) {
    lines.push("- No phonemes detected");
  } else {
    const classCounts: Record<string, number> = {};
    for (const p of analysis.phonemes) {
      classCounts[p.class] = (classCounts[p.class] ?? 0) + 1;
    }
    for (const [cls, count] of Object.entries(classCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${cls}: ${count}`);
    }
  }
  lines.push("");

  // Morphology
  lines.push("## Morphology");
  if (analysis.morphemes.length === 0) {
    lines.push("- No morphemes detected");
  } else {
    for (const m of analysis.morphemes) {
      lines.push(`- [${m.type}/${m.category}] ${m.componentName ?? m.componentId} — "${m.gloss}"`);
    }
  }
  lines.push("");

  // Syntax
  lines.push("## Syntax");
  lines.push(`- Phrases: ${analysis.phrases.length}`);
  lines.push(`- Clauses: ${analysis.clauses.length}`);
  for (const c of analysis.clauses) {
    lines.push(`  - [${c.type}] subject=${c.subject ?? "∅"}, predicate=${c.predicate}`);
  }
  lines.push("");

  // Prosody
  lines.push("## Prosody");
  lines.push(`- ${analysis.prosody.description}`);
  lines.push("");

  // Semantics
  lines.push("## Semantics");
  lines.push(`- ${analysis.semantics.description}`);
  lines.push("");

  // Pragmatics
  lines.push("## Pragmatics");
  lines.push(`- ${analysis.pragmatics.description}`);
  lines.push("");

  // Discourse
  lines.push("## Discourse");
  lines.push(`- ${analysis.discourse.description}`);

  return lines.join("\n");
}
