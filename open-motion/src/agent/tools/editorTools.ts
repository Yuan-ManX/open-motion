import type { ToolName } from "@openmotion/shared";
import { getProject, updateProject } from "../../db/repositories/projects.js";
import type { ToolContext, ToolResult } from "./registry.js";

type EditorCommand = { command: string; args: Record<string, unknown> };
type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

/** Build a ToolResult that emits a single editor command to the frontend. */
function emit(command: string, args: Record<string, unknown>, summary: string): ToolResult {
  return {
    ok: true,
    summary,
    specChanged: false,
    editorCommands: [{ command, args }],
  };
}

/** Build a ToolResult that emits multiple editor commands in sequence. */
function emitMany(commands: EditorCommand[], summary: string): ToolResult {
  return {
    ok: true,
    summary,
    specChanged: false,
    editorCommands: commands,
  };
}

/**
 * Editor control tool executors. Each executor returns a ToolResult whose
 * `editorCommands` field carries UI directives the orchestrator forwards to
 * the frontend as `editor_command` SSE events. The frontend dispatches these
 * to the corresponding uiStore / projectStore actions.
 *
 * These tools do not mutate the MotionSpec themselves; they only drive the
 * editor UI. Tools that also persist state (e.g. editor_set_artboard) update
 * the spec and emit a command so the canvas reflects the change immediately.
 */
export const editorExecutors: Partial<Record<ToolName, Executor>> = {
  editor_zoom_canvas: (args) => {
    const zoom = Number(args.zoom);
    return emit("setCanvasZoom", { zoom }, `Canvas zoom set to ${zoom}x`);
  },

  editor_pan_canvas: (args) => {
    const x = Number(args.x);
    const y = Number(args.y);
    return emit("setCanvasPan", { x, y }, `Canvas panned to (${x}, ${y})`);
  },

  editor_fit_to_screen: () => {
    return emit("fitToScreen", {}, "Canvas fit to screen");
  },

  editor_reset_view: () => {
    return emitMany(
      [
        { command: "setCanvasZoom", args: { zoom: 1 } },
        { command: "setCanvasPan", args: { x: 0, y: 0 } },
      ],
      "Canvas view reset to 100% at origin",
    );
  },

  editor_set_playhead: (args) => {
    const timeMs = Number(args.timeMs);
    return emit("setPlayheadMs", { timeMs }, `Playhead moved to ${timeMs}ms`);
  },

  editor_set_playback_speed: (args) => {
    const speed = Number(args.speed);
    return emit("setPlaybackSpeed", { speed }, `Playback speed set to ${speed}x`);
  },

  editor_play: () => {
    return emit("setPlaying", { playing: true }, "Playback started");
  },

  editor_pause: () => {
    return emit("setPlaying", { playing: false }, "Playback paused");
  },

  editor_toggle_rulers: (args) => {
    const hasExplicit = typeof args.enabled === "boolean";
    if (hasExplicit) {
      const enabled = Boolean(args.enabled);
      return emit("setShowRulers", { show: enabled }, `Rulers ${enabled ? "shown" : "hidden"}`);
    }
    return emit("toggleRulers", {}, "Rulers toggled");
  },

  editor_toggle_snap: (args) => {
    const hasExplicit = typeof args.enabled === "boolean";
    const gridSize = args.gridSize !== undefined ? Number(args.gridSize) : undefined;
    const summaryParts: string[] = [];
    const commands: EditorCommand[] = [];
    if (hasExplicit) {
      const enabled = Boolean(args.enabled);
      commands.push({ command: "setSnapToGrid", args: { enabled } });
      summaryParts.push(`Snap ${enabled ? "enabled" : "disabled"}`);
    } else {
      commands.push({ command: "toggleSnap", args: {} });
      summaryParts.push("Snap toggled");
    }
    if (gridSize !== undefined) {
      commands.push({ command: "setGridSize", args: { size: gridSize } });
      summaryParts.push(`grid ${gridSize}px`);
    }
    return emitMany(commands, summaryParts.join(", "));
  },

  editor_toggle_auto_keyframe: (args) => {
    const hasExplicit = typeof args.enabled === "boolean";
    if (hasExplicit) {
      const enabled = Boolean(args.enabled);
      return emit("setAutoKeyframe", { enabled }, `Auto-keyframe ${enabled ? "on" : "off"}`);
    }
    return emit("toggleAutoKeyframe", {}, "Auto-keyframe toggled");
  },

  editor_toggle_onion_skin: (args) => {
    const hasExplicit = typeof args.enabled === "boolean";
    const frames = args.frames !== undefined ? Number(args.frames) : undefined;
    const opacity = args.opacity !== undefined ? Number(args.opacity) : undefined;
    const summaryParts: string[] = [];
    const commands: EditorCommand[] = [];
    if (hasExplicit) {
      const enabled = Boolean(args.enabled);
      commands.push({ command: "setOnionSkin", args: { enabled } });
      summaryParts.push(`Onion skin ${enabled ? "on" : "off"}`);
    } else {
      commands.push({ command: "toggleOnionSkin", args: {} });
      summaryParts.push("Onion skin toggled");
    }
    if (frames !== undefined) {
      commands.push({ command: "setOnionSkinFrames", args: { count: frames } });
      summaryParts.push(`${frames} frames`);
    }
    if (opacity !== undefined) {
      commands.push({ command: "setOnionSkinOpacity", args: { opacity } });
      summaryParts.push(`opacity ${opacity}`);
    }
    return emitMany(commands, summaryParts.join(", "));
  },

  editor_select_component: (args) => {
    const componentId = String(args.componentId);
    const additive = Boolean(args.additive);
    if (additive) {
      return emit("addToSelection", { componentId }, `Added "${componentId}" to selection`);
    }
    return emit("selectComponent", { componentId }, `Selected "${componentId}"`);
  },

  editor_select_components: (args) => {
    const componentIds = Array.isArray(args.componentIds)
      ? args.componentIds.map(String)
      : [String(args.componentIds)];
    const clearFirst = args.clearFirst !== undefined ? Boolean(args.clearFirst) : true;
    return emit(
      "setSelectedIds",
      { ids: componentIds, clearFirst },
      `Selected ${componentIds.length} component(s)`,
    );
  },

  editor_clear_selection: () => {
    return emit("clearSelection", {}, "Selection cleared");
  },

  editor_toggle_visibility: (args) => {
    const componentId = String(args.componentId);
    return emit("toggleHidden", { componentId }, `Visibility toggled for "${componentId}"`);
  },

  editor_toggle_lock: (args) => {
    const componentId = String(args.componentId);
    const hasExplicit = typeof args.locked === "boolean";
    if (hasExplicit) {
      const locked = Boolean(args.locked);
      return emit("setLock", { componentId, locked }, `"${componentId}" ${locked ? "locked" : "unlocked"}`);
    }
    return emit("toggleLock", { componentId }, `Lock toggled for "${componentId}"`);
  },

  editor_set_panel: (args) => {
    const category = String(args.category);
    const tab = args.tab !== undefined ? String(args.tab) : undefined;
    const commands: EditorCommand[] = [{ command: "setRightPanelCategory", args: { category } }];
    if (tab) {
      commands.push({ command: "setRightPanelTab", args: { tab } });
    }
    const summary = tab
      ? `Panel switched to ${category} / ${tab}`
      : `Panel switched to ${category} group`;
    return emitMany(commands, summary);
  },

  editor_toggle_panel: (args) => {
    const hasExplicit = typeof args.collapsed === "boolean";
    if (hasExplicit) {
      const collapsed = Boolean(args.collapsed);
      return emit(
        "setRightPanelCollapsed",
        { collapsed },
        `Right panel ${collapsed ? "collapsed" : "expanded"}`,
      );
    }
    return emit("toggleRightPanel", {}, "Right panel toggled");
  },

  editor_open_overlay: (args) => {
    const overlay = String(args.overlay);
    const hasExplicit = typeof args.open === "boolean";
    const open = hasExplicit ? Boolean(args.open) : true;
    const commandMap: Record<string, string> = {
      preview: "setPreviewOpen",
      export: "setExportOpen",
      templates: "setTemplatesOpen",
      settings: "setSettingsOpen",
      command_palette: "setCommandPaletteOpen",
    };
    const command = commandMap[overlay] ?? "setPreviewOpen";
    return emit(command, { open }, `${overlay} overlay ${open ? "opened" : "closed"}`);
  },

  editor_undo: () => {
    return emit("undo", {}, "Undo applied");
  },

  editor_redo: () => {
    return emit("redo", {}, "Redo applied");
  },

  editor_set_artboard: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) {
      return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    }
    const tokens: Record<string, string | number> = { ...(project.tokens ?? {}) };
    const parts: string[] = [];
    let width = 0;
    let height = 0;
    let background = "";
    if (args.width !== undefined) {
      width = Number(args.width);
      tokens.artboardWidth = width;
      parts.push(`width=${width}`);
    } else {
      width = Number(tokens.artboardWidth) || 0;
    }
    if (args.height !== undefined) {
      height = Number(args.height);
      tokens.artboardHeight = height;
      parts.push(`height=${height}`);
    } else {
      height = Number(tokens.artboardHeight) || 0;
    }
    if (args.background !== undefined) {
      background = String(args.background);
      tokens.artboardBackground = background;
      parts.push(`background=${background}`);
    } else {
      background = String(tokens.artboardBackground ?? "");
    }
    updateProject(ctx.projectId, { tokens });
    return {
      ok: true,
      summary: `Artboard set to ${parts.join(", ")}`,
      specChanged: true,
      editorCommands: [
        { command: "setArtboard", args: { width, height, background } },
      ],
    };
  },

  editor_trigger_replay: () => {
    return emit("triggerReplay", {}, "Animation replay triggered");
  },

  editor_toggle_motion_paths: (args) => {
    const hasExplicit = typeof args.enabled === "boolean";
    if (hasExplicit) {
      const enabled = Boolean(args.enabled);
      return emit("setShowMotionPaths", { show: enabled }, `Motion paths ${enabled ? "shown" : "hidden"}`);
    }
    return emit("toggleMotionPaths", {}, "Motion paths toggled");
  },

  editor_toggle_performance_monitor: (args) => {
    const hasExplicit = typeof args.enabled === "boolean";
    if (hasExplicit) {
      const enabled = Boolean(args.enabled);
      return emit("setShowPerformanceMonitor", { show: enabled }, `Performance monitor ${enabled ? "shown" : "hidden"}`);
    }
    return emit("togglePerformanceMonitor", {}, "Performance monitor toggled");
  },

  editor_set_solo: (args) => {
    const componentId = args.componentId ? String(args.componentId) : null;
    return emit("setSoloedId", { id: componentId }, componentId ? `Soloed "${componentId}"` : "Solo cleared");
  },

  editor_toggle_sidebar: (args) => {
    const hasExplicit = typeof args.collapsed === "boolean";
    if (hasExplicit) {
      const collapsed = Boolean(args.collapsed);
      return emit("setSidebarCollapsed", { collapsed }, `Sidebar ${collapsed ? "collapsed" : "expanded"}`);
    }
    return emit("toggleSidebar", {}, "Sidebar toggled");
  },

  editor_timeline_command: (args) => {
    const action = String(args.action);
    return emit("setTimelineCommand", { action }, `Timeline command: ${action}`);
  },

  editor_toggle_selection: (args) => {
    const componentId = String(args.componentId);
    return emit("toggleSelection", { componentId }, `Selection toggled for "${componentId}"`);
  },

  editor_open_skills: (args) => {
    const hasExplicit = typeof args.open === "boolean";
    const open = hasExplicit ? Boolean(args.open) : true;
    return emit("setSkillsOpen", { open }, `Skills panel ${open ? "opened" : "closed"}`);
  },

  editor_open_shortcuts: (args) => {
    const hasExplicit = typeof args.open === "boolean";
    const open = hasExplicit ? Boolean(args.open) : true;
    return emit("setShortcutsOpen", { open }, `Shortcuts overlay ${open ? "opened" : "closed"}`);
  },

  editor_set_track_order: (args) => {
    const trackIds = Array.isArray(args.trackIds) ? args.trackIds.map(String) : [];
    return emit("setTrackOrder", { trackIds }, `Track order set to ${trackIds.length} tracks`);
  },

  editor_set_loop_region: (args) => {
    const startMs = Number(args.startMs);
    const endMs = Number(args.endMs);
    return emit("setPlaybackRange", { range: { startMs, endMs } }, `Loop region set to ${startMs}ms–${endMs}ms`);
  },

  editor_clear_loop_region: () => {
    return emit("setPlaybackRange", { range: null }, "Loop region cleared");
  },
};
