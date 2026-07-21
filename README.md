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
Create pro-level animations through conversation. Describe the feeling; the agent shapes the frames. Switch to direct keyframe control whenever you want precision — conversational editing and manual timeline control coexist.

### Professional motion graphics, in the browser
A complete motion graphics engine, without the export pipeline. Over 340 tools across 23 native systems, every primitive callable by the Agent:

- **Layer & compositing** — motion blur, null objects, trim path, repeater, echo, time remap, layer effects, advanced blending, pre-compose, alpha & transfer modes, blending groups.
- **3D camera & optics** — camera & lighting, depth of field, lens distortion, chromatic aberration, vignette, camera shake, optical flow, anamorphic flare.
- **Color & grading** — levels, curves, color balance, hue/sat, vibrance, exposure, selective color — all as native SVG filter chains.
- **Path & shape** — boolean ops, trim/merge/offset paths, pucker & bloat, twist, zig zag.
- **Time & rhythm** — time displacement, echo, sequence with transitions, time reverse, freeze frame, posterize time, time warp remapping.
- **Type animation** — range selector, text wiggler, text on path, per-character transform, text animator.
- **Effects & filters** — blur (gaussian/directional/radial), sharpen, wave warp, ripple, bulge, glow, mosaic, find edges, lens flare, four-color gradient.
- **Expressions** — live expression engine with loop, sequence, exponential scale, smoothed/wiggle keyframes, audio keyframes.
- **Paint, clone & mask** — paint stroke, clone stamp, brush settings, mask system with track mattes.
- **Data & audio** — data binding, CSV/JSON sources, data-driven charts, audio driver, audio-reactive keyframes.
- **Puppet & mesh** — pin-based skeletal deformation with mesh warp.
- **Particles & gradients** — procedural particle system, gradient fill & stroke (linear/radial/conic).
- **Tracking & stabilization** — point/camera tracking, warp stabilizer, motion path editing, auto-orient.
- **Rotoscoping & keying** — roto brush, refine edge, color key, difference matte, spill suppression, matte choker, inner/outer key.
- **Transitions** — block dissolve, card wipe, gradient/iris/linear/radial wipe, venetian blinds, CC jaws.
- **Simulation & generators** — ball action, bubbles, rainfall, snowfall, star burst, cell pattern, audio spectrum, radio waves.
- **Stylize** — cartoon, brush strokes, oil paint, watercolor, emboss, motion tile, scatter, threshold.

### AI-native motion intelligence
Six original systems that turn motion into a queryable, breedable, narratable, self-remediating medium — each callable by the Agent as a tool, each surfaced in the Intel panel.

- **Variation Engine.** Generates N variations along orthogonal axes — easing, duration, intensity, direction, origin, stagger — so the Agent can explore a design space in a single round-trip.
- **Motion DNA.** Decomposes any component into a genetic fingerprint: easing family, timing profile, transform signature, trigger semantics, intensity, and a composite signature. Two components can be compared by DNA similarity (0..1).
- **Style Transfer.** Applies the easing, timing, and intensity of a source component onto a target — preserving structure while adopting the source's motion feel.
- **Motion Critique.** Four-dimension structural analysis — Accessibility, Performance, Aesthetic, Consistency. Returns a scored report with severity-tagged findings and recommendations.
- **Motion Storytelling.** Narrative-to-motion synthesis. Seven narrative intents decomposed into a five-act Freytag pyramid — each act with its own easing, intensity, emotional tone, and transform hints.
- **Motion Lineage.** DAG-based genealogy tracker. Records parent-child relationships across operations, computes generation depth, answers ancestor/descendant/sibling queries.
- **Motion Synthesis.** DNA hybridization with four genetic strategies: blend, dominant, crossover, mutation. Each synthesized DNA carries trait attribution. Reproducible by seed.
- **Motion Auto-Fix.** One-call accessibility remediation. Detects vestibular, seizure, reduced-motion, and cognitive issues, then applies targeted fixes — capping displacement and rotation, stretching flashing below the 3Hz threshold, capping infinite loops, setting fillMode, staggering simultaneous animations, normalizing timing tiers, and unifying easing families. Returns a before/after score and a per-fix audit trail.

### Motion as a transferable unit
- **Per-component fine-tuning.** Every animation is composed of independent components. Tune one without disturbing the rest.
- **Skill pipeline.** Package any motion as a self-contained, AI-callable skill — the same primitive flows across projects, teams, and agent workflows.
- **Multi-format export.** HTML/CSS, React, JSON, MP4, GIF, WebM — the same artifact that runs in your browser is the artifact you ship.
- **MCP-native.** External agents program the runtime through the Model Context Protocol — motion as a first-class agent surface.

### Agent-native by design
OpenMotion is built to be driven by AI agents, not merely used by humans. The Agent doesn't just edit keyframes; it runs variation engines, extracts motion DNA, transfers styles, critiques structural quality, generates narrative sequences, tracks genealogy, synthesizes hybrid motion, and auto-remediates accessibility violations — all through conversational intent.


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
