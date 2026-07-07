import { InkBrush } from "./shared/InkBrush";

export function SectionDivider() {
  return (
    <div className="relative py-12 overflow-hidden">
      {/* 中心笔触线 */}
      <InkBrush className="max-w-md mx-auto" />

      {/* 朱砂落款点 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div className="w-1.5 h-1.5 rounded-full bg-cinnabar/60" />
          <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-cinnabar/30 blur-md animate-pulse" />
        </div>
      </div>

      {/* 左右飞白装饰 */}
      <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-16 h-px bg-gradient-to-r from-transparent to-paper/15" />
      <div className="absolute right-1/4 top-1/2 -translate-y-1/2 w-16 h-px bg-gradient-to-l from-transparent to-paper/15" />
    </div>
  );
}
