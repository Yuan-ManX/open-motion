<div align="center">

<img src="./assets/OpenMotion-Logo.png" alt="OpenMotion Logo">

# OpenMotion

### The AI-Native Motion Runtime. 🕹️

**The Open-Source Motion Runtime — a living web canvas fused with a professional motion graphics engine, transactional and programmable by design.**

**Animations that live in real web pages and videos — conversational, composable, queryable, and reusable by any AI agent.**

> Motion that runs where it ships. OpenMotion is a motion runtime: a live web-native execution surface paired with a complete motion graphics engine — motion blur, null objects, trim paths, repeaters, echoes, time remapping — with checkpoint-rollback semantics, full-text search across every entity, plan-then-execute orchestration, and an MCP-native agent surface. You stretch, bounce, and squash your ideas; the runtime keeps them alive, queryable, and reversible.


![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Stars](https://img.shields.io/github/stars/Yuan-ManX/open-motion?style=social)

#### [English](./README.md) | [中文文档](./README_CN.md)

</div>


## Overview

OpenMotion is a motion runtime — not a design tool with a preview window, but an execution surface where motion lives natively. Instead of a timeline you stare at, you program a runtime: you talk to a motion agent that builds, tunes, and ships animations inside the very medium where they run — HTML and video. Every template is alive the moment you select it; every component can be re-shaped in natural language; every motion you craft can be packaged as a **skill** and handed to any AI for reuse. Every mutation is checkpointed, every entity is searchable, every plan is reviewable and cancellable.

It is motion as a living, programmable, transactional artifact — not a static file.


## Why OpenMotion

Traditional motion tools split into two camps: web-canvas tools that stop at simple transitions, and timeline-heavy motion graphics suites that live behind export pipelines. OpenMotion closes that gap with an original architecture: a living, web-native canvas where animations run where they ship, paired with a complete motion graphics engine authored from first principles — motion blur, null objects, trim paths, repeaters, echoes, time remapping, layer effects. All of it, native to the browser, native to AI.

What makes it a **runtime** — not just a tool — is the infrastructure underneath: checkpoint-rollback semantics make every mutation reversible; FTS5 full-text search makes every project, component, message, memory, and skill queryable; plan-then-execute orchestration makes complex multi-step operations reviewable and cancellable; an MCP-native surface makes the runtime programmable by any external agent. A design tool produces files. A runtime hosts live, addressable, transactional state.

We optimize for the **loop** — the cycle of intent, preview, refinement, and reuse that real product work demands. An animation is not a deliverable; it is a **transferable unit of design knowledge** that flows between humans and AI.

- **Motion as code, not as a project file.** No import, no export pipeline. The animation *is* the page.
- **Conversation as the cursor.** You describe intent; the agent edits the curve, the timing, the layer.
- **Transactional by design.** Every spec mutation is checkpointed; rollback is O(1). The runtime never loses your work.
- **Queryable end to end.** FTS5 search spans projects, components, messages, memory, skills, generated skills, and recipes — one query, every entity.
- **Plan-then-execute.** Complex requests decompose into typed, reviewable actions with live progress and mid-flight cancel.
- **One canvas, one engine, one agent.** A living web preview fused with a professional motion graphics engine — one surface, one timeline, one agent.
- **Skills as the currency.** A great animation becomes a reusable primitive any AI agent can call.
- **MCP-native.** External agents program the runtime through the Model Context Protocol — motion as a first-class agent surface.


## Features

### Polished motion in a prompt
Create pro-level animations through conversation with OpenMotion's motion agent. Use it for a single repeated move or a full multi-scene story — describe the feeling, the agent shapes the frames.

### Full command of every keyframe
When you want precision, the timeline is yours. Set every frame and property exactly. Conversational editing and keyframe control coexist — switch between them at any moment.

### Expansive creativity, precise control
Bring clarity and expression to your work. Animate loading states, hover interactions, logo reveals, transitions — the timeline is the limit.

- **Pre-made style primitives.** A curated style library — Fade, Rotate, Scale, Resize, Spring, Bounce, Squash & Stretch — ready to stack into your vision.
- **Physical easing studio.** Bezier curves and spring physics as first-class citizens. Customize each keyframe with the curve it deserves.
- **Spatial motion.** 2D transforms plus depth — combine motion with 3D transforms so objects move like they do in the real world.
- **Screen-to-screen choreography.** Every transition carries its own full timeline, with per-element timing you can shape independently.

### Professional motion graphics, in the browser
The depth of a motion graphics engine, without the export pipeline. Every primitive is callable by the Agent as a tool — over 330 of them, organized into 22 native systems.

**Layer & compositing primitives**
- **Motion Blur.** Velocity-aware streaking with adjustable intensity and shutter angle — cinematic 180° default, long 360° streaks, or crisp 45° motion.
- **Null Objects.** Invisible controller layers that drive groups via parent-child hierarchies — organize complex rigs without painting a pixel.
- **Trim Path.** Progressive path reveals via `stroke-dasharray` / `stroke-dashoffset` — write-on strokes, line-draw logos, SVG reveals.
- **Repeater.** Duplicate a layer N times with transform offsets (x / y / rotate / scale) and opacity decay — radial, linear, or grid patterns from a single source.
- **Echo.** Motion-trail afterimages — N delayed copies with fading opacity and optional scale shrink, for tracer and tail effects.
- **Time Remap.** Per-layer playback rate — 2× speed, 0.5× slow, freeze at a specific frame, or reverse. Independent of the global timeline.
- **Layer Effects.** Drop shadow, inner shadow, outer glow, inner glow, stroke outline — all via composable CSS `box-shadow`, with hex+opacity color control.
- **Advanced Blending.** Fill opacity, per-channel blending (R/G/B), knockout groups, and `Blend If` source-range masking.
- **Pre-compose & Collapse Transformations.** Nest selected layers into a self-contained comp; collapse transformations through the nested pipeline.
- **Alpha & Transfer Modes.** Straight vs. premultiplied alpha; stencil alpha/luma and silhouette alpha/luma track mattes.
- **Blending Group.** Isolate blending within a layer group so composites resolve locally before reaching the parent stack.

**3D camera, lighting & optical systems**
- **3D Camera & Lighting.** Camera transform with depth, point/spot/ambient/directional lights, cone angles, cast shadows with opacity and blur.
- **Depth of Field.** Per-camera focus distance, aperture, and blur amount; an advanced variant with bokeh shape (hexagon, octagon, blade count) and focus-curve control.
- **Lens Distortion.** Barrel / pincushion / remove-distortion with amount and edge-weight parameters.
- **Chromatic Aberration.** Per-channel RGB split with radial or directional offset — color fringing at the edges.
- **Vignette.** Edge falloff darkening with roundness, midpoint, and feather controls.
- **Camera Shake.** Procedural handheld jitter with frequency, amplitude, and seed — reproducible across renders.
- **Optical Flow & Match Move.** Per-pixel motion vectors for motion estimation; track and apply motion to lock layers onto source footage.
- **Anamorphic Flare.** Horizontal lens flare streaks — cinematic horizontal light blooms.

**Color correction & grading**
- **Levels, Curves, Color Balance, Hue/Saturation, Vibrance, Exposure, Shadow/Highlight, Selective Color.** Full SVG `feComponentTransfer` chains — every stage rendered natively in the browser.

**Path operations & shape authoring**
- **Shape Boolean.** Union, subtract, intersect, exclude via SVG path ops with amount blending.
- **Trim Path Multiple, Merge Paths, Offset Paths, Pucker & Bloat, Twist, Zig Zag.** Author and modify vector shapes non-destructively.

**Time effects & rhythm**
- **Time Displacement, Advanced Echo, Sequence with Transition, Time Reverse, Freeze Frame, Posterize Time Advanced, Time Warp Remapping.** Variable speed curves, transitional sequencing (crossfade/dissolve/wipe/push), and frame-level rhythm control.

**Type animation system**
- **Range Selector, Text Wiggler, Text on Path, Vertical Text, Kerning, Leading, Per-Character Transform, Text Animator.** Animate text by character, word, or line — including along arbitrary paths.

**Effects & filter library**
- **Gaussian / Directional / Radial Blur, Sharpen, Wave Warp, Ripple, Bulge, Glow, Mosaic, Find Edges, Lens Flare, Four-Color Gradient.** All rendered as SVG filter chains — stackable, animatable.

**Expression engine & animation assistants**
- **Expressions, Loop Expression, Sequence Layer, Exponential Scale, Smoothed Keyframes, Wiggle Keyframes, Audio Keyframes.** A live expression engine with first-class looping, scaling, and audio-reactive assistants.

**Paint, clone & mask system**
- **Paint Stroke, Clone Stamp, Brush Settings, Reveal with Brush, Erase Stroke, Paint Animator.** Pressure-aware strokes with write-on animation, cloning, and brush-driven mask reveals.
- **Mask System & Track Matte.** Multiple masks per layer with add/subtract/intersect/difference modes; alpha and luma track mattes.

**Data-driven & audio-reactive**
- **Data Binding, Data Source Loading, Data-Driven Charts, Audio Driver, Audio-Reactive Keyframes.** Load CSV/JSON data sources, bind to chart primitives, and drive animation from audio frequency bands.

**Puppet & mesh deformation**
- **Puppet Pin & Mesh Warp.** Pin-based skeletal deformation with mesh warp for organic distortion — bend, twist, and stretch shapes organically.

**Particle system & gradient strokes**
- **Particle System.** Procedural particle emission with life, velocity, gravity, and turbulence.
- **Gradient Fill & Gradient Stroke.** Linear, radial, and conic gradients on fills and strokes with animatable stops.

**Motion tracking & stabilization**
- **Track Point, Track Camera, Warp Stabilizer, Apply Track, Edit Motion Path, Auto-Orient.** Single-point tracking, 3D camera solving, smoothness-controlled stabilization, and path-following orientation.

**Rotoscoping & keying**
- **Roto Brush.** Seed-point propagation auto-masking with detection sensitivity, smoothness, and frame range.
- **Refine Edge.** Matte edge feathering with smart radius, softness, and decontamination.
- **Color Key, Linear Color Key.** Chroma key with tolerance, edge thin, and feather; multi-color matching across RGB/hue/saturation/brightness channels.
- **Difference Matte.** Reference-frame differencing with threshold, pre-blur, and invert.
- **Spill Suppression.** Remove green/blue/red spill with luminance preservation.
- **Matte Choker.** Multi-stage choke/spread with iterations and gray-level control.
- **Inner/Outer Key.** Foreground/background isolation via inner/outer paths with feather and threshold.

**Transitions library**
- **Block Dissolve, Card Wipe, Gradient Wipe, Iris Wipe, Linear Wipe, Radial Wipe, Venetian Blinds, CC Jaws Wipe.** A full transition library — block grids, card flips, brightness-driven wipes, polygonal irises, angular sweeps, clock wipes, stripe reveals, and multi-directional jaws.

**Simulation & generators**
- **CC Ball Action, CC Bubbles, CC Rainfall, CC Snowfall, CC Star Burst.** Procedural natural phenomena — ball grids, rising bubbles, falling rain, drifting snow, and star bursts with full count/speed/wind/wobble control.
- **Cell Pattern.** 14 procedural patterns (bubbles, crystals, static plates, tubular, spotted, cracked, steel, organic, stone rock, dried up, shatter, scales, turbulent, load bubbles).
- **Audio Spectrum.** Frequency-spectrum visualizer along a path with thickness, dual colors, and analog/digital display modes.
- **Radio Waves.** Expanding wave-ring emitter with frequency, expansion, fadeout, and start/end width.

**Stylize effects**
- **Cartoon Effect.** Cel shader with edge thickness, shading steps, outline color, and edge mode (inverted/drawn/lit/outline).
- **Brush Strokes, Oil Paint, Watercolor.** Painterly rendering — brush size, angle, density; oil-paint brush scale, contrast, sharpness; watercolor edge intensity, wetness, paper type.
- **Emboss, Motion Tile, Scatter, Threshold.** Bas-relief sculpting; tiled repetition with phase/offsets; pixel displacement with grain; binarization with channel selection and optional halftone.

### Build motion systems once, apply them everywhere
Motion systems let your whole team quickly add on-brand motion assets anywhere.

- **Reusable components across assets.** Systematize common moves — no need to build from scratch every time. Create modes and components that work wherever they're applied.
- **Skill pipeline.** Package any motion as a self-contained, AI-callable skill — the same primitive flows across projects, teams, and agent workflows.

### Per-component fine-tuning
Every animation is composed of independent components. Tune one without disturbing the rest — adjust a single element's easing, delay, or transform while the surrounding choreography stays intact.

### One-click reuse to HTML & video
A selected motion exports directly to production-ready HTML or a rendered video clip. The same artifact that runs in your browser is the artifact you ship.

- **Multi-format export.** Turn any animated frame into MP4, GIF, WebM, or clean HTML/CSS — whatever the destination demands.

### Ship animation straight to code
All animations are backed by real, production-ready code.

- **Code-native output.** Inspect the entire motion timeline and copy animation code directly into CSS, JSON, or React.
- **MCP-native agent context.** Send animation code to your agentic coding tools via the MCP server. All values — ease, timing, transforms — are preserved end to end.

### Export any motion as a skill
This is OpenMotion's defining idea. Any animation — yours, ours, or remixed — can be packaged as a **skill**: a self-contained, AI-callable motion unit. Drop it into your agent's toolkit and it becomes a reusable capability across projects, teams, and workflows.

### Agent-native by design
OpenMotion is built to be driven by AI agents, not merely used by humans. The platform exposes motion as a first-class programmable surface — queryable, editable, and composable through natural language and structured calls alike.


## Getting Started

```bash
# Clone the repository
git clone https://github.com/Yuan-ManX/open-motion.git
cd open-motion

npm install

npm run dev
```


## Architecture

OpenMotion is organized around five founding pillars — four product surfaces plus the runtime infrastructure that makes them transactional, queryable, and programmable:

| Pillar | Responsibility |
| --- | --- |
| **Template Library** | A curated, ever-growing set of top-tier motion templates, alive on arrival. |
| **Motion Agent** | The conversational core — translates intent into precise parameter and keyframe changes. |
| **Live Runtime** | Runs animations in real web pages and video frames; the same surface that ships. |
| **Skill Pipeline** | Packages any motion into a self-contained, AI-callable, reusable unit. |
| **Runtime Infrastructure** | Checkpoint-rollback, FTS5 full-text search, plan-then-execute orchestration, and MCP-native agent surface — the substrate that makes motion transactional, queryable, and programmable. |

Together they form a closed loop: *select → run → refine → ship → reuse* — with every step checkpointed, searchable, and addressable by any AI agent.


## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## License

OpenMotion is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

## ⭐ Star History

If you like this project, please ⭐ star the repo. Your support helps us grow!

<p align="center">
  <a href="https://star-history.com/#Yuan-ManX/open-motion&Date">
    <img src="https://api.star-history.com/svg?repos=Yuan-ManX/open-motion&type=Date" />
  </a>
</p>
