/**
 * Intent classification and alias resolution for the agent.
 * Centralizes the mapping from natural-language terms to concrete template IDs
 * and preset names so the mock provider and system prompt stay in sync.
 */

export type IntentType =
  | "tune"
  | "template"
  | "structure"
  | "composition"
  | "export"
  | "preset"
  | "playback"
  | "query"
  | "describe"
  | "scene"
  | "analysis"
  | "path"
  | "style"
  | "pattern"
  | "color"
  | "choreography"
  | "refine"
  | "bezier"
  | "interpolation"
  | "keyframe_edit"
  | "trigger"
  | "onion_skin"
  | "preview_fullscreen"
  | "canvas_view"
  | "lock"
  | "z_order"
  | "transform_props"
  | "align"
  | "playback_range"
  | "select"
  | "snap"
  | "shape"
  | "blend_mode"
  | "artboard"
  | "layer_opacity"
  | "rulers"
  | "nudge"
  | "clipboard"
  | "state_machine"
  | "auto_keyframe"
  | "listener"
  | "keyframe_offset"
  | "marker"
  | "reverse_keyframes"
  | "z_index"
  | "solo"
  | "hierarchy"
  | "constraint"
  | "clip"
  | "filter_effect"
  | "transform_3d"
  | "restraint"
  | "recipe"
  | "project_recipe"
  | "brand_pack"
  | "motion_profile"
  | "motion_capture"
  | "export_preset"
  | "session_lineage"
  | "accessibility"
  | "performance"
  | "storyboard"
  | "memory"
  | "skill"
  | "grammar"
  | "parse"
  | "shader"
  | "visual_context"
  | "code_synthesis"
  | "state_machine"
  | "similarity"
  | "documentation"
  | "principles"
  | "easing_synthesis"
  | "choreography"
  | "blend"
  | "interpolation"
  | "merge"
  | "emotion"
  | "rhythm"
  | "narrative"
  | "adaptive"
  | "responsive"
  | "synthesis"
  | "morph"
  | "waveform"
  | "storytelling"
  | "pacing"
  | "image"
  | "speech"
  | "video"
  | "models"
  | "unknown";

/** Friendly name -> real template ID. Single source of truth for aliasing. */
export const TEMPLATE_ALIASES: Record<string, string> = {
  fade: "tpl-fade-in",
  "fade-in": "tpl-fade-in",
  "fadein": "tpl-fade-in",
  slide: "tpl-slide-up",
  "slide-up": "tpl-slide-up",
  "slideup": "tpl-slide-up",
  bounce: "tpl-bounce-in",
  "bounce-in": "tpl-bounce-in",
  "bouncein": "tpl-bounce-in",
  scale: "tpl-scale-in",
  "scale-in": "tpl-scale-in",
  "scalein": "tpl-scale-in",
  rotate: "tpl-flip-in",
  flip: "tpl-flip-in",
  "flip-in": "tpl-flip-in",
  spin: "tpl-spin",
  spinner: "tpl-spin",
  "loading-spinner": "tpl-spin",
  loading: "tpl-spin",
  pulse: "tpl-pulse",
  spring: "tpl-spring",
  resize: "tpl-resize",
  "logo-reveal": "tpl-logo-reveal",
  logoreveal: "tpl-logo-reveal",
  logo: "tpl-logo-reveal",
  "squash-stretch": "tpl-squash-stretch",
  squashstretch: "tpl-squash-stretch",
  squash: "tpl-squash-stretch",
  "flip-card": "tpl-flip-card",
  flipcard: "tpl-flip-card",
  typewriter: "tpl-typewriter",
  "type-writer": "tpl-typewriter",
  shimmer: "tpl-shimmer",
  morph: "tpl-morph",
  notification: "tpl-notification",
  toast: "tpl-notification",
  progress: "tpl-progress",
  "progress-bar": "tpl-progress",
  progressbar: "tpl-progress",
  bar: "tpl-progress",
  ripple: "tpl-ripple",
  marquee: "tpl-marquee",
  ticker: "tpl-marquee",
  scroll: "tpl-marquee",
  "scrolling-text": "tpl-marquee",
  orbit: "tpl-orbit",
  circular: "tpl-orbit",
  "circular-motion": "tpl-orbit",
  wave: "tpl-wave",
  sine: "tpl-wave",
  oscillate: "tpl-wave",
  confetti: "tpl-confetti",
  celebration: "tpl-confetti",
  celebrate: "tpl-confetti",
  burst: "tpl-confetti",
  parallax: "tpl-parallax",
  "kinetic-text": "tpl-kinetic-text",
  kinetic: "tpl-kinetic-text",
  typography: "tpl-kinetic-text",
  "particle-burst": "tpl-particle-burst",
  particles: "tpl-particle-burst",
  "liquid-morph": "tpl-liquid-morph",
  liquid: "tpl-liquid-morph",
  blob: "tpl-liquid-morph",
  "elastic-collapse": "tpl-elastic-collapse",
  collapse: "tpl-elastic-collapse",
  aurora: "tpl-aurora",
  "northern-lights": "tpl-aurora",
  hologram: "tpl-hologram",
  "holo": "tpl-hologram",
  prismatic: "tpl-prismatic",
  prism: "tpl-prismatic",
  "spectrum": "tpl-prismatic",
  "liquid-metal": "tpl-liquid-metal",
  liquidmetal: "tpl-liquid-metal",
  mercury: "tpl-liquid-metal",
  chrome: "tpl-liquid-metal",
  "neon-flicker": "tpl-neon-flicker",
  neonflicker: "tpl-neon-flicker",
  neon: "tpl-neon-flicker",
  "neon-sign": "tpl-neon-flicker",
  "depth-card": "tpl-depth-card",
  depthcard: "tpl-depth-card",
  parallax3d: "tpl-depth-card",
  glassmorphism: "tpl-glassmorphism",
  glass: "tpl-glassmorphism",
  "frosted-glass": "tpl-glassmorphism",
  "kinetic-ribbon": "tpl-kinetic-ribbon",
  kineticribbon: "tpl-kinetic-ribbon",
  ribbon: "tpl-kinetic-ribbon",
  "magnetic-pull": "tpl-magnetic-pull",
  magneticpull: "tpl-magnetic-pull",
  magnetic: "tpl-magnetic-pull",
  magnet: "tpl-magnetic-pull",
  "scroll-reveal": "tpl-scroll-reveal",
  scrollreveal: "tpl-scroll-reveal",
  "gesture-tap": "tpl-gesture-tap",
  gesturetap: "tpl-gesture-tap",
  tap: "tpl-gesture-tap",
  "gesture-swipe": "tpl-gesture-swipe",
  gestureswipe: "tpl-gesture-swipe",
  swipe: "tpl-gesture-swipe",
  "skeleton-loader": "tpl-skeleton-loader",
  skeletonloader: "tpl-skeleton-loader",
  skeleton: "tpl-skeleton-loader",
  "page-transition": "tpl-page-transition",
  pagetransition: "tpl-page-transition",
  "micro-interaction": "tpl-micro-interaction",
  microinteraction: "tpl-micro-interaction",
  micro: "tpl-micro-interaction",
  "hover-lift": "tpl-hover-lift",
  hoverlift: "tpl-hover-lift",
  hover: "tpl-hover-lift",
  "state-transition": "tpl-state-transition",
  statetransition: "tpl-state-transition",
  "state-change": "tpl-state-transition",
  "fade-out": "tpl-fade-out",
  fadeout: "tpl-fade-out",
  "slide-out": "tpl-slide-out",
  slideout: "tpl-slide-out",
  "zoom-out": "tpl-zoom-out",
  zoomout: "tpl-zoom-out",
  "collapse-down": "tpl-collapse-down",
  collapsedown: "tpl-collapse-down",
  "dissolve-out": "tpl-dissolve-out",
  dissolveout: "tpl-dissolve-out",
  dissolve: "tpl-dissolve-out",
  "glitch": "tpl-glitch",
  "3d-reveal": "tpl-reveal-3d",
  "reveal-3d": "tpl-reveal-3d",
  "gradient-shift": "tpl-gradient-shift",
  "gradientshift": "tpl-gradient-shift",
  "elastic-scale": "tpl-elastic-scale",
  "elasticscale": "tpl-elastic-scale",
  "text-scramble": "tpl-text-scramble",
  "textscramble": "tpl-text-scramble",
  "scramble": "tpl-text-scramble",
  "data-stream": "tpl-data-stream",
  "datastream": "tpl-data-stream",
  "gravity-drop": "tpl-gravity-drop",
  "gravitydrop": "tpl-gravity-drop",
  "gravity": "tpl-gravity-drop",
  "chromatic-pulse": "tpl-chromatic-pulse",
  "chromaticpulse": "tpl-chromatic-pulse",
  "breathing-light": "tpl-breathing-light",
  "breathinglight": "tpl-breathing-light",
  "breathing": "tpl-breathing-light",
  "magnetic-ripple": "tpl-magnetic-ripple",
  "magneticripple": "tpl-magnetic-ripple",
  "counter": "tpl-counter",
  "count-up": "tpl-counter",
  "countup": "tpl-counter",
  "text-reveal": "tpl-text-reveal",
  "textreveal": "tpl-text-reveal",
  "blur-reveal": "tpl-blur-reveal",
  "blurreveal": "tpl-blur-reveal",
  "kinetic-typography": "tpl-kinetic-typography",
  "kinetictypography": "tpl-kinetic-typography",
  "split-text": "tpl-split-text",
  "splittext": "tpl-split-text",
  "mouse-parallax": "tpl-mouse-parallax",
  "mouseparallax": "tpl-mouse-parallax",
  "long-press": "tpl-long-press",
  "longpress": "tpl-long-press",
};

/** Friendly name -> preset name (used by apply_preset). */
export const PRESET_ALIASES: Record<string, string> = {
  shake: "shake",
  wiggle: "wiggle",
  float: "float",
  glow: "glow",
  heartbeat: "heartbeat",
  "heart-beat": "heartbeat",
  typewriter: "typewriter",
  "type-writer": "typewriter",
};

/**
 * Resolve a raw user-provided template name to a real template ID.
 * Returns null when no alias matches so callers can fall back gracefully.
 */
export function resolveTemplateId(raw: string): string | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "-");
  if (TEMPLATE_ALIASES[normalized]) return TEMPLATE_ALIASES[normalized];
  // Try without hyphen normalization for compound words the user may have joined.
  const joined = normalized.replace(/-/g, "");
  if (TEMPLATE_ALIASES[joined]) return TEMPLATE_ALIASES[joined];
  // If the raw input already looks like a template ID, pass it through.
  if (normalized.startsWith("tpl-")) return normalized;
  return null;
}

/** Resolve a raw preset name to a canonical preset name. */
export function resolvePresetName(raw: string): string | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "-");
  return PRESET_ALIASES[normalized] ?? null;
}

const INTENT_PATTERNS: { type: IntentType; match: RegExp }[] = [
  { type: "export", match: /\b(export|download|导出|下载)\b/i },
  { type: "describe", match: /\b(describe|what.*look|explain|dna|characterize)\b|描述|什么样/i },
  { type: "analysis", match: /\b(analyze|review|critique|quality|is this good|score|insight)\b/i },
  { type: "path", match: /\b(orbit|circle|ellipse|along.*path|trajectory|fly across|move in a)\b/i },
  { type: "style", match: /\b(playful|energetic|calm|professional|dramatic|minimal|cinematic|glassy|retro|futuristic|organic|mechanical|luxury|style.*preset|style.*project|give it a .* feel|make it .* feel)\b/i },
  { type: "pattern", match: /\b(patterns?|composition balanced|what.s missing|monoton\w*|balance|coherent)\b/i },
  { type: "color", match: /\b(harmoniz\w*|color scheme|colors work together|palette|color theory|complementary|analogous|triadic|monochrome)\b/i },
  { type: "choreography", match: /\b(choreograph|orchestrat|wave pattern|ripple effect|cascade|canon|converge|spiral|explosion|assembly|breathing|domino|scatter)\b/i },
  { type: "refine", match: /\b(snappier|smoother|more dramatic|calmer|subtler|more energetic|bouncier|softer)\b/i },
  { type: "bezier", match: /\b(custom.*easing|bezier|cubic.bezier|easing curve|control point)\b/i },
  { type: "interpolation", match: /\b(interpolation|linear.*keyframe|hold.*keyframe|step.*keyframe)\b/i },
  { type: "keyframe_edit", match: /\b(add.*keyframe|remove.*keyframe|delete.*keyframe|keyframe.*opacity|keyframe.*scale|keyframe.*position|keyframe.*offset)\b/i },
  { type: "trigger", match: /\b(trigger|on click|on hover|on scroll|on load|after delay|play on|animate on|when.*click|when.*hover|when.*scroll)\b/i },
  { type: "onion_skin", match: /\b(onion.*skins?|ghost frame|motion trail|show.*trail)/i },
  { type: "preview_fullscreen", match: /\b(fullscreen|full screen|present|present mode|preview.*full|big preview)\b/i },
  { type: "canvas_view", match: /\b(zoom\s*(in|out)|fit.*screen|frame.*select|reset.*view|pan\s*canvas|canvas.*view)\b/i },
  { type: "lock", match: /\b(lock|unlock|lock.*layer)\b/i },
  { type: "z_order", match: /\b(bring.*front|send.*back|move.*forward|move.*backward|z.?order|to.?front|to.?back)\b/i },
  { type: "transform_props", match: /\b(set.*position|set.*x\b|set.*y\b|set.*width|set.*height|set.*rotation|rotate.*deg|position.*to|resize.*to)\b/i },
  { type: "align", match: /\b(align|distribute)\s*(left|right|center|top|bottom|middle|horizontal|vertical|h|v)?\b/i },
  { type: "playback_range", match: /\b(playback.*range|set.*range|in.*point|out.*point|trim|loop.*range|clear.*range)\b/i },
  { type: "select", match: /\b(select.*all|select.*everything|multi.?select|select.*multiple)\b/i },
  { type: "snap", match: /\b(snap|snap.*grid|toggle.*snap|magnet)\b/i },
  { type: "shape", match: /\b(add.*rectangle|add.*circle|add.*text|add.*triangle|add.*star|add.*pentagon|add.*polygon|add.*line|add.*arrow|create.*shape|create.*rectangle|create.*circle|create.*triangle|create.*star|draw.*shape)\b/i },
  { type: "blend_mode", match: /\b(blend.*mode|mix.*blend|set.*blend|blend.*with|multiply|screen|overlay|darken|lighten|color.?dodge|color.?burn|hard.?light|soft.?light|difference|exclusion|luminosity)\b/i },
  { type: "artboard", match: /\b(canvas|artboard|stage.*size|set.*width|set.*height|canvas.*size|canvas.*background|artboard.*size)\b/i },
  { type: "layer_opacity", match: /\b(set.*opacity|layer.*opacity|opacity.*to|make.*transparent|make.*opaque)\b/i },
  { type: "rulers", match: /\b(ruler|toggle.*ruler|show.*ruler|hide.*ruler|guide)\b/i },
  { type: "nudge", match: /\b(nudge|move by|shift by|pixel.*move|micro.*adjust)\b|微调|移动\s*\d+\s*px/i },
  { type: "clipboard", match: /\b(copy to clipboard|paste from clipboard|clipboard|copy selection|paste here|paste a copy)\b|复制|粘贴/i },
  { type: "state_machine", match: /\b(capture.*state|apply.*state|save.*state|snapshot|state machine|add transition|list states|remove state|delete state|connect states|go to state)\b|状态机|快照/i },
  { type: "auto_keyframe", match: /\b(auto.?keyframe|auto.?key|keyframe.*mode|record.*keyframe|automatic.*keyframe)\b/i },
  { type: "listener", match: /\b(listener|event listener|on click.*trigger|on hover.*trigger|pointer.*enter|pointer.*leave|add.*listener|remove.*listener|event.*handler)\b/i },
  { type: "keyframe_offset", match: /\b(move.*keyframe|retime.*keyframe|keyframe.*offset|shift.*keyframe|change.*keyframe.*position|keyframe.*to.*\d+%)\b/i },
  { type: "marker", match: /\b(marker|bookmark|flag.*time|mark.*position|add.*mark)\b/i },
  { type: "reverse_keyframes", match: /\b(reverse.*keyframes?|play.*backward|backward.*keyframes?|flip.*keyframes?|mirror.*keyframes?|reverse.*animation)\b/i },
  { type: "z_index", match: /\b(bring.*forward|send.*backward|bring.*front|send.*back|move.*front|move.*back|z.?index|layer.*order|reorder.*layer)\b/i },
  { type: "solo", match: /\b(solo.*layer|isolate.*component|solo.*component|only.*show.*this)\b/i },
  { type: "transform_3d", match: /\b(3d|perspective|rotateX|rotateY|rotateZ|translateZ|three.?d)\b/i },
  { type: "restraint", match: /\b(too much|too many|restraint|density|overwhelm\w*|clutter\w*|visual noise|competing for attention|is this too busy)\b/i },
  { type: "recipe", match: /\b(recipe|recipes|gentle entrance|impact reveal|elastic bounce|cinematic fade|data pulse|ambient float|typewriter reveal|magnetic hover)\b/i },
  { type: "memory", match: /\b(remember this|save.*memory|recall.*memory|what did we decide|forget.*memory|persistent memory|cross.?session)\b/i },
  { type: "skill", match: /\b(generated skill|learned skill|what have you learned|auto.?generated|show.*skills)\b/i },
  { type: "grammar", match: /\b(grammar|compile.*motion|motion.*expression|fade\.in|slide\.up|bounce\.in|rotate\.cw|then.*with.*easing)\b/i },
  { type: "parse", match: /\b(parse.*motion|motion.*description|make.*bounce|make.*fade|make.*slide|natural language motion|describe.*animation|translate.*motion)\b/i },
  { type: "shader", match: /\b(shader|glitch effect|chromatic aberration|neon glow|plasma|pixelate|vignette|film grain|ripple effect|gradient shift|aurora|vortex|mesh.?gradient|dot.?orbit|dot.?grid|warp|swirl|waves|perlin|simplex|voronoi|metaballs?|pulsing.?border|smoke.?ring|god.?rays|heatmap|liquid.?metal|gem.?smoke|halftone|dithering|grain.?gradient|color.?panels|paper.?texture|fluted.?glass|water)\b/i },
  { type: "visual_context", match: /\b(visual.*context|layout.*balance|canvas.*look|composition.*review|visual.*review|spatial.*layout|visual.*balance|layout.*analysis|how.*canvas.*look|check.*layout|visual.*layout)\b/i },
  { type: "project_recipe", match: /\b(save.*as.*recipe|save.*recipe|capture.*recipe|seed.*recipe|project recipe|my recipe|list.*my recipe|delete.*recipe|remove.*recipe|apply.*project recipe)\b/i },
  { type: "brand_pack", match: /\b(brand.*pack|motion.*identity|motion.*style|apple.*like|google.*material|nintendo.*style|stripe.*style|minimal.*reserve|playful.*dynamic|cinematic.*flow|technical.*precision|seed.*brand|apply.*brand|make.*everything.*like)\b/i },
  { type: "motion_profile", match: /\b(motion.*profile|component.*role|component.*personality|hero.*element|background.*component|cta.*element|make.*hero|make.*background|set.*role|temperament|visual.*weight|suggest.*profile|apply.*profile)\b/i },
  { type: "motion_capture", match: /\b(motion.*captures?|captures?.*path|record.*cursor|cursor.*path|draw.*path|draw.*motion|trace.*motion|save.*captures?|apply.*captures?|captures?.*gesture|record.*gesture|captures?.*trajectory|seed.*captures?)/i },
  { type: "export_preset", match: /\b(export.*presets?|export.*format|export.*options?|export.*for|export.*as|export.*instagram|export.*tiktok|export.*react|export.*vue|export.*lottie|export.*email|export.*mobile|export.*web|export.*figma|export.*embed|export.*social|export.*story|export.*square|recommend.*export|best.*export|what.*format.*should|how.*should.*export)/i },
  { type: "session_lineage", match: /\b(save.*sessions?|fork.*sessions?|snapshot.*conversation|sessions?.*history|sessions?.*lineage|conversation.*tree|resume.*sessions?|continue.*sessions?|show.*sessions?|list.*sessions?|what.*conversation|lineage.*tree|how.*sessions?.*relate|what.*came.*before|delete.*sessions?|remove.*branch|remember.*branch)/i },
  { type: "accessibility", match: /\b(check.*accessibility|accessibility.*check|is.*safe|vestibular|seizure.*risk|flashing.*risk|strobing|reduced.*motion|WCAG|a11y|motion.*safety|safe.*motion|accessibility)/i },
  { type: "performance", match: /\b(check.*performance|performance.*check|frame.*budget|is.*performant|fps|jank|optimize.*performance|performance.*issue|perf.*check|render.*cost|animation.*cost)/i },
  { type: "storyboard", match: /\b(storyboard|beat|sequence.*moment|narrative.*timeline|plan.*sequence|add.*beat|create.*beat|list.*beat|reorder.*beat|export.*storyboard)/i },
  { type: "similarity", match: /\b(find.*similar|similar.*motion|what.*else.*like|search.*similar|are.*there.*other.*like|motion.*like.*this|dna.*search|similar.*dna)/i },
  { type: "documentation", match: /\b(generate.*docs?|motion.*docs?|spec.*document|documentation|document.*project|export.*spec|motion.*spec)/i },
  { type: "principles", match: /\b(animation.*principles?|motion.*principles?|disney.*principles?|12.*principles?|squash.*stretch|anticipation|follow.*through|overlapping.*action|slow.*in.*out|arcs?|secondary.*action|staging|solid.*drawing|appeal|exaggeration|check.*principles?|analyze.*principles?|apply.*principle|add.*anticipation|add.*follow.*through|add.*squash|fix.*easing.*principle)/i },
  { type: "easing_synthesis", match: /\b(synthesize.*easing|easing.*synthes|feel.*weighty|feel.*light|feel.*dramatic|feel.*playful|feather.?light|weighty.*easing|snappy.*easing|dramatic.*curve|playful.*easing|elegant.*easing|organic.*easing|mechanical.*easing|custom.*bezier|custom.*easing.*curve|make.*feel.*like)/i },
  { type: "choreography", match: /\b(cascade|call.*response|unison|counterpoint|wave.*pattern|canon.*round|stagger.*grid|ripple.*out|choreograph.*pattern|orchestrat.*pattern|multi.*component.*pattern|animate.*together|animate.*sequence|waterfall.*animation)/i },
  { type: "blend", match: /\b(blend.*motion|cross.?fade.*motion|mix.*animation|hybrid.*motion|blend.*two|blend.*component|interpolate.*motion|tween.*motion|merge.*propert|combine.*animation|layer.*motion|union.*keyframe)\b/i },
  { type: "interpolation", match: /\b(interpolat\w*|tween.*from|tween.*to|steps?\s*between|generate.*steps|intermediate.*motion|in.?between)\b/i },
  { type: "merge", match: /\b(merge.*propert|merge.*animation|combine.*keyframe|union.*animation|layer.*together|stack.*motion)\b/i },
  { type: "emotion", match: /\b(emotion|emotional|feel.*motion|how.*feel|what.*feel|convey.*emotion|mood.*impact|emotional.*impact)\b/i },
  { type: "rhythm", match: /\b(rhythm|tempo|beat|groove|cadence|pulse|syncopat|accelerando|decelerando|bpm)\b/i },
  { type: "narrative", match: /\b(narrative|story.*arc|storytelling|pacing|story.*beat|act.*structure|climax|plot|coherence)\b/i },
  { type: "adaptive", match: /\b(adapt|responsive|mobile|tablet|viewport|breakpoint|reduce.*motion|accessibility.*motion|degrade|device|performance.*tier)\b/i },
  { type: "responsive", match: /\b(responsive.*css|css.*responsive|media.*query|@media|export.*css|generate.*css)\b/i },
  { type: "synthesis", match: /\b(synthesize|generative.*pattern|heartbeat|breathing|walk.?cycle|bounce.?ball|pendulum|ocean.?wave|tremor|fidget|sway|orbit.*elliptical|shake.*violent)\b/i },
  { type: "morph", match: /\b(morph.*to|morph.*into|transition.*into|gradually.*become|transform.*into.*pattern)\b/i },
  { type: "waveform", match: /\b(sine.*wave|square.*wave|triangle.*wave|sawtooth.*wave|custom.*waveform|waveform.*animation|generate.*wave)\b/i },
  { type: "storytelling", match: /\b(story.*arc|storytelling|hero.*journey|narrative.*structure|story.*beat|genre.*template|romance.*arc|comedy.*rhythm|thriller|mystery.*unfolding|fantasy.*quest|horror.*descent|documentary.*flow)\b/i },
  { type: "pacing", match: /\b(pacing.*analysis|tempo.*curve|check.*pacing|pacing.*review|story.*rhythm|dramatic.*timing)\b/i },
  { type: "image", match: /\b(?:generate|create|draw|render|make)\s+(?:an?\s+)?(?:image|picture|visual|illustration)\b/i },
  { type: "speech", match: /\b(?:generate|read|narrate|voice|speak|say)\s+(?:this\s+)?(?:aloud|text|speech|audio)\b|\btext.to.speech\b/i },
  { type: "video", match: /\b(?:generate|create|make|produce|animate)\s+(?:a\s+)?(?:video|clip|movie|sequence|animation video)\b/i },
  { type: "models", match: /\b(?:list|show|what)\s+(?:available\s+)?(?:models?|providers?|llms?)\b/i },
  { type: "code_synthesis", match: /\b(generate.*code|synthesize.*code|write.*code|give me.*css|give me.*react|give me.*html|give me.*javascript|code.*snippet|animation.*code|css.*for.*animation|react.*component.*animation|copy.*paste.*code)\b/i },
  { type: "state_machine", match: /\b(state.*machines?|compose.*state|hover.*press|toggle.*state|loading.*flow|carousel|tab.*switch|tab.*navigation|switch.*state|trigger.*state|transition.*state|list.*state.*machines?)\b/i },
  { type: "composition", match: /\b(stagger|cascade|sequence|one by one|variant|variation|alternative)\b|错开|依次|逐个|变体/i },
  { type: "scene", match: /\b(scene|scenes)\b|场景/i },
  { type: "template", match: /\b(template|模板)\b/i },
  { type: "preset", match: /\b(shake|wiggle|float|glow|heartbeat|preset)\b/i },
  { type: "structure", match: /\b(add|create|new|remove|delete|duplicate|copy|clone|reorder|layer|element|component|scene)\b/i },
  { type: "playback", match: /\b(pause|play|stop|resume|running|paused)\b/i },
  { type: "tune", match: /\b(easing|spring|duration|delay|loop|repeat|fill|color|width|height|radius|transform|keyframe|bouncy|smooth|snappy|slower|faster|red|blue|green)\b/i },
  { type: "query", match: /\b(spec|state|current|status|list|show|browse|preview|what|suggest|ideas?)\b/i },
];

/** Classify the primary intent of a user message. */
export function classifyIntent(text: string): IntentType {
  for (const { type, match } of INTENT_PATTERNS) {
    if (match.test(text)) return type;
  }
  return "unknown";
}
