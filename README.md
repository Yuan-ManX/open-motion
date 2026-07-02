# OpenMotion

**The AI-native motion design platform.**
**Animations that live in real web pages and videos — conversational, composable, and reusable by any AI agent.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-active%20development-orange)](#status)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

> Motion design, where your agent designs. Whether you're motion-curious or an easing expert, OpenMotion lets you stretch, bounce, and squash your ideas — then ship them as living artifacts and reusable skills.

---

## Overview

OpenMotion rethinks motion design from first principles. Instead of a timeline you stare at, you talk to a motion agent that builds, tunes, and ships animations inside the very medium where they run — HTML and video. Every template is alive the moment you select it; every component can be re-shaped in natural language; every motion you craft can be packaged as a **skill** and handed to any AI for reuse.

It is motion design as a living artifact, not a static file.

---

## Why OpenMotion

Traditional motion tools optimize for the timeline. OpenMotion optimizes for the **loop** — the cycle of intent, preview, refinement, and reuse that real product work demands. We treat an animation not as a deliverable, but as a **transferable unit of design knowledge** that flows between humans and AI.

- **Motion as code, not as a project file.** No import, no export pipeline. The animation *is* the page.
- **Conversation as the cursor.** You describe intent; the agent edits the curve, the timing, the layer.
- **Skills as the currency.** A great animation becomes a reusable primitive any AI agent can call.

---

## Features

### Polished motion in a prompt
Create pro-level animations through conversation with OpenMotion's motion agent. Use it for a single repeated move or a full multi-scene story — describe the feeling, the agent shapes the frames.

### Full command of every keyframe
When you want precision, the timeline is yours. Set every frame and property exactly, then bring in teammates to shape the final animation together. Conversational editing and keyframe control coexist — switch between them at any moment.

### Expansive creativity, precise control
Bring clarity and expression to your work. Animate loading states, hover interactions, logo reveals, transitions, scroll-driven sequences — the timeline is the limit.

- **Pre-made style primitives.** A curated style library — Fade, Rotate, Scale, Resize, Spring, Bounce, Squash & Stretch — ready to stack into your vision.
- **Physical easing studio.** Bezier curves and spring physics as first-class citizens. Autokey tracks your motion movements, then you customize each keyframe with the curve it deserves.
- **Spatial motion.** 2D transforms plus depth — combine motion with 3D transforms so objects move like they do in the real world.
- **Screen-to-screen choreography.** Every transition carries its own full timeline, with per-element timing you can shape independently.

### Build motion systems once, apply them everywhere
Motion systems let your whole team quickly add on-brand motion assets anywhere.

- **Reusable components across assets.** Systematize common moves — no need to build from scratch every time. Create modes and components that work wherever they're applied.
- **Motion tokens & variables.** Move between motion values quickly with variables and design tokens. Change a value once; every dependent motion updates.

### Per-component fine-tuning
Every animation is composed of independent components. Tune one without disturbing the rest — adjust a single element's easing, delay, or transform while the surrounding choreography stays intact.

### One-click reuse to HTML & video
A selected motion exports directly to production-ready HTML or a rendered video clip. The same artifact that runs in your browser is the artifact you ship.

- **Multi-format export.** Turn any animated frame into MP4, GIF, SVG, WebM, or clean HTML/CSS — whatever the destination demands.

### Ship animation straight to code
All animations are backed by real, production-ready code.

- **Code-native output.** Inspect the entire motion timeline and copy animation code directly into CSS, JSON, or React.
- **MCP-native agent context.** Send animation code to your agentic coding tools via the MCP server. All values — ease, timing, transforms — are preserved end to end.

### Export any motion as a skill *(signature primitive)*
This is OpenMotion's defining idea. Any animation — yours, ours, or remixed — can be packaged as a **skill**: a self-contained, AI-callable motion unit. Drop it into your agent's toolkit and it becomes a reusable capability across projects, teams, and workflows.

### Agent-native by design
OpenMotion is built to be driven by AI agents, not merely used by humans. The platform exposes motion as a first-class programmable surface — queryable, editable, and composable through natural language and structured calls alike.

---

## How It Works

```
Select  →  Run  →  Refine  →  Ship  →  Export as Skill
  │         │        │         │            │
  │         │        │         │            └─ reusable by any AI agent
  │         │        │         └─ to HTML / CSS / React / MP4 / GIF / SVG / WebM
  │         │        └─ conversation + keyframe + per-component tuning
  │         └─ alive in a real page/video instantly
  └─ pick a top-tier template or describe intent
```

The loop closes: what you ship becomes what the next agent reuses.

---

## Who It's For

- **Motion-curious developers** who want production animations without a timeline.
- **Designers** who think in intent and want an agent to execute the details.
- **AI agent builders** who need a reliable source of motion skills for their pipelines.
- **Teams** shipping animated UI, marketing pages, and video content at cadence.

---

## Architecture

OpenMotion is organized around four founding pillars:

| Pillar | Responsibility |
| --- | --- |
| **Template Library** | A curated, ever-growing set of top-tier motion templates, alive on arrival. |
| **Motion Agent** | The conversational core — translates intent into precise parameter and keyframe changes. |
| **Live Runtime** | Runs animations in real web pages and video frames; the same surface that ships. |
| **Skill Pipeline** | Packages any motion into a self-contained, AI-callable, reusable unit. |

Together they form a closed loop: *select → run → refine → ship → reuse*.

---

## Getting Started

OpenMotion is in active development. Once the first release ships, you'll be able to:

```bash
# Clone the repository
git clone https://github.com/Yuan-Man/open-motion.git
cd open-motion

# Install dependencies (instructions to follow with the first release)
# Launch the OpenMotion studio
```

Until then, watch this repository for the inaugural release.

---

## Roadmap

- [ ] **Template Library v1** — founding set of top-tier motion templates
- [ ] **Motion Agent** — conversational editing across curves, timing, and layers
- [ ] **Live Runtime** — animations alive in real web pages and video frames
- [ ] **Per-component tuning** — independent component editing without side effects
- [ ] **Code-native export** — CSS / JSON / React output from any timeline
- [ ] **Multi-format render** — MP4 / GIF / SVG / WebM export
- [ ] **MCP server** — agent-consumable motion context
- [ ] **Skill Pipeline** — package any motion as a reusable AI skill
- [ ] **Motion systems & tokens** — reusable components and variables across assets
- [ ] **Spatial motion** — 3D transforms combined with motion

---

## Contributing

OpenMotion is open source and welcomes contributions — templates, agent capabilities, runtime improvements, and skill authoring all benefit from community input.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a pull request

See [LICENSE](./LICENSE) for licensing terms. Be kind, be original, ship motion that lives.

---

## License

[MIT](./LICENSE) © 2026 Yuan-Man
