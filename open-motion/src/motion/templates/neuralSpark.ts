import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Neural Spark: thought-like sparks race along a path, leaving neuron trails
// before coalescing into a steady glowing marker — visualizes thinking,
// processing, or any "AI is reasoning" state.
export const neuralSparkTemplate: TemplateDef = {
  id: "tpl-neural-spark",
  name: "Neural Spark",
  category: "load",
  description: "Bright sparks race along a branching neuron-like path that progressively lights up the route, then collapses into a persistent glowing marker.",
  tags: ["load", "neural", "neuron", "spark", "thinking", "reasoning", "ai", "processing", "glow"],
  build: () => {
    // Branched S-shaped path approximated via 2 axon segments.
    const axon1 = draft("Axon Track 1", {
      durationMs: 1600,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { clipPath: "inset(0 100% 0 0)", opacity: 0.5 }),
        kf(0.4, { clipPath: "inset(0 0 0 0)", opacity: 1 }),
        kf(1, { clipPath: "inset(0 0 0 0)", opacity: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "220px",
        height: "2px",
        borderRadius: "2px",
        background: "linear-gradient(90deg, #22D3EE 0%, #8B5CF6 60%, #EC4899 100%)",
        boxShadow: "0 0 12px rgba(139,92,246,0.7)",
        position: "absolute",
        top: "60px",
        left: "0px",
        transform: "rotate(-18deg)",
        transformOrigin: "left center",
      },
    });
    const axon2 = draft("Axon Track 2", {
      durationMs: 1600,
      delayMs: 300,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { clipPath: "inset(0 100% 0 0)", opacity: 0.5 }),
        kf(0.5, { clipPath: "inset(0 0 0 0)", opacity: 1 }),
        kf(1, { clipPath: "inset(0 0 0 0)", opacity: 0.9 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "150px",
        height: "2px",
        borderRadius: "2px",
        background: "linear-gradient(90deg, #8B5CF6 0%, #22D3EE 50%, #A3E635 100%)",
        boxShadow: "0 0 10px rgba(34,211,238,0.7)",
        position: "absolute",
        top: "60px",
        left: "160px",
        transform: "rotate(38deg)",
        transformOrigin: "left center",
      },
    });

    // Racing spark (axon1)
    const spark1 = draft("Racing Spark 1", {
      durationMs: 600,
      easing: easingPreset("ease-out"),
      iterationCount: 2,
      keyframes: [
        kf(0, { translateX: "0%", opacity: 0, scale: 0.4 }),
        kf(0.1, { opacity: 1, scale: 1.1 }),
        kf(1, { translateX: "220px", opacity: 0, scale: 0.6 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(236,72,153,1) 0%, rgba(139,92,246,0.8) 45%, transparent 80%)",
        boxShadow: "0 0 16px #EC4899",
        position: "absolute",
        top: "51px",
        left: "-10px",
      },
    });

    // Coalescent node
    const node = draft("Neuron Soma", {
      durationMs: 1600,
      delayMs: 1200,
      easing: easingPreset("ease-out-cubic"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.1, blur: 20 }),
        kf(0.3, { opacity: 0.9, scale: 1.3, blur: 0 }),
        kf(0.7, { opacity: 1, scale: 0.95, blur: 0 }),
        kf(1, { opacity: 1, scale: 1, blur: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "46px",
        height: "46px",
        borderRadius: "50%",
        background: "radial-gradient(circle at 40% 40%, #FFFFFF 0%, #22D3EE 40%, #8B5CF6 80%)",
        boxShadow: "0 0 30px rgba(34,211,238,0.8), 0 0 60px rgba(139,92,246,0.5)",
        position: "absolute",
        top: "28px",
        left: "250px",
      },
    });

    // Breathing halo on the soma
    const halo = draft("Soma Halo", {
      durationMs: 1400,
      delayMs: 1500,
      easing: easingPreset("smooth"),
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        kf(0, { opacity: 0.45, scale: 1 }),
        kf(1, { opacity: 0.85, scale: 1.4 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        border: "1.5px solid rgba(139,92,246,0.55)",
        position: "absolute",
        top: "11px",
        left: "233px",
      },
    });

    return [axon1, axon2, spark1, node, halo];
  },
};
