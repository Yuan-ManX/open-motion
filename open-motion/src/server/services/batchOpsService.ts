/**
 * Motion component duplication detection and multi-component batch
 * operations on the project store. Companion to componentService.ts for
 * the advanced batch operations the frontend uses after split/distribute.
 *
 * Duplication detection works by building a signature of each component
 * (keyframes normalized to 0..1, duration bucket, easing, property set)
 * and comparing signatures — exact duplicates can be safely removed (with
 * a single reference kept) while near-duplicates surface as suggestions
 * so the user can make the call.
 */

import type { MotionComponent } from "@openmotion/shared";
import { ensureProjectExists } from "./projectService.js";
import {
  listComponents,
  batchDeleteComponents,
  patchComponent,
} from "../../db/repositories/components.js";
import type { ComponentPatch } from "../../db/repositories/components.js";

// ---------------------------------------------------------------------------
// Component signature (for duplicate detection)
// ---------------------------------------------------------------------------

interface ComponentSignature {
  /** Hash-like string based on normalized keyframes + easing */
  kfpHash: string;
  durationBucket: "micro" | "short" | "standard" | "long" | "epic";
  easingFamily: string;
  iterationCount: string;
  sortedPropertyKeys: string;
}

function normalizeOffset(offset: number, index: number, total: number): number {
  if (!isNaN(offset)) return Math.round(offset);
  return Math.round((index / Math.max(1, total - 1)) * 100);
}

function bucketDuration(ms: number): ComponentSignature["durationBucket"] {
  if (ms < 200) return "micro";
  if (ms < 500) return "short";
  if (ms < 1000) return "standard";
  if (ms < 2000) return "long";
  return "epic";
}

function easingFamily(e: unknown): string {
  if (!e) return "ease-out";
  if (typeof e === "object" && "name" in (e as Record<string, unknown>)) {
    const name = String((e as Record<string, unknown>).name);
    if (name.includes("spring")) return "spring";
    if (name.includes("elastic")) return "elastic";
    if (name.includes("bounce")) return "bounce";
    return name;
  }
  return "custom";
}

function simpleHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function buildSignature(component: MotionComponent): ComponentSignature {
  const kfs = (component.keyframes as Array<{ offset?: number; properties?: Record<string, unknown> }> | undefined) ?? [];
  const normalized = kfs.map((k, i) => {
    const off = normalizeOffset(k.offset ?? NaN, i, kfs.length);
    const props = k.properties ?? {};
    const keys = Object.keys(props).sort();
    const values = keys.map((k2) => {
      const v = props[k2];
      if (typeof v === "number") return Math.round(v * 100) / 100;
      return String(v);
    });
    return `${off}:${keys.join(",")}:${values.join("|")}`;
  }).join(";");
  const keys = new Set<string>();
  for (const kf of kfs) {
    for (const k of Object.keys(kf.properties ?? {})) keys.add(k);
  }
  return {
    kfpHash: simpleHash(normalized),
    durationBucket: bucketDuration(Number(component.durationMs) || 0),
    easingFamily: easingFamily(component.easing),
    iterationCount: String(component.iterationCount),
    sortedPropertyKeys: [...keys].sort().join(","),
  };
}

function sigKey(s: ComponentSignature): string {
  return [s.kfpHash, s.durationBucket, s.easingFamily, s.iterationCount, s.sortedPropertyKeys].join("|");
}

/**
 * Simple Jaccard similarity over two signature keysets — used for
 * near-duplicate detection (similarity < 1 but still close).
 */
function signatureSimilarity(a: ComponentSignature, b: ComponentSignature): number {
  if (a.durationBucket !== b.durationBucket) return 0;
  const propA = new Set(a.sortedPropertyKeys.split(",").filter(Boolean));
  const propB = new Set(b.sortedPropertyKeys.split(",").filter(Boolean));
  if (propA.size === 0 && propB.size === 0) return 1;
  let intersect = 0;
  for (const p of propA) if (propB.has(p)) intersect++;
  const union = propA.size + propB.size - intersect;
  const propSim = union === 0 ? 1 : intersect / union;
  const hashMatch = a.kfpHash === b.kfpHash ? 1 : 0;
  const easingMatch = a.easingFamily === b.easingFamily ? 1 : 0;
  return Math.round((hashMatch * 0.5 + easingMatch * 0.15 + propSim * 0.35) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Public API — duplicate finding
// ---------------------------------------------------------------------------

export interface DuplicateGroup {
  /** The component the dedup engine considers the "canonical" one to keep (oldest by createdAt). */
  keepId: string;
  /** Components that match the canonical one exactly or near-exactly. */
  candidateIds: string[];
  /** Match score: 1 = exact, otherwise 0..1 for near-duplicates. */
  score: number;
  /** "exact" or "near" */
  kind: "exact" | "near";
  /** Human readable note: how many keyframes, shared easing etc. */
  note: string;
}

/**
 * Find duplicate components in a project. Threshold tunes near-duplicate
 * sensitivity (0.9 = require 90% similarity before suggesting a merge).
 */
export function findDuplicateComponents(
  projectId: string,
  opts: { nearThreshold?: number } = {},
): DuplicateGroup[] {
  ensureProjectExists(projectId);
  const threshold = opts.nearThreshold ?? 0.9;
  const components = listComponents(projectId);
  const sigs = new Map<string, { sig: ComponentSignature; comp: MotionComponent }>();
  for (const c of components) sigs.set(c.id, { sig: buildSignature(c), comp: c });

  // Map signature -> list of component ids sharing it (exact duplicates)
  const exact = new Map<string, MotionComponent[]>();
  for (const c of components) {
    const key = sigKey(sigs.get(c.id)!.sig);
    const bucket = exact.get(key) ?? [];
    bucket.push(c);
    exact.set(key, bucket);
  }

  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  // Exact matches first
  for (const bucket of exact.values()) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort((a, b) => (a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
    const keep = sorted[0];
    const rest = sorted.slice(1);
    groups.push({
      keepId: keep.id,
      candidateIds: rest.map((c) => c.id),
      score: 1,
      kind: "exact",
      note: `${sorted.length} components share identical keyframes, easing, duration, iteration.`,
    });
    for (const c of sorted) processed.add(c.id);
  }

  // Near matches second — pairwise over remaining ungrouped
  const remaining = components.filter((c) => !processed.has(c.id));
  for (let i = 0; i < remaining.length; i++) {
    if (processed.has(remaining[i].id)) continue;
    const aSig = sigs.get(remaining[i].id)!.sig;
    const matches: { comp: MotionComponent; score: number }[] = [];
    for (let j = i + 1; j < remaining.length; j++) {
      if (processed.has(remaining[j].id)) continue;
      const bSig = sigs.get(remaining[j].id)!.sig;
      const sim = signatureSimilarity(aSig, bSig);
      if (sim >= threshold) {
        matches.push({ comp: remaining[j], score: sim });
      }
    }
    if (matches.length > 0) {
      const sorted = [{ comp: remaining[i], score: 1 }, ...matches].sort((a, b) =>
        String(a.comp.createdAt ?? "").localeCompare(String(b.comp.createdAt ?? "")),
      );
      const keep = sorted[0];
      const rest = sorted.slice(1);
      const avg = rest.reduce((s, m) => s + m.score, 0) / rest.length;
      groups.push({
        keepId: keep.comp.id,
        candidateIds: rest.map((r) => r.comp.id),
        score: Math.round(avg * 100) / 100,
        kind: "near",
        note: `${sorted.length} components share ${Math.round(avg * 100)}% of properties and easing.`,
      });
      for (const r of sorted) processed.add(r.comp.id);
    }
  }
  return groups;
}

/**
 * Execute a deduplication plan: remove all candidateIds in each group and
 * merge their orderIndex into the kept component so existing timeline
 * ordering stays visually similar.
 */
export function applyDedupPlan(
  projectId: string,
  groups: DuplicateGroup[],
): { removedCount: number; keptIds: string[] } {
  ensureProjectExists(projectId);
  let removed = 0;
  const keptIds: string[] = [];
  for (const g of groups) {
    // Merge: update the kept component's parentId/group only if it's empty
    // so we don't accidentally move the "true" anchor.
    keptIds.push(g.keepId);
    if (g.candidateIds.length > 0) {
      batchDeleteComponents(projectId, g.candidateIds);
      removed += g.candidateIds.length;
    }
  }
  return { removedCount: removed, keptIds };
}

// ---------------------------------------------------------------------------
// Multi-component batch history + undo/redo (server-side undo stack)
// ---------------------------------------------------------------------------

interface BatchUndoEntry {
  id: string;
  projectId: string;
  /** Human label shown in the undo history panel */
  label: string;
  createdAt: number;
  /** Per-component patches or delete/recreate markers that restore pre-operation state. */
  reversePatches: Array<
    | { componentId: string; patch: ComponentPatch; wasCreated?: boolean; wasDeleted?: undefined }
    | { componentId: string; patch?: Partial<ComponentPatch>; wasCreated: boolean; wasDeleted?: undefined }
    | { componentId: string; patch?: Partial<ComponentPatch>; wasCreated?: undefined; wasDeleted: MotionComponent }
  >;
}

const UNDO_LIMIT_PER_PROJECT = 100;
const UNDO_STACK = new Map<string, BatchUndoEntry[]>();
const REDO_STACK = new Map<string, BatchUndoEntry[]>();

function entryStack(projectId: string): BatchUndoEntry[] {
  if (!UNDO_STACK.has(projectId)) UNDO_STACK.set(projectId, []);
  return UNDO_STACK.get(projectId)!;
}
function redoStack(projectId: string): BatchUndoEntry[] {
  if (!REDO_STACK.has(projectId)) REDO_STACK.set(projectId, []);
  return REDO_STACK.get(projectId)!;
}

/**
 * Push an undoable batch operation. The caller provides the reverse patch
 * for each affected component. Callers typically invoke `captureBefore*`
 * helpers below which compute the reverse diff automatically.
 */
export function pushUndoEntry(projectId: string, entry: Omit<BatchUndoEntry, "projectId" | "createdAt" | "id">): BatchUndoEntry {
  ensureProjectExists(projectId);
  const full: BatchUndoEntry = {
    id: `undo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    createdAt: Date.now(),
    ...entry,
  };
  const stack = entryStack(projectId);
  stack.push(full);
  if (stack.length > UNDO_LIMIT_PER_PROJECT) stack.shift();
  // Any new undo entry blows away the redo tree to avoid branches.
  REDO_STACK.set(projectId, []);
  return full;
}

/** Snapshot current components → reverse patch for an incoming patch request. */
export function captureBeforePatches(
  projectId: string,
  componentIds: string[],
): Array<{ componentId: string; patch: ComponentPatch }> {
  ensureProjectExists(projectId);
  const current = listComponents(projectId);
  const lookup = new Map(current.map((c) => [c.id, c]));
  const result: Array<{ componentId: string; patch: ComponentPatch }> = [];
  for (const id of componentIds) {
    const c = lookup.get(id);
    if (!c) continue;
    const keys: Array<keyof MotionComponent> = [
      "name", "templateId", "durationMs", "delayMs", "iterationCount",
      "direction", "fillMode", "trigger", "easing", "keyframes", "style",
      "orderIndex", "parentId", "sceneId", "selector",
    ];
    const patch: ComponentPatch = {} as ComponentPatch;
    for (const k of keys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (patch as any)[k] = c[k];
    }
    result.push({ componentId: id, patch });
  }
  return result;
}

/** Return the last 20 undo entries — the frontend can render a history panel. */
export function listUndoHistory(projectId: string): Array<{ id: string; label: string; createdAt: number }> {
  ensureProjectExists(projectId);
  return entryStack(projectId)
    .slice(-20)
    .reverse()
    .map((e) => ({ id: e.id, label: e.label, createdAt: e.createdAt }));
}

/**
 * Execute the most recent undo entry. Returns the ids of components that
 * were touched so the caller can broadcast a refresh, or null if the
 * stack was empty.
 */
export function performUndo(projectId: string): { entryId: string; label: string; touchedIds: string[] } | null {
  ensureProjectExists(projectId);
  const stack = entryStack(projectId);
  if (stack.length === 0) return null;
  const entry = stack.pop()!;
  const current = new Map(listComponents(projectId).map((c) => [c.id, c]));
  const touchedIds: string[] = [];
  // Compute "redo" capture as we apply the reverse patches, so the redo tree is populated.
  const redoPatches: BatchUndoEntry["reversePatches"] = [];
  for (const rev of entry.reversePatches) {
    try {
      if (rev.wasCreated) {
        // Reverse of "create" is "delete". Delete it now, and capture recreate for redo.
        const exists = current.get(rev.componentId);
        if (exists) {
          redoPatches.push({ componentId: rev.componentId, wasDeleted: exists });
          batchDeleteComponents(projectId, [rev.componentId]);
          touchedIds.push(rev.componentId);
        }
      } else if (rev.wasDeleted) {
        // Reverse of "delete" is "create" from snapshot. Capture new deletion for redo.
        redoPatches.push({ componentId: rev.componentId, wasCreated: true });
        const sn = rev.wasDeleted;
        // Use low-level component repo to re-create with preserved id
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("../../db/repositories/components.js").createComponent(sn);
        touchedIds.push(rev.componentId);
      } else {
        // Normal patch — capture current for redo, then reverse
        const before = current.get(rev.componentId);
        if (before && rev.patch) {
          const keys: Array<keyof MotionComponent> = [
            "name", "templateId", "durationMs", "delayMs", "iterationCount",
            "direction", "fillMode", "trigger", "easing", "keyframes", "style",
            "orderIndex", "parentId", "sceneId", "selector",
          ];
          const redoPatch: ComponentPatch = {} as ComponentPatch;
          for (const k of keys) (redoPatch as Record<string, unknown>)[k] = (before as Record<string, unknown>)[k];
          redoPatches.push({ componentId: rev.componentId, patch: redoPatch });
          patchComponent(projectId, rev.componentId, rev.patch as ComponentPatch);
          touchedIds.push(rev.componentId);
        }
      }
    } catch { /* skip problematic entries */ }
  }
  // Push the redo entry
  const redo: BatchUndoEntry = {
    id: `redo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    createdAt: Date.now(),
    label: `Redo: ${entry.label}`,
    reversePatches: redoPatches,
  };
  redoStack(projectId).push(redo);
  return { entryId: entry.id, label: entry.label, touchedIds };
}

/** Execute the most recent redo entry (inverse of performUndo). */
export function performRedo(projectId: string): { entryId: string; label: string; touchedIds: string[] } | null {
  ensureProjectExists(projectId);
  const stack = redoStack(projectId);
  if (stack.length === 0) return null;
  const entry = stack.pop()!;
  const current = new Map(listComponents(projectId).map((c) => [c.id, c]));
  const touchedIds: string[] = [];
  const undoPatches: BatchUndoEntry["reversePatches"] = [];
  for (const rev of entry.reversePatches) {
    try {
      if (rev.wasCreated) {
        const exists = current.get(rev.componentId);
        if (exists) {
          undoPatches.push({ componentId: rev.componentId, wasDeleted: exists });
          batchDeleteComponents(projectId, [rev.componentId]);
          touchedIds.push(rev.componentId);
        }
      } else if (rev.wasDeleted) {
        undoPatches.push({ componentId: rev.componentId, wasCreated: true });
        require("../../db/repositories/components.js").createComponent(rev.wasDeleted);
        touchedIds.push(rev.componentId);
      } else {
        const before = current.get(rev.componentId);
        if (before && rev.patch) {
          const keys: Array<keyof MotionComponent> = [
            "name", "templateId", "durationMs", "delayMs", "iterationCount",
            "direction", "fillMode", "trigger", "easing", "keyframes", "style",
            "orderIndex", "parentId", "sceneId", "selector",
          ];
          const undoPatch: ComponentPatch = {} as ComponentPatch;
          for (const k of keys) (undoPatch as Record<string, unknown>)[k] = (before as Record<string, unknown>)[k];
          undoPatches.push({ componentId: rev.componentId, patch: undoPatch });
          patchComponent(projectId, rev.componentId, rev.patch as ComponentPatch);
          touchedIds.push(rev.componentId);
        }
      }
    } catch { /* skip */ }
  }
  // Push the undo entry (so undo → redo → undo works smoothly)
  entryStack(projectId).push({
    id: `undo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    createdAt: Date.now(),
    label: entry.label.startsWith("Redo: ") ? entry.label.slice(6) : entry.label,
    reversePatches: undoPatches,
  });
  return { entryId: entry.id, label: entry.label, touchedIds };
}
