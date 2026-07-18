import type { MotionSpec, Easing } from "@openmotion/shared";

/**
 * Structured thinking trace produced before plan generation.
 * The agent analyzes the request, evaluates constraints, considers
 * multiple approaches, and commits to one — surfacing the reasoning
 * to the user so the agent's decision process is transparent.
 */
export interface ThinkingTrace {
  text: string;
  analysis: string;
  constraints: string[];
  options: { approach: string; tradeoffs: string }[];
  chosenApproach: string;
}

interface EasingProfile {
  family: string;
  bouncy: boolean;
  smooth: boolean;
  snappy: boolean;
}

function profileEasing(easing: Easing): EasingProfile {
  if (easing.type === "preset") {
    const n = easing.name.toLowerCase();
    return {
      family: easing.name,
      bouncy: /bounce|elastic|back|spring/.test(n),
      smooth: /smooth|ease-in-out|ease-out/.test(n),
      snappy: /snappy|ease-in|linear/.test(n),
    };
  }
  if (easing.type === "spring") return { family: "spring", bouncy: true, smooth: false, snappy: false };
  return { family: "bezier", bouncy: false, smooth: true, snappy: false };
}

function countInfiniteLoops(spec: MotionSpec): number {
  return spec.components.filter((c) => c.iterationCount === "infinite").length;
}

function countSimultaneous(spec: MotionSpec): number {
  return spec.components.filter((c) => c.delayMs < 200 && c.playState === "running").length;
}

function detectEasingMonotony(spec: MotionSpec): boolean {
  if (spec.components.length < 3) return false;
  const families = new Set(spec.components.map((c) => profileEasing(c.easing).family));
  return families.size === 1;
}

/**
 * Rule-based reasoning engine. Analyzes the user message against the
 * current spec state to produce a structured thinking trace. Works
 * without an LLM so mock mode stays fully functional.
 */
export function think(userMessage: string, spec: MotionSpec): ThinkingTrace {
  const text = userMessage.toLowerCase();
  const analysis = analyzeRequest(text, spec);
  const constraints = evaluateConstraints(text, spec);
  const options = considerOptions(text, spec, constraints);
  const chosenApproach = selectApproach(text, options, spec);

  const traceText = buildTraceText(analysis, constraints, options, chosenApproach);

  return {
    text: traceText,
    analysis,
    constraints,
    options,
    chosenApproach,
  };
}

function analyzeRequest(text: string, spec: MotionSpec): string {
  const parts: string[] = [];

  if (/\b(create|make|build|add|generate|design)\b/.test(text)) {
    const hasLayer = /\b(layer|element|component)\b/.test(text);
    const hasAnimation = /\b(animation|effect|motion|transition)\b/.test(text);
    if (hasLayer || hasAnimation) {
      parts.push(`User wants to create a new ${hasAnimation ? "animation" : "layer"}.`);
    }
  }

  if (/\b(bouncy|smooth|snappy|elastic|spring|dramatic|calm|energetic|playful)\b/.test(text)) {
    const feel = text.match(/\b(bouncy|smooth|snappy|elastic|spring|dramatic|calm|energetic|playful)\b/i)?.[1];
    parts.push(`Tactile feel requested: ${feel}. This maps to an easing family change.`);
  }

  if (/\b(slower|faster|duration|quick|slow)\b/.test(text)) {
    parts.push("Timing adjustment requested — will modify duration.");
  }

  if (/\b(loop|repeat|forever)\b/.test(text)) {
    parts.push("Loop behavior requested — will set iteration count.");
  }

  if (/\b(color|red|blue|green|purple|background)\b/.test(text)) {
    parts.push("Visual style (color) change requested.");
  }

  if (/\b(stagger|cascade|choreograph|sequence|wave|ripple)\b/.test(text)) {
    parts.push(`Multi-component choreography requested across ${spec.components.length} component(s).`);
  }

  if (/\b(analyze|review|critique|quality|pattern|restraint)\b/.test(text)) {
    parts.push("Analytical request — will inspect and report on motion quality.");
  }

  if (/\b(export|download|render|package)\b/.test(text)) {
    parts.push("Export/delivery request — will produce an output artifact.");
  }

  if (/\b(shader|glitch|neon|plasma|chromatic)\b/.test(text)) {
    parts.push("Shader/visual effect requested — will apply a WebGL effect.");
  }

  if (/\b(3d|perspective|rotateX|rotateY)\b/.test(text)) {
    parts.push("3D transform requested — will apply perspective and depth.");
  }

  // Style preset requests — covers all 13 style presets.
  if (/\b(playful|energetic|calm|professional|dramatic|minimal|cinematic|glassy|retro|futuristic|organic|mechanical|luxury)\b/.test(text) && /\b(style|feel|vibe|aesthetic)\b/.test(text)) {
    const styleM = text.match(/\b(playful|energetic|calm|professional|dramatic|minimal|cinematic|glassy|retro|futuristic|organic|mechanical|luxury)\b/i);
    if (styleM) parts.push(`Style preset requested: ${styleM[1]} — will coordinate motion aesthetic across all components.`);
  }

  // Motion recipe requests — covers all 15 curated recipes.
  if (/\b(gentle entrance|impact reveal|elastic bounce|cinematic fade|data pulse|ambient float|typewriter reveal|magnetic hover|swift dismissal|graceful departure|skeleton shimmer|progress march|toast rise|bar grow|confetti burst|recipe)\b/.test(text)) {
    parts.push("Curated motion recipe requested — will apply a pre-tuned motion combination.");
  }

  // Brand pack requests — coordinated motion identity.
  if (/\b(brand.*pack|motion.*identity|make.*everything.*like)\b/.test(text)) {
    parts.push("Brand pack requested — will apply a coordinated motion identity across the project.");
  }

  // Mood intelligence — emotional character of motion.
  if (/\b(mood|emotion|feeling|vibe|premium|nostalgic|urgent|confident|gentle)\b/.test(text) && !/\b(no|not|without)\b/.test(text)) {
    parts.push("Mood/emotional character requested — will translate emotional language into motion parameters.");
  }

  // Animation principles — Disney 12 principles.
  if (/\b(squash.*stretch|anticipation|follow.*through|overlapping.*action|slow.*in.*out|arcs|secondary.*action|staging|solid.*drawing|appeal|exaggeration|principle)\b/.test(text)) {
    parts.push("Animation principle requested — will apply a Disney 12 principle to enhance motion quality.");
  }

  // Choreography patterns — covers all 11 patterns.
  if (/\b(cascade|wave|ripple|canon|converge|spiral|explosion|assembly|breathing|domino|scatter)\b/.test(text)) {
    const patternM = text.match(/\b(cascade|wave|ripple|canon|converge|spiral|explosion|assembly|breathing|domino|scatter)\b/i);
    if (patternM) parts.push(`Choreography pattern requested: ${patternM[1]} — will orchestrate multi-component sequencing.`);
  }

  // Storytelling and narrative arc.
  if (/\b(story.*arc|narrative|hero.*journey|storytelling|pacing|climax|genre.*template|romance|comedy|mystery|fantasy|horror|documentary)\b/.test(text)) {
    parts.push("Narrative/storytelling request — will align motion with story structure.");
  }

  // Adaptive and responsive motion.
  if (/\b(adapt|responsive|mobile|tablet|breakpoint|reduce.*motion|device|performance.*tier)\b/.test(text)) {
    parts.push("Adaptive/responsive request — will tune motion for target device and viewport.");
  }

  // Motion path animation.
  if (/\b(orbit|circle|ellipse|along.*path|trajectory|fly across|move in a|motion.*path)\b/.test(text)) {
    parts.push("Motion path animation requested — will animate along a custom trajectory.");
  }

  // Accessibility and safety checks.
  if (/\b(accessibility|a11y|vestibular|seizure|reduced.*motion|wcag|motion.*safety)\b/.test(text)) {
    parts.push("Accessibility/safety check requested — will analyze motion for vestibular risks.");
  }

  // Performance profiling.
  if (/\b(performance|fps|jank|frame.*budget|render.*cost|optimize.*performance)\b/.test(text)) {
    parts.push("Performance profiling requested — will analyze frame budget and render cost.");
  }

  // Storyboard beat management.
  if (/\b(beat|storyboard|narrative.*timeline|sequence.*moment)\b/.test(text)) {
    parts.push("Storyboard beat management requested — will structure the narrative timeline.");
  }

  // Version history and snapshots.
  if (/\b(save.*version|snapshot|restore.*version|rollback|version.*history)\b/.test(text)) {
    parts.push("Version history operation requested — will capture or restore a project snapshot.");
  }

  // State machine operations.
  if (/\b(state.*machine|capture.*state|apply.*state|transition.*state|compose.*state)\b/.test(text)) {
    parts.push("State machine operation requested — will manage component states and transitions.");
  }

  // Motion captures (cursor trajectory).
  if (/\b(motion.*capture|record.*cursor|cursor.*path|draw.*path|trace.*motion)\b/.test(text)) {
    parts.push("Motion capture requested — will record or apply a cursor trajectory.");
  }

  // Motion profiles (component roles).
  if (/\b(hero.*element|background.*component|cta.*element|motion.*profile|set.*role)\b/.test(text)) {
    parts.push("Motion profile assignment requested — will define the component's narrative role.");
  }

  // Generative synthesis (procedural patterns).
  if (/\b(synthesize|generative|heartbeat|breathing|walk.*cycle|bounce.*ball|pendulum|ocean.*wave|tremor|fidget|sway)\b/.test(text)) {
    parts.push("Generative motion synthesis requested — will produce procedural animation from a pattern.");
  }

  // Motion grammar compilation.
  if (/\b(grammar|compile.*motion|motion.*expression|fade\.in|slide\.up|then.*with)\b/.test(text)) {
    parts.push("Motion grammar expression requested — will compile the DSL into motion specs.");
  }

  // Visual context analysis (layout review).
  if (/\b(visual.*context|layout.*balance|composition.*review|spatial.*layout|visual.*balance)\b/.test(text)) {
    parts.push("Visual context review requested — will analyze canvas layout and composition.");
  }

  // Code synthesis.
  if (/\b(generate.*code|synthesize.*code|write.*code|css.*for|react.*component|html.*for)\b/.test(text)) {
    parts.push("Code synthesis requested — will produce standalone animation code.");
  }

  // Layer hierarchy and rigging — parent/child nesting and bone-like constraints.
  if (/\b(parent|child|nest|attach|rig|bone|hierarchy|group.*under|pin to|follow.*position|look.*at|constrain)\b/.test(text)) {
    parts.push("Layer hierarchy/rigging requested — will manage parent-child nesting or component constraints.");
  }

  // Timeline clips — named time segments for structured sequencing.
  if (/\b(clip|segment|section|time.*range|playback.*range|trim)\b/.test(text)) {
    parts.push("Timeline clip management requested — will create or manipulate named time segments.");
  }

  // Event listeners — component-level interactivity wiring.
  if (/\b(listener|on.*click|on.*hover|on.*enter|on.*leave|on.*down|on.*up|event.*handler|trigger.*action)\b/.test(text)) {
    parts.push("Event listener requested — will wire component interactivity to actions.");
  }

  // Timeline markers — labeled bookmarks for navigation.
  if (/\b(marker|bookmark|flag.*time|mark.*point|label.*time)\b/.test(text)) {
    parts.push("Timeline marker requested — will add a labeled bookmark at a specific time.");
  }

  // Blend modes — CSS mix-blend-mode for compositing.
  if (/\b(blend.*mode|multiply|screen|overlay|darken|lighten|color.?dodge|color.?burn|hard.?light|soft.?light|difference|exclusion|hue|saturation|luminosity|mix.*blend)\b/.test(text)) {
    parts.push("Blend mode requested — will set CSS mix-blend-mode for compositing.");
  }

  // Design tokens — reusable named values for consistent theming.
  if (/\b(token|design.*token|theme.*variable|named.*value|reuse.*value|tokenize)\b/.test(text)) {
    parts.push("Design token operation requested — will manage reusable named values for theming.");
  }

  // Pipelines — multi-step automated workflows.
  if (/\b(pipeline|workflow|automate.*steps|batch.*process|chain.*operations|multi.*step)\b/.test(text)) {
    parts.push("Pipeline operation requested — will manage reusable multi-step automation workflows.");
  }

  // Persistent memory — cross-session fact storage.
  if (/\b(remember|recall|persist.*fact|save.*memory|note.*preference|forget)\b/.test(text)) {
    parts.push("Persistent memory operation requested — will store or retrieve cross-session facts.");
  }

  // Canvas and viewport operations — zoom, pan, snap, rulers, onion skin.
  if (/\b(zoom|pan|fit.*screen|reset.*view|canvas.*view|snap.*grid|grid.*size|rulers|onion.*skin|ghost.*frame)\b/.test(text)) {
    parts.push("Canvas/viewport operation requested — will adjust the editing view or overlays.");
  }

  // Layer management — lock, solo, z-order, opacity.
  if (/\b(lock|unlock|solo|isolate|bring.*front|send.*back|forward|backward|z.?order|layer.*opacity)\b/.test(text)) {
    parts.push("Layer management requested — will adjust lock state, z-order, isolation, or opacity.");
  }

  // Keyframe operations — offset, reverse, interpolation, custom bezier.
  if (/\b(keyframe.*offset|retime.*keyframe|reverse.*keyframe|play.*backward|interpolation|hold|linear.*keyframe|custom.*bezier|cubic.?bezier)\b/.test(text)) {
    parts.push("Keyframe operation requested — will manipulate keyframe timing, order, or interpolation.");
  }

  // Per-property keyframes — adding/removing individual keyframes.
  if (/\b(add.*keyframe|remove.*keyframe|keyframe.*opacity|keyframe.*scale|keyframe.*rotate|keyframe.*position)\b/.test(text)) {
    parts.push("Per-property keyframe requested — will add or remove a keyframe for a specific property.");
  }

  // Triggers — controlling when animation starts.
  if (/\b(trigger|on.*load|on.*click|on.*hover|on.*scroll|after.*delay|playback.*trigger)\b/.test(text)) {
    parts.push("Trigger configuration requested — will control when the animation starts.");
  }

  // Shapes and media — adding visual elements to the canvas.
  if (/\b(rectangle|circle|triangle|star|pentagon|line|arrow|add.*shape)\b/.test(text)) {
    parts.push("Shape creation requested — will add a geometric shape to the canvas.");
  }
  if (/\b(add.*image|insert.*image|add.*video|insert.*video|add.*audio|insert.*audio|media)\b/.test(text)) {
    parts.push("Media insertion requested — will add an image, video, or audio asset.");
  }

  // Scene transitions and camera moves — cinematic staging.
  if (/\b(scene.*transition|transition.*scene|camera.*move|pan.*camera|zoom.*camera|dolly|whip.*pan)\b/.test(text)) {
    parts.push("Scene transition or camera move requested — will stage cinematic scene changes.");
  }

  // Precomp and expressions — composition grouping and procedural animation.
  if (/\b(precomp|pre.?compose|group.*layer|ungroup|expression|formula|procedural.*animation)\b/.test(text)) {
    parts.push("Precomp or expression requested — will group layers or attach a procedural formula.");
  }

  // Easing synthesis — custom curves from semantic descriptions.
  if (/\b(synthesize.*easing|feather.?light|feel.*weighty|feel.*light|custom.*feel|make.*feel.*like)\b/.test(text)) {
    parts.push("Easing synthesis requested — will generate a custom easing curve from a semantic description.");
  }

  // Creative suggestions — divergent idea generation.
  if (/\b(suggest.*creative|creative.*idea|surprise.*me|unexpected|divergent|what.*else.*could)\b/.test(text)) {
    parts.push("Creative suggestion requested — will generate divergent, exploratory motion ideas.");
  }

  // Motion DNA and template matching — description and similarity search.
  if (/\b(describe.*motion|motion.*dna|what.*look|characterize|find.*similar|similar.*motion|match.*template)\b/.test(text)) {
    parts.push("Motion DNA or similarity search requested — will analyze and match motion signatures.");
  }

  // Motion documentation — spec generation.
  if (/\b(generate.*docs?|motion.*docs?|spec.*document|documentation|document.*project)\b/.test(text)) {
    parts.push("Motion documentation requested — will generate a comprehensive spec document.");
  }

  // Variants — alternative versions of the current motion.
  if (/\b(variant|variation|alternative.*version|try.*different|what.*else)\b/.test(text)) {
    parts.push("Variant creation requested — will generate an alternative version of the current motion.");
  }

  // Multimodal generation (image, speech, video, 3D).
  if (/\b(generate.*image|draw.*image|create.*image)\b/.test(text)) {
    parts.push("Image generation requested.");
  }
  if (/\b(generate.*speech|text.to.speech|narrate|voice)\b/.test(text)) {
    parts.push("Speech generation requested.");
  }
  if (/\b(generate.*video|create.*video|animate.*video)\b/.test(text)) {
    parts.push("Video generation requested.");
  }
  if (/\b(generate.*3d|create.*model|three.?d.*model)\b/.test(text)) {
    parts.push("3D model generation requested.");
  }

  if (parts.length === 0) {
    parts.push(`Evaluating request against current project "${spec.project.name}" with ${spec.components.length} component(s).`);
  }

  parts.push(`Current state: ${spec.components.length} component(s), ${countInfiniteLoops(spec)} infinite loop(s), ${countSimultaneous(spec)} near-simultaneous start(s).`);

  return parts.join(" ");
}

function evaluateConstraints(text: string, spec: MotionSpec): string[] {
  const constraints: string[] = [];

  const infiniteLoops = countInfiniteLoops(spec);
  const simultaneous = countSimultaneous(spec);

  if (infiniteLoops >= 3 && !/\b(stop|remove.*loop|once|single)\b/.test(text)) {
    constraints.push(`Restraint budget: ${infiniteLoops} components loop infinitely — adding more motion risks visual overload.`);
  }

  if (simultaneous >= 4) {
    constraints.push(`${simultaneous} components start within 200ms — consider staggering to reduce attention competition.`);
  }

  if (detectEasingMonotony(spec) && spec.components.length >= 3) {
    constraints.push("Easing monotony detected: all components share one easing family. Varying easing improves rhythm.");
  }

  if (/\b(accessib|reduced motion|vestibular|prefers-reduced)\b/.test(text)) {
    constraints.push("Accessibility: user mentioned reduced-motion — large-scale or parallax motion should be gated.");
  }

  if (/\b(fast|quick|snappy)\b/.test(text) && spec.components.some((c) => c.durationMs < 200)) {
    constraints.push("Some durations are already under 200ms — going faster may cause jank or be imperceptible.");
  }

  if (spec.components.length === 0) {
    constraints.push("Empty project — must add a component before any tuning is possible.");
  }

  if (spec.components.length > 12) {
    constraints.push(`Dense scene (${spec.components.length} components) — restraint budget is tight.`);
  }

  // Duration uniformity: when many components share the exact same duration,
  // the rhythm feels mechanical — stagger or vary to introduce organic pacing.
  if (spec.components.length >= 3) {
    const buckets = new Set(spec.components.map((c) => Math.round(c.durationMs / 100)));
    if (buckets.size === 1) {
      constraints.push("All components share the same duration — uniform timing feels mechanical.");
    }
  }

  // Trigger uniformity: when every component triggers on load, there are no
  // interactive moments — engagement requires at least one hover/click trigger.
  if (spec.components.length >= 2 && spec.components.every((c) => c.trigger === "onLoad")) {
    constraints.push("Every component triggers on load — no interactive moments exist for the viewer.");
  }

  // Performance: large keyframe counts on many components strain the frame budget.
  const totalKeyframes = spec.components.reduce((sum, c) => sum + c.keyframes.length, 0);
  if (totalKeyframes > 60) {
    constraints.push(`Heavy keyframe density (${totalKeyframes} total) — may exceed the frame budget on low-end devices.`);
  }

  // CSS filter cost: stacking many filtered components compounds render cost.
  const filteredCount = spec.components.filter((c) => {
    const s = c.style ?? {};
    return Object.keys(s).some((k) => /^(filter|backdropFilter)$/i.test(k));
  }).length;
  if (filteredCount >= 3) {
    constraints.push(`${filteredCount} components use CSS filters — composited effects compound render cost.`);
  }

  // Accessibility: rapid loop cycles with high luminance change risk vestibular triggers.
  const riskyLoops = spec.components.filter(
    (c) => c.iterationCount === "infinite" && c.durationMs < 500,
  ).length;
  if (riskyLoops >= 2) {
    constraints.push(`${riskyLoops} fast infinite loops detected — risk of vestibular discomfort for sensitive viewers.`);
  }

  // Empty keyframes: a component without keyframes sits still and dilutes the scene.
  const staticCount = spec.components.filter((c) => c.keyframes.length === 0).length;
  if (staticCount >= 1 && spec.components.length >= 2) {
    constraints.push(`${staticCount} component(s) have no keyframes — they sit still while others move.`);
  }

  // Color palette breadth: too many distinct hues compete for attention.
  const hues = new Set(
    spec.components
      .map((c) => {
        const s = c.style ?? {};
        return (s.color as string | undefined) ?? (s.background as string | undefined);
      })
      .filter((v): v is string => typeof v === "string"),
  );
  if (hues.size >= 5) {
    constraints.push(`${hues.size} distinct hues present — palette may feel incoherent without harmonization.`);
  }

  // Storyboard gap: many components but no beats means the narrative is implicit.
  // Storyboard beats live in a separate repository; the reasoning engine can
  // only flag that narrative requests benefit from explicit beats.
  if (spec.components.length >= 4 && /\b(story|narrative|arc|pacing)\b/.test(text)) {
    constraints.push("Narrative request detected — explicit storyboard beats would make pacing easier to reason about.");
  }

  return constraints;
}

function considerOptions(text: string, spec: MotionSpec, constraints: string[]): { approach: string; tradeoffs: string }[] {
  const options: { approach: string; tradeoffs: string }[] = [];
  const hasComponents = spec.components.length > 0;

  if (/\b(bouncy|smooth|snappy|elastic|spring)\b/.test(text) && hasComponents) {
    options.push({
      approach: "Adjust easing on the first component only",
      tradeoffs: "Fast, surgical change. Other components keep their feel — may create easing inconsistency.",
    });
    if (spec.components.length > 1) {
      options.push({
        approach: "Apply easing to all components via batch_update",
        tradeoffs: "Coherent feel across the scene. Higher blast radius — affects motion the user did not mention.",
      });
    }
  }

  if (/\b(stagger|cascade|choreograph)\b/.test(text) && spec.components.length > 1) {
    options.push({
      approach: "Apply stagger with forward direction",
      tradeoffs: "Natural entrance order. Predictable but less dynamic than center-out.",
    });
    options.push({
      approach: "Apply choreograph with wave pattern",
      tradeoffs: "More organic rhythm. Slightly harder to predict timing for individual layers.",
    });
  }

  if (/\b(slower|faster|duration)\b/.test(text) && hasComponents) {
    options.push({
      approach: "Change duration on the primary component",
      tradeoffs: "Targeted timing shift. Project total duration stays as-is.",
    });
    options.push({
      approach: "Adjust global timing via set_global_timing",
      tradeoffs: "Rescales the whole project. Good for tempo changes, bad for per-element tuning.",
    });
  }

  if (/\b(export|download|render)\b/.test(text)) {
    options.push({
      approach: "Export as standalone HTML",
      tradeoffs: "Self-contained, opens in any browser. Larger file, no code reusability.",
    });
    options.push({
      approach: "Export as CSS code snippet",
      tradeoffs: "Lightweight, drops into existing projects. Requires manual integration.",
    });
    options.push({
      approach: "Export as React component",
      tradeoffs: "Framework-native for React apps. Less portable to non-React contexts.",
    });
  }

  if (constraints.some((c) => c.includes("Restraint budget")) && !/\b(remove|delete|simplif)\b/.test(text)) {
    options.push({
      approach: "Proceed with the requested addition despite restraint warning",
      tradeoffs: "Fulfills the literal request. May push the scene past healthy motion density.",
    });
    options.push({
      approach: "Suggest simplifying existing motion first",
      tradeoffs: "Keeps restraint budget healthy. Slower — requires a second conversational turn.",
    });
  }

  // Recipe vs custom build: when the user describes a known curated recipe
  // pattern, choosing the recipe is faster than assembling keyframes manually.
  if (/\b(gentle entrance|impact reveal|elastic bounce|cinematic fade|ambient float|typewriter reveal|magnetic hover|graceful departure|skeleton shimmer|toast rise|confetti burst)\b/.test(text) && hasComponents) {
    options.push({
      approach: "Apply the matching curated recipe",
      tradeoffs: "Pre-tuned combination of easing + duration + transform. Fast, idiomatic — less bespoke than a custom build.",
    });
    options.push({
      approach: "Build the motion from individual keyframes",
      tradeoffs: "Maximum control over every property. Slower — requires multiple tool calls and more turns.",
    });
  }

  // Style preset vs per-component tuning: when a style word appears, decide
  // between a coordinated preset and per-component tuning.
  if (/\b(playful|energetic|calm|professional|dramatic|minimal|cinematic|glassy|retro|futuristic|organic|mechanical|luxury)\b/.test(text) && hasComponents) {
    options.push({
      approach: "Apply the style preset across all components",
      tradeoffs: "Coordinated aesthetic in one step. Affects components the user did not mention.",
    });
    if (spec.components.length > 1) {
      options.push({
        approach: "Apply the style preset to the primary component only",
        tradeoffs: "Surgical change. Other components keep their feel — may create aesthetic inconsistency.",
      });
    }
  }

  // Accessibility vs visual richness: when the user asks for flashy motion but
  // the scene already has accessibility risk, offer a safer alternative.
  if (/\b(flash|strobing|glitch|shake|rapid|flicker)\b/.test(text) && constraints.some((c) => c.includes("vestibular"))) {
    options.push({
      approach: "Apply the requested effect with reduced intensity",
      tradeoffs: "Preserves the visual idea while lowering vestibular risk.",
    });
    options.push({
      approach: "Gate the effect behind prefers-reduced-motion",
      tradeoffs: "Honors user accessibility settings automatically. Slightly more setup.",
    });
  }

  // Export format: pick between HTML, code, and video based on intent.
  if (/\b(export|download|render)\b/.test(text)) {
    if (!options.some((o) => /HTML|CSS|React/i.test(o.approach))) {
      options.push({
        approach: "Export as standalone HTML",
        tradeoffs: "Self-contained, opens in any browser. Larger file, no code reusability.",
      });
      options.push({
        approach: "Export as React component",
        tradeoffs: "Framework-native for React apps. Less portable to non-React contexts.",
      });
    }
    if (/\b(video|mp4|gif|webm)\b/.test(text)) {
      options.push({
        approach: "Render to a video file via export_video",
        tradeoffs: "Shareable motion artifact. Requires playback — heavier than code.",
      });
    }
    if (/\b(skill|reusable|package)\b/.test(text)) {
      options.push({
        approach: "Package as a reusable skill via export_skill",
        tradeoffs: "Reusable across projects. Requires explicit skill metadata.",
      });
    }
  }

  // Adaptive motion: pick between device targeting and reduced-motion gating.
  if (/\b(adapt|responsive|mobile|tablet)\b/.test(text) && hasComponents) {
    options.push({
      approach: "Adapt for the target device and viewport",
      tradeoffs: "Tunes durations and complexity for the device class. May reduce fidelity on mobile.",
    });
    options.push({
      approach: "Gate aggressive motion behind prefers-reduced-motion only",
      tradeoffs: "Minimal change — keeps desktop fidelity, only softens for users who request it.",
    });
  }

  // Choreography: decide between forward cascade and wave/ripple alternatives.
  if (/\b(choreograph|orchestrat)\b/.test(text) && spec.components.length > 1) {
    if (!options.some((o) => /cascade|wave/i.test(o.approach))) {
      options.push({
        approach: "Apply a forward cascade choreography",
        tradeoffs: "Predictable entrance order. Natural but less dynamic than center-out.",
      });
      options.push({
        approach: "Apply a wave or ripple choreography",
        tradeoffs: "More organic rhythm. Harder to predict timing for individual layers.",
      });
    }
  }

  // Mood translation: when the user uses emotional language, decide between a
  // mood profile and manual easing synthesis.
  if (/\b(premium|playful|calm|energetic|dramatic|minimal|confident|gentle|urgent|nostalgic)\s+(mood|vibe|feel)/i.test(text) && hasComponents) {
    options.push({
      approach: "Apply the matching mood profile",
      tradeoffs: "Translates the emotional language into coordinated motion parameters in one step.",
    });
    options.push({
      approach: "Synthesize a custom easing curve from the description",
      tradeoffs: "Fine-grained control over the easing feel. Does not adjust duration or staging.",
    });
  }

  if (options.length === 0) {
    options.push({
      approach: "Execute the direct matching tool for the request",
      tradeoffs: "Minimal surface area. May miss opportunities for a more coherent result.",
    });
  }

  return options;
}

function selectApproach(text: string, options: { approach: string; tradeoffs: string }[], spec: MotionSpec): string {
  if (options.length === 0) return "Execute the direct matching tool.";

  // Prefer batch/coherent approaches when the user says "all" or "everything".
  if (/\b(all|every|each|whole|entire|project)\b/.test(text)) {
    const batch = options.find((o) => /batch|global|all components/i.test(o.approach));
    if (batch) return batch.approach;
  }

  // Prefer restraint-preserving approaches when the budget is tight.
  if (/\b(calm|subtle|minimal|gentle|soft)\b/.test(text)) {
    const gentle = options.find((o) => /simplif|stagger|wave|gentle/i.test(o.approach));
    if (gentle) return gentle.approach;
  }

  // Prefer the first option (most targeted) by default.
  return options[0].approach;
}

function buildTraceText(
  analysis: string,
  constraints: string[],
  options: { approach: string; tradeoffs: string }[],
  chosen: string,
): string {
  const lines: string[] = [];
  lines.push(`Analysis: ${analysis}`);
  if (constraints.length > 0) {
    lines.push(`Constraints: ${constraints.join(" ")}`);
  }
  if (options.length > 1) {
    lines.push(`Considered ${options.length} approaches: ${options.map((o) => o.approach).join("; ")}.`);
  }
  lines.push(`Chosen: ${chosen}.`);
  return lines.join(" ");
}
