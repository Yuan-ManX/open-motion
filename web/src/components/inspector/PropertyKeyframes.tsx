import { useMemo } from "react";
import type { Keyframe, MotionComponent } from "@openmotion/shared";

interface PropertyKeyframesProps {
  component: MotionComponent;
  /** Called when keyframes are modified. */
  onChange: (keyframes: Keyframe[]) => void;
}

/** Human-readable labels for known animation properties. */
const PROPERTY_LABELS: Record<string, string> = {
  translateX: "X Position",
  translateY: "Y Position",
  scale: "Scale",
  rotate: "Rotation",
  opacity: "Opacity",
  width: "Width",
  height: "Height",
  borderRadius: "Corner Radius",
  backgroundColor: "Background",
  color: "Color",
};

/**
 * Per-property keyframe timeline. Shows each animated property as a row
 * with diamond markers at each keyframe position. Users can click a
 * property name to toggle a keyframe at offset 0.5, or click a diamond
 * to remove that keyframe's value for the property.
 */
export function PropertyKeyframes({ component, onChange }: PropertyKeyframesProps) {
  const { properties, propertyKeyframes } = useMemo(() => {
    const propSet = new Set<string>();
    const map = new Map<string, { index: number; offset: number; value: string | number }[]>();

    component.keyframes.forEach((kf, idx) => {
      const props = kf.properties as Record<string, string | number>;
      Object.entries(props).forEach(([key, val]) => {
        propSet.add(key);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ index: idx, offset: kf.offset, value: val });
      });
    });

    return {
      properties: Array.from(propSet).sort(),
      propertyKeyframes: map,
    };
  }, [component.keyframes]);

  if (properties.length === 0) {
    return (
      <p className="text-[11px] text-gray-600">
        No animated properties. Keyframes will show property tracks here.
      </p>
    );
  }

  /** Toggle a keyframe value for a property at offset 0.5. */
  const toggleKeyframe = (prop: string) => {
    const existing = propertyKeyframes.get(prop) ?? [];
    const hasMiddle = existing.some((k) => Math.abs(k.offset - 0.5) < 0.01);

    if (hasMiddle) {
      // Remove the property from the keyframe at offset 0.5
      const next = component.keyframes.map((kf) => {
        const props = kf.properties as Record<string, string | number>;
        if (Math.abs(kf.offset - 0.5) < 0.01 && prop in props) {
          const newProps = { ...props };
          delete newProps[prop];
          return { ...kf, properties: newProps };
        }
        return kf;
      }).filter((kf) => Object.keys(kf.properties as Record<string, unknown>).length > 0);
      onChange(next);
    } else {
      // Add the property to the keyframe at offset 0.5 (or create one)
      const existingKf = component.keyframes.find((kf) => Math.abs(kf.offset - 0.5) < 0.01);
      if (existingKf) {
        const next = component.keyframes.map((kf) => {
          const props = kf.properties as Record<string, string | number>;
          return kf === existingKf
            ? { ...kf, properties: { ...props, [prop]: 0 } }
            : kf;
        });
        onChange(next);
      } else {
        const next: Keyframe[] = [
          ...component.keyframes,
          { offset: 0.5, properties: { [prop]: 0 } },
        ].sort((a, b) => a.offset - b.offset);
        onChange(next);
      }
    }
  };

  /** Remove a specific keyframe's value for a property. */
  const removeKeyframeValue = (prop: string, kfIndex: number) => {
    const next = component.keyframes.map((kf, i) => {
      const props = kf.properties as Record<string, string | number>;
      if (i === kfIndex && prop in props) {
        const newProps = { ...props };
        delete newProps[prop];
        return { ...kf, properties: newProps };
      }
      return kf;
    }).filter((kf) => Object.keys(kf.properties as Record<string, unknown>).length > 0);
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {properties.map((prop) => {
        const kfs = propertyKeyframes.get(prop) ?? [];
        const label = PROPERTY_LABELS[prop] ?? prop;
        return (
          <div key={prop} className="flex items-center gap-2 group">
            <button
              onClick={() => toggleKeyframe(prop)}
              className="w-20 text-[10px] text-gray-400 hover:text-accent truncate text-left flex items-center gap-1 flex-shrink-0"
              title={`Toggle keyframe for ${label}`}
            >
              <span className="text-gray-600">◇</span>
              <span className="truncate">{label}</span>
            </button>
            <div className="flex-1 h-5 bg-panel2 rounded relative border border-edge">
              {/* Reference line */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-edge" />
              {/* Diamond markers */}
              {kfs.map((k) => (
                <button
                  key={k.index}
                  onClick={() => removeKeyframeValue(prop, k.index)}
                  className="absolute top-1/2 w-2 h-2 bg-accent border border-white rotate-45 -translate-y-1/2 -translate-x-1/2 hover:scale-150 hover:bg-red-400 transition-transform"
                  style={{ left: `${k.offset * 100}%` }}
                  title={`${label} = ${k.value} @ ${Math.round(k.offset * 100)}% — click to remove`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
