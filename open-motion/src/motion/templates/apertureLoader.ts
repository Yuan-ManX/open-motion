import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

// Aperture Loader: a camera-like iris opens in concentric blades while
// content snaps into focus at the instant of full exposure. Perfect for
// cinematic loading states that transition directly into reveal content.
export const apertureLoaderTemplate: TemplateDef = {
  id: "tpl-aperture-loader",
  name: "Aperture Loader",
  category: "load",
  description: "Iris-like aperture blades open concentrically. The instant the aperture reaches full exposure, content snaps into sharp focus with a luminous catchlight.",
  tags: ["load", "aperture", "iris", "cinematic", "camera", "blades", "reveal", "focus"],
  build: () => {
    const blades: ReturnType<typeof draft>[] = [];
    const bladeCount = 8;
    for (let i = 0; i < bladeCount; i += 1) {
      const angle = (360 / bladeCount) * i;
      const flip = i % 2 === 0 ? 1 : -1;
      blades.push(
        draft(`Iris Blade ${i + 1}`, {
          durationMs: 1400,
          easing: easingPreset("ease-in-out-cubic"),
          iterationCount: 1,
          keyframes: [
            kf(0, { rotateZ: angle, clipPath: "inset(0 0 0 0 round 0)" }),
            kf(0.6, { rotateZ: angle + 10 * flip, clipPath: "inset(28% 0 0 0 round 40% 0)" }),
            kf(1, { rotateZ: angle + 25 * flip, clipPath: "inset(50% 0 0 0 round 50% 0)" }),
          ],
          style: {
            _content: "",
            _tag: "div",
            width: "220px",
            height: "220px",
            borderRadius: "50%",
            background: `conic-gradient(from ${angle}deg, rgba(15,23,42,0.98), rgba(30,41,59,0.94), rgba(15,23,42,0.98))`,
            boxShadow: "inset 0 0 30px rgba(0,0,0,0.6)",
          },
        }),
      );
    }
    const catchlight = draft("Focus Catchlight", {
      durationMs: 1400,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, scale: 0.2, blur: 30 }),
        kf(0.62, { opacity: 0, scale: 0.7, blur: 18 }),
        kf(0.7, { opacity: 1, scale: 1.15, blur: 0 }),
        kf(1, { opacity: 0.85, scale: 1, blur: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        background: "radial-gradient(circle at 40% 38%, rgba(255,255,255,1) 0%, rgba(186,230,253,0.9) 22%, rgba(14,165,233,0.6) 55%, transparent 85%)",
        position: "absolute",
        top: "50px",
        left: "50px",
      },
    });
    return [catchlight, ...blades];
  },
};
