import { create } from "zustand";
import type { HealthResponse } from "@openmotion/shared";

export interface SmartGuide {
  axis: "x" | "y";
  position: number;
  length: number;
  start: number;
}

interface UiState {
  selectedComponentId: string | null;
  exportOpen: boolean;
  templatesOpen: boolean;
  skillsOpen: boolean;
  shortcutsOpen: boolean;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  health: HealthResponse | null;
  replayTrigger: number;
  hiddenIds: Set<string>;
  canvasSize: { width: number; height: number };
  playbackSpeed: number;
  chatWidth: number;
  rightPanelTab: "layers" | "inspector" | "effects" | "templates" | "skills" | "states" | "memory" | "versions" | "graph" | "code" | "shader" | "recipe" | "brand" | "capture" | "export" | "lineage" | "a11y" | "perf" | "storyboard" | "health" | "variants" | "sequencer" | "sandbox" | "intelligence" | "storytelling" | "adaptive";
  rightPanelCategory: "design" | "motion" | "intel" | "assets" | "output";
  onionSkin: { enabled: boolean; frames: number; opacity: number };
  previewOpen: boolean;
  scrubTime: number | null;
  canvasPan: { x: number; y: number };
  canvasZoom: number;
  spaceHeld: boolean;
  lockedIds: Set<string>;
  selectedIds: Set<string>;
  playbackRange: { startMs: number; endMs: number } | null;
  snapToGrid: boolean;
  snapSize: number;
  showRulers: boolean;
  smartGuides: SmartGuide[];
  marqueeRect: { x: number; y: number; w: number; h: number } | null;
  contextMenu: { x: number; y: number; componentId: string | null } | null;
  autoKeyframe: boolean;
  playheadMs: number;
  showMotionPaths: boolean;
  showPerformanceMonitor: boolean;
  timelineCommand: { action: string; nonce: number } | null;
  soloedId: string | null;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  rightPanelCollapsed: boolean;
  isPlaying: boolean;
  /** Custom track display order — overrides default delayMs sort when non-empty. */
  trackOrder: string[];
  /** Counter incremented each time the canvas should auto-fit (e.g., after a generation). */
  fitToScreenTrigger: number;

  selectComponent: (id: string | null) => void;
  setExportOpen: (open: boolean) => void;
  setTemplatesOpen: (open: boolean) => void;
  setSkillsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setHealth: (h: HealthResponse | null) => void;
  triggerReplay: () => void;
  toggleHidden: (id: string) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  setPlaybackSpeed: (speed: number) => void;
  setChatWidth: (w: number) => void;
  setRightPanelTab: (tab: "layers" | "inspector" | "effects" | "templates" | "skills" | "states" | "memory" | "versions" | "graph" | "code" | "shader" | "recipe" | "brand" | "capture" | "export" | "lineage" | "a11y" | "perf" | "storyboard" | "health" | "variants" | "sequencer" | "sandbox" | "intelligence" | "storytelling" | "adaptive") => void;
  setRightPanelCategory: (category: "design" | "motion" | "intel" | "assets" | "output") => void;
  setOnionSkin: (patch: Partial<UiState["onionSkin"]>) => void;
  setPreviewOpen: (open: boolean) => void;
  setScrubTime: (t: number | null) => void;
  setCanvasPan: (pan: { x: number; y: number }) => void;
  setCanvasZoom: (zoom: number) => void;
  resetCanvasView: () => void;
  setSpaceHeld: (held: boolean) => void;
  toggleLock: (id: string) => void;
  setLock: (id: string, locked: boolean) => void;
  addToSelection: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setSelectedIds: (ids: string[]) => void;
  setPlaybackRange: (range: { startMs: number; endMs: number } | null) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setSnapSize: (size: number) => void;
  setShowRulers: (show: boolean) => void;
  setSmartGuides: (guides: SmartGuide[]) => void;
  setMarqueeRect: (rect: { x: number; y: number; w: number; h: number } | null) => void;
  setContextMenu: (menu: { x: number; y: number; componentId: string | null } | null) => void;
  setAutoKeyframe: (enabled: boolean) => void;
  setPlayheadMs: (ms: number) => void;
  setShowMotionPaths: (show: boolean) => void;
  setShowPerformanceMonitor: (show: boolean) => void;
  setTimelineCommand: (action: string) => void;
  setSoloedId: (id: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setTrackOrder: (order: string[]) => void;
  triggerFitToScreen: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  selectedComponentId: null,
  exportOpen: false,
  templatesOpen: false,
  skillsOpen: false,
  shortcutsOpen: false,
  commandPaletteOpen: false,
  settingsOpen: false,
  health: null,
  replayTrigger: 0,
  hiddenIds: new Set<string>(),
  canvasSize: { width: 640, height: 360 },
  playbackSpeed: 1,
  chatWidth: 380,
  rightPanelTab: "layers",
  rightPanelCategory: "design",
  onionSkin: { enabled: false, frames: 3, opacity: 0.25 },
  previewOpen: false,
  scrubTime: null,

  canvasPan: { x: 0, y: 0 },
  canvasZoom: 1,
  spaceHeld: false,
  lockedIds: new Set<string>(),
  selectedIds: new Set<string>(),
  playbackRange: null,
  snapToGrid: false,
  snapSize: 8,
  showRulers: false,
  smartGuides: [],
  marqueeRect: null,
  contextMenu: null,
  autoKeyframe: false,
  playheadMs: 0,
  showMotionPaths: false,
  showPerformanceMonitor: false,
  timelineCommand: null,
  soloedId: null,
  sidebarCollapsed: true,
  sidebarWidth: 260,
  rightPanelCollapsed: false,
  isPlaying: false,
  trackOrder: [],
  fitToScreenTrigger: 0,

  selectComponent: (id) => set({ selectedComponentId: id, selectedIds: id ? new Set([id]) : new Set() }),
  setExportOpen: (open) => set({ exportOpen: open }),
  setTemplatesOpen: (open) => set({ templatesOpen: open }),
  setSkillsOpen: (open) => set({ skillsOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setHealth: (h) => set({ health: h }),
  triggerReplay: () => set((s) => ({ replayTrigger: s.replayTrigger + 1 })),
  toggleHidden: (id) => {
    const next = new Set(get().hiddenIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ hiddenIds: next });
  },
  setCanvasSize: (size) => set({ canvasSize: size }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setChatWidth: (w) => set({ chatWidth: Math.max(280, Math.min(560, w)) }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setRightPanelCategory: (category) => set({ rightPanelCategory: category }),
  setOnionSkin: (patch) => set((s) => ({ onionSkin: { ...s.onionSkin, ...patch } })),
  setPreviewOpen: (open) => set({ previewOpen: open }),
  setScrubTime: (t) => set({ scrubTime: t }),
  setCanvasPan: (pan) => set({ canvasPan: pan }),
  setCanvasZoom: (zoom) => set({ canvasZoom: Math.max(0.1, Math.min(5, zoom)) }),
  resetCanvasView: () => set({ canvasPan: { x: 0, y: 0 }, canvasZoom: 1 }),
  setSpaceHeld: (held) => set({ spaceHeld: held }),
  toggleLock: (id) => {
    const next = new Set(get().lockedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ lockedIds: next });
  },
  setLock: (id, locked) => {
    const next = new Set(get().lockedIds);
    if (locked) next.add(id);
    else next.delete(id);
    set({ lockedIds: next });
  },
  addToSelection: (id) => {
    const next = new Set(get().selectedIds);
    next.add(id);
    set({ selectedIds: next, selectedComponentId: id });
  },
  toggleSelection: (id) => {
    const next = new Set(get().selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedIds: next, selectedComponentId: id });
  },
  clearSelection: () => set({ selectedComponentId: null, selectedIds: new Set() }),
  setSelectedIds: (ids) => set({ selectedIds: new Set(ids), selectedComponentId: ids.length > 0 ? ids[ids.length - 1] : null }),
  setPlaybackRange: (range) => set({ playbackRange: range }),
  setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
  setSnapSize: (size) => set({ snapSize: size }),
  setShowRulers: (show) => set({ showRulers: show }),
  setSmartGuides: (guides) => set({ smartGuides: guides }),
  setMarqueeRect: (rect) => set({ marqueeRect: rect }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setAutoKeyframe: (enabled) => set({ autoKeyframe: enabled }),
  setPlayheadMs: (ms) => set({ playheadMs: ms }),
  setShowMotionPaths: (show) => set({ showMotionPaths: show }),
  setShowPerformanceMonitor: (show) => set({ showPerformanceMonitor: show }),
  setTimelineCommand: (action) => set((s) => ({ timelineCommand: { action, nonce: (s.timelineCommand?.nonce ?? 0) + 1 } })),
  setSoloedId: (id) => set({ soloedId: id }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(200, Math.min(400, w)) }),
  setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setTrackOrder: (order) => set({ trackOrder: order }),
  triggerFitToScreen: () => set((s) => ({ fitToScreenTrigger: s.fitToScreenTrigger + 1 })),
}));
