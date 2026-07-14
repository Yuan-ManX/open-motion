/**
 * Motion Design Principles Engine — applies and analyzes Disney's 12 principles
 * of animation against motion components. Each principle has a checker that
 * detects presence in existing keyframes and an applier that modifies
 * keyframes to embody the principle.
 *
 * The 12 principles: squash & stretch, anticipation, staging, slow in/slow out,
 * arcs, secondary action, timing, exaggeration, solid drawing, appeal,
 * follow through, overlapping action.
 */

import type { Easing, Keyframe, MotionComponent } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";

export type PrincipleId =
  | "squash_stretch"
  | "anticipation"
  | "staging"
  | "slow_in_out"
  | "arcs"
  | "secondary_action"
  | "timing"
  | "exaggeration"
  | "solid_drawing"
  | "appeal"
  | "follow_through"
  | "overlapping_action";

export interface PrincipleInfo {
  id: PrincipleId;
  name: string;
  description: string;
  category: "physics" | "rhythm" | "composition" | "personality";
}

export const PRINCIPLES: PrincipleInfo[] = [
  { id: "squash_stretch", name: "Squash & Stretch", description: "Deform shape to convey weight, impact, and flexibility. Objects squash on impact and stretch during fast motion.", category: "physics" },
  { id: "anticipation", name: "Anticipation", description: "Prepare the audience for an action with a small opposing movement before the main motion begins.", category: "rhythm" },
  { id: "staging", name: "Staging", description: "Direct the audience's eye to a single focal point. One clear action at a time with supporting elements subdued.", category: "composition" },
  { id: "slow_in_out", name: "Slow In & Slow Out", description: "Objects ease into and out of motion. Few frames in the middle, more at the start and end. Avoid linear timing for organic motion.", category: "rhythm" },
  { id: "arcs", name: "Arcs", description: "Natural motion follows curved paths, not straight lines. Organic objects trace arcs through space.", category: "physics" },
  { id: "secondary_action", name: "Secondary Action", description: "Supporting motion that enriches the primary action without competing for attention.", category: "composition" },
  { id: "timing", name: "Timing", description: "Duration conveys meaning: fast reads as light/sudden, slow reads as heavy/deliberate. Match duration to the emotion.", category: "rhythm" },
  { id: "exaggeration", name: "Exaggeration", description: "Push motion beyond reality for clarity and impact. The action remains believable but more dynamic.", category: "personality" },
  { id: "solid_drawing", name: "Solid Drawing", description: "Convey 3D weight and volume through consistent perspective, shading, and depth cues.", category: "composition" },
  { id: "appeal", name: "Appeal", description: "Pleasing design with clear silhouette, harmonious proportions, and personality that draws the eye.", category: "personality" },
  { id: "follow_through", name: "Follow Through", description: "Parts of an object continue moving after the body stops, then settle with diminishing oscillation.", category: "physics" },
  { id: "overlapping_action", name: "Overlapping Action", description: "Different parts move at different rates — the body leads, appendages follow with delay.", category: "physics" },
];

export interface PrincipleAssessment {
  principleId: PrincipleId;
  principleName: string;
  present: boolean;
  score: number;
  notes: string;
}

export interface PrincipleReport {
  componentId: string;
  componentName: string;
  assessments: PrincipleAssessment[];
  overallScore: number;
  presentCount: number;
  missingPrinciples: PrincipleId[];
  topSuggestions: string[];
}

type DnaSource = Pick<MotionComponent, "name" | "easing" | "durationMs" | "iterationCount" | "direction" | "keyframes">;

/** Extract the set of animated property names from keyframes. */
function animatedProps(keyframes: Keyframe[]): Set<string> {
  const props = new Set<string>();
  for (const kf of keyframes) {
    for (const key of Object.keys(kf.properties)) {
      props.add(key);
    }
  }
  return props;
}

/** Check if easing is linear (no slow in/out). */
function isLinearEasing(easing: Easing): boolean {
  return easing.type === "preset" && easing.name === "linear";
}

/** Check if easing has overshoot (bounce/elastic/back/spring). */
function hasOvershoot(easing: Easing): boolean {
  if (easing.type === "preset") {
    return ["bounce", "elastic", "back"].includes(easing.name);
  }
  if (easing.type === "spring") {
    return easing.damping < 20;
  }
  if (easing.type === "bezier") {
    return easing.p1[1] > 1 || easing.p2[1] < 0;
  }
  return false;
}

/** Count keyframes in a component. */
function keyframeCount(comp: DnaSource): number {
  return comp.keyframes.length;
}

/** Check if scale animation exists (for squash & stretch). */
function hasScaleAnimation(props: Set<string>): boolean {
  return props.has("scale") || props.has("scaleX") || props.has("scaleY");
}

/** Check if any keyframe has a scale value different from 1 (actual deformation). */
function hasScaleDeformation(comp: DnaSource): boolean {
  for (const kf of comp.keyframes) {
    const s = kf.properties.scale ?? kf.properties.scaleX ?? kf.properties.scaleY;
    if (s != null && s !== "1" && s !== 1) return true;
  }
  return false;
}

/** Check if there's a keyframe before the main motion (anticipation). */
function hasAnticipationKeyframe(comp: DnaSource): boolean {
  if (comp.keyframes.length < 3) return false;
  const first = comp.keyframes[0];
  const second = comp.keyframes[1];
  return first.offset < 0.1 && second.offset < 0.3;
}

/** Check if motion follows an arc (both X and Y change). */
function hasArcMotion(props: Set<string>, comp: DnaSource): boolean {
  const hasX = props.has("translateX");
  const hasY = props.has("translateY");
  if (!hasX || !hasY) return false;
  const xValues = comp.keyframes.map(kf => kf.properties.translateX).filter(v => v != null);
  const yValues = comp.keyframes.map(kf => kf.properties.translateY).filter(v => v != null);
  return xValues.length >= 2 && yValues.length >= 2;
}

/** Check for diminishing oscillation at the end (follow through). */
function hasFollowThrough(comp: DnaSource): boolean {
  if (comp.keyframes.length < 4) return false;
  const lastThree = comp.keyframes.slice(-3);
  const values = lastThree.map(kf => {
    const props = kf.properties;
    return parseFloat(String(props.translateY ?? props.translateX ?? props.scale ?? props.rotate ?? "0"));
  });
  if (values.some(v => isNaN(v))) return false;
  const amplitude1 = Math.abs(values[1] - values[0]);
  const amplitude2 = Math.abs(values[2] - values[1]);
  return amplitude2 < amplitude1 && amplitude2 > 0.1;
}

/** Check if duration is appropriate for the motion type. */
function assessTiming(comp: DnaSource): { present: boolean; score: number; notes: string } {
  const dur = comp.durationMs;
  const props = animatedProps(comp.keyframes);
  if (dur < 200) {
    return { present: false, score: 20, notes: "Duration is very short (< 200ms) — too fast to read the motion clearly." };
  }
  if (dur > 5000 && comp.iterationCount === 1) {
    return { present: false, score: 40, notes: "Duration is very long (> 5s) for a single-play animation — may lose audience attention." };
  }
  if (props.has("opacity") && dur < 300) {
    return { present: false, score: 50, notes: "Fade animation is too brief — fades need at least 300ms to feel natural." };
  }
  if (props.has("rotate") && dur < 400) {
    return { present: false, score: 50, notes: "Rotation is too fast — audiences can't process rotation under 400ms." };
  }
  return { present: true, score: 90, notes: `Duration (${dur}ms) is well-matched to the motion type.` };
}

/** Check if motion has exaggeration (large value ranges). */
function hasExaggeration(comp: DnaSource): boolean {
  for (const kf of comp.keyframes) {
    for (const [key, val] of Object.entries(kf.properties)) {
      const num = parseFloat(String(val));
      if (isNaN(num)) continue;
      if (key.startsWith("translate") && Math.abs(num) > 50) return true;
      if (key.startsWith("scale") && Math.abs(num) > 1.3) return true;
      if (key === "rotate" && Math.abs(num) > 180) return true;
    }
  }
  return false;
}

/**
 * Analyze a motion component against all 12 principles.
 */
export function analyzePrinciples(comp: DnaSource): PrincipleReport {
  const props = animatedProps(comp.keyframes);
  const kfCount = keyframeCount(comp);
  const assessments: PrincipleAssessment[] = [];

  // 1. Squash & Stretch
  const hasSquash = hasScaleAnimation(props) && hasScaleDeformation(comp);
  assessments.push({
    principleId: "squash_stretch",
    principleName: "Squash & Stretch",
    present: hasSquash,
    score: hasSquash ? 85 : 0,
    notes: hasSquash ? "Scale deformation detected — good use of squash & stretch." : "No scale deformation found. Add scaleX/scaleY keyframes to convey weight and impact.",
  });

  // 2. Anticipation
  const hasAnt = hasAnticipationKeyframe(comp);
  assessments.push({
    principleId: "anticipation",
    principleName: "Anticipation",
    present: hasAnt,
    score: hasAnt ? 80 : 0,
    notes: hasAnt ? "Pre-action keyframe detected — the audience is prepared for the main motion." : "No anticipation keyframe. Add a small opposing movement before the main action starts.",
  });

  // 3. Staging (assessed at project level, for single component check if it's the focal point)
  assessments.push({
    principleId: "staging",
    principleName: "Staging",
    present: true,
    score: 70,
    notes: "Staging is a composition-level principle — ensure this component is the primary focal point during its animation.",
  });

  // 4. Slow In & Slow Out
  const linear = isLinearEasing(comp.easing);
  const hasOvershootEasing = hasOvershoot(comp.easing);
  assessments.push({
    principleId: "slow_in_out",
    principleName: "Slow In & Slow Out",
    present: !linear,
    score: linear ? 10 : hasOvershootEasing ? 95 : 85,
    notes: linear ? "Easing is linear — objects start and stop abruptly. Use ease-in-out or spring for natural deceleration." : "Easing provides good slow-in/slow-out. " + (hasOvershootEasing ? "Overshoot adds organic feel." : ""),
  });

  // 5. Arcs
  const hasArcs = hasArcMotion(props, comp);
  assessments.push({
    principleId: "arcs",
    principleName: "Arcs",
    present: hasArcs,
    score: hasArcs ? 85 : 30,
    notes: hasArcs ? "Both X and Y translation detected — motion follows a curved path." : "Motion is single-axis. Add perpendicular translation for natural arc trajectories.",
  });

  // 6. Secondary Action
  const propList = [...props];
  const hasSecondary = propList.length >= 2 && (props.has("opacity") || props.has("boxShadow") || props.has("filter"));
  assessments.push({
    principleId: "secondary_action",
    principleName: "Secondary Action",
    present: hasSecondary,
    score: hasSecondary ? 80 : 40,
    notes: hasSecondary ? "Multiple animated properties detected — secondary motion enriches the primary action." : "Only one property animated. Add opacity or shadow changes as secondary action.",
  });

  // 7. Timing
  const timing = assessTiming(comp);
  assessments.push({
    principleId: "timing",
    principleName: "Timing",
    present: timing.present,
    score: timing.score,
    notes: timing.notes,
  });

  // 8. Exaggeration
  const hasExag = hasExaggeration(comp);
  assessments.push({
    principleId: "exaggeration",
    principleName: "Exaggeration",
    present: hasExag,
    score: hasExag ? 85 : 50,
    notes: hasExag ? "Large motion values detected — the animation pushes beyond realistic for impact." : "Motion values are subtle. Consider increasing travel distance or rotation for more dynamic feel.",
  });

  // 9. Solid Drawing (assessed via style — check for 3D transforms)
  const has3d = props.has("rotateX") || props.has("rotateY") || props.has("translateZ") || props.has("scaleZ");
  assessments.push({
    principleId: "solid_drawing",
    principleName: "Solid Drawing",
    present: has3d,
    score: has3d ? 85 : 50,
    notes: has3d ? "3D transforms detected — the component has dimensional weight." : "No 3D transforms. Consider rotateX/rotateY for depth and volume.",
  });

  // 10. Appeal (assessed via style properties)
  assessments.push({
    principleId: "appeal",
    principleName: "Appeal",
    present: true,
    score: 70,
    notes: "Appeal depends on visual design — ensure clear silhouette, harmonious colors, and pleasing proportions.",
  });

  // 11. Follow Through
  const hasFT = hasFollowThrough(comp);
  assessments.push({
    principleId: "follow_through",
    principleName: "Follow Through",
    present: hasFT,
    score: hasFT ? 85 : 30,
    notes: hasFT ? "Diminishing oscillation detected at the end — parts settle naturally after the main motion." : "No follow-through detected. Add settling keyframes with decreasing amplitude at the end.",
  });

  // 12. Overlapping Action
  const hasOverlap = kfCount >= 4 && propList.length >= 2;
  assessments.push({
    principleId: "overlapping_action",
    principleName: "Overlapping Action",
    present: hasOverlap,
    score: hasOverlap ? 75 : 35,
    notes: hasOverlap ? "Multiple properties with enough keyframes for overlapping timing." : "Add more keyframes or animate multiple properties at different rates for overlapping action.",
  });

  const presentCount = assessments.filter(a => a.present).length;
  const overallScore = Math.round(assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length);
  const missingPrinciples = assessments.filter(a => !a.present).map(a => a.principleId);
  const topSuggestions = assessments
    .filter(a => !a.present || a.score < 50)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(a => a.notes);

  return {
    componentId: (comp as MotionComponent).id ?? "unknown",
    componentName: comp.name,
    assessments,
    overallScore,
    presentCount,
    missingPrinciples,
    topSuggestions,
  };
}

export interface PrincipleApplication {
  principleId: PrincipleId;
  componentId: string;
  applied: boolean;
  modifiedKeyframes: Keyframe[];
  modifiedEasing: Easing | null;
  description: string;
}

/**
 * Apply a specific principle to a motion component, returning modified
 * keyframes and easing.
 */
export function applyPrinciple(
  comp: DnaSource,
  principleId: PrincipleId,
): PrincipleApplication {
  const componentId = (comp as MotionComponent).id ?? "unknown";
  const keyframes: Keyframe[] = [...comp.keyframes];
  let modifiedEasing: Easing | null = null;
  let description = "";

  switch (principleId) {
    case "squash_stretch": {
      const hasScale = keyframes.some(kf => kf.properties.scale != null);
      if (!hasScale) {
        keyframes.splice(1, 0, {
          offset: 0.1,
          properties: { scaleX: "1.2", scaleY: "0.8" },
        });
        keyframes.push({ offset: 1, properties: { scaleX: "1", scaleY: "1" } });
      } else {
        for (const kf of keyframes) {
          if (kf.properties.scale) {
            kf.properties = { ...kf.properties, scaleX: kf.properties.scale, scaleY: kf.properties.scale };
            delete kf.properties.scale;
          }
        }
      }
      description = "Added scaleX/scaleY keyframes — the object squashes on impact and stretches during fast motion, conveying weight and flexibility.";
      break;
    }

    case "anticipation": {
      const props = animatedProps(keyframes);
      const mainProp = props.has("translateY") ? "translateY" : props.has("translateX") ? "translateX" : props.has("scale") ? "scale" : "opacity";
      const firstVal = keyframes[0]?.properties[mainProp];
      const anticipVal = mainProp === "opacity" ? "0.05" : mainProp === "scale" ? "0.85" : "8px";
      keyframes.unshift({
        offset: 0,
        properties: { [mainProp]: anticipVal },
      });
      if (keyframes.length > 1) {
        keyframes[1].offset = 0.05;
      }
      const total = keyframes.length;
      for (let i = 2; i < total; i++) {
        keyframes[i].offset = 0.05 + (keyframes[i].offset ?? (i / total)) * 0.95;
      }
      description = `Added an anticipation keyframe at offset 0 — a small ${mainProp} movement opposite to the main action prepares the audience for what's coming.`;
      break;
    }

    case "slow_in_out": {
      if (isLinearEasing(comp.easing)) {
        modifiedEasing = easingPreset("ease-in-out");
        description = "Replaced linear easing with ease-in-out — the motion now decelerates into and accelerates out of key positions naturally.";
      } else {
        modifiedEasing = { type: "bezier", p1: [0.25, 0.1], p2: [0.25, 1] };
        description = "Adjusted easing curve for stronger slow-in/slow-out — more time spent at the extremes, less in the middle.";
      }
      break;
    }

    case "follow_through": {
      const props = animatedProps(keyframes);
      const mainProp = (props.has("translateY") ? "translateY" : props.has("translateX") ? "translateX" : props.has("scale") ? "scale" : "opacity") as "translateY" | "translateX" | "scale" | "opacity";
      const lastKf = keyframes[keyframes.length - 1];
      const settleVal = parseFloat(String(lastKf?.properties[mainProp] ?? "0"));
      if (!isNaN(settleVal)) {
        keyframes.push(
          { offset: 0.85, properties: { [mainProp]: String(settleVal + (mainProp === "opacity" ? -0.05 : 3)) } },
          { offset: 0.92, properties: { [mainProp]: String(settleVal + (mainProp === "opacity" ? -0.02 : -1)) } },
          { offset: 1, properties: { [mainProp]: String(settleVal) } },
        );
        for (let i = keyframes.length - 4; i >= 0; i--) {
          keyframes[i].offset = (keyframes[i].offset ?? 0) * 0.85;
        }
      }
      description = `Added diminishing oscillation keyframes after the main motion — the ${mainProp} value overshoots and settles with decreasing amplitude.`;
      break;
    }

    case "exaggeration": {
      for (const kf of keyframes) {
        for (const [key, val] of Object.entries(kf.properties)) {
          const num = parseFloat(String(val));
          if (isNaN(num)) continue;
          const propKey = key as keyof typeof kf.properties;
          if (key.startsWith("translate") && Math.abs(num) > 0) {
            kf.properties[propKey] = String(num * 1.5) + (String(val).includes("px") ? "px" : "");
          }
          if (key.startsWith("scale") && num > 1) {
            kf.properties[propKey] = String(num * 1.2);
          }
          if (key === "rotate" && Math.abs(num) > 0) {
            kf.properties[propKey] = String(num * 1.3) + (String(val).includes("deg") ? "deg" : "");
          }
        }
      }
      description = "Increased motion values by 20-50% — travel distance, scale, and rotation are pushed beyond realistic for greater impact and clarity.";
      break;
    }

    case "arcs": {
      const props = animatedProps(keyframes);
      if (props.has("translateX") && !props.has("translateY")) {
        for (const kf of keyframes) {
          if (kf.properties.translateX != null) {
            const x = parseFloat(String(kf.properties.translateX));
            const arcOffset = Math.sin((kf.offset ?? 0) * Math.PI) * 30;
            kf.properties.translateY = `${arcOffset}px`;
          }
        }
        description = "Added translateY keyframes following a sine arc — the motion now curves through space instead of traveling in a straight line.";
      } else if (props.has("translateY") && !props.has("translateX")) {
        for (const kf of keyframes) {
          if (kf.properties.translateY != null) {
            const y = parseFloat(String(kf.properties.translateY));
            const arcOffset = Math.sin((kf.offset ?? 0) * Math.PI) * 20;
            kf.properties.translateX = `${arcOffset}px`;
          }
        }
        description = "Added translateX keyframes following a sine arc — the motion now curves through space instead of traveling in a straight line.";
      } else {
        description = "Both X and Y are already animated — the motion likely follows an arc. No changes needed.";
      }
      break;
    }

    case "secondary_action": {
      const hasOpacity = keyframes.some(kf => kf.properties.opacity != null);
      if (!hasOpacity) {
        for (const kf of keyframes) {
          const t = kf.offset ?? 0;
          kf.properties.opacity = String(0.5 + 0.5 * Math.sin(t * Math.PI));
        }
        description = "Added opacity as a secondary action — the component fades in/out alongside its primary motion, enriching the overall movement.";
      } else {
        for (const kf of keyframes) {
          if (kf.properties.boxShadow == null) {
            kf.properties.boxShadow = `0 0 ${(kf.offset ?? 0) * 20}px rgba(255,255,255,0.3)`;
          }
        }
        description = "Added boxShadow as a secondary action — a glow effect accompanies the primary motion for added richness.";
      }
      break;
    }

    case "overlapping_action": {
      if (keyframes.length >= 2) {
        const lastKf = keyframes[keyframes.length - 1];
        const props = animatedProps(keyframes);
        const secondaryProp = props.has("scale") ? "rotate" : "scale";
        keyframes.push(
          { offset: 0.7, properties: { [secondaryProp]: secondaryProp === "rotate" ? "5deg" : "1.05" } },
          { offset: 0.85, properties: { [secondaryProp]: secondaryProp === "rotate" ? "-2deg" : "1.02" } },
          { offset: 1, properties: { [secondaryProp]: secondaryProp === "rotate" ? "0deg" : "1" } },
        );
        for (let i = 0; i < keyframes.length - 3; i++) {
          keyframes[i].offset = (keyframes[i].offset ?? 0) * 0.7;
        }
        description = `Added ${secondaryProp} keyframes that lag behind the primary motion — the secondary property starts and finishes later, creating overlapping action.`;
      }
      break;
    }

    case "timing": {
      if (comp.durationMs < 400) {
        description = `Duration (${comp.durationMs}ms) is too short. Increase to at least 500ms for the motion to be readable.`;
      } else if (comp.durationMs > 4000) {
        description = `Duration (${comp.durationMs}ms) is too long for a single play. Consider breaking into shorter segments or adding loops.`;
      } else {
        description = `Duration (${comp.durationMs}ms) is well-timed for the motion type.`;
      }
      break;
    }

    case "staging":
      description = "Staging is a composition-level principle. Ensure this component is the only animated element during its time window, with others at rest or subdued.";
      break;

    case "solid_drawing":
      if (!keyframes.some(kf => kf.properties.rotateY != null)) {
        const mid = Math.floor(keyframes.length / 2);
        keyframes.splice(mid, 0, { offset: 0.5, properties: { rotateY: "8deg" } });
        keyframes.push({ offset: 1, properties: { rotateY: "0deg" } });
        description = "Added rotateY keyframes — a subtle 3D rotation gives the component dimensional weight and depth.";
      } else {
        description = "3D transforms already present — the component has good dimensional quality.";
      }
      break;

    case "appeal":
      description = "Appeal is a design-level principle. Ensure the component has a clear silhouette, harmonious color palette, and proportions that draw the eye.";
      break;

    default:
      description = `Principle ${principleId} application not yet implemented.`;
      break;
  }

  // Normalize offsets to 0..1 range
  const total = keyframes.length;
  if (total > 0) {
    const maxOffset = Math.max(...keyframes.map(kf => kf.offset ?? 0));
    if (maxOffset > 1) {
      for (const kf of keyframes) {
        kf.offset = (kf.offset ?? 0) / maxOffset;
      }
    }
    keyframes.sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));
    if (keyframes.length > 0) keyframes[0].offset = 0;
    if (keyframes.length > 1) keyframes[keyframes.length - 1].offset = 1;
  }

  return {
    principleId,
    componentId,
    applied: true,
    modifiedKeyframes: keyframes,
    modifiedEasing,
    description,
  };
}
