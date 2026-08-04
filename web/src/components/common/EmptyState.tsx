// Shared empty-state component for inspector panels. Keeps the
// high-contrast minimalist black/white system consistent across the
// 30+ panels that previously rolled their own text-only placeholders.
// Usage:
//   <EmptyState icon="◇" title="No captures yet" hint="Record a cursor path to begin." />

interface EmptyStateProps {
  /** Single glyph or short symbol — keeps the visual language compact. */
  icon?: string;
  /** One-line headline, e.g. "No layers yet". */
  title: string;
  /** Supporting line that guides the next action. */
  hint?: string;
  /** Optional call-to-action rendered as a chip. */
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, hint, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-10 select-none">
      {icon && (
        <div
          className="w-9 h-9 mb-3 rounded-lg border border-edge flex items-center justify-center text-gray-600 text-base"
          aria-hidden
        >
          {icon}
        </div>
      )}
      <p className="text-xs text-gray-400 font-medium">{title}</p>
      {hint && <p className="text-[10px] text-gray-600 mt-1 max-w-[220px] leading-relaxed">{hint}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-3 text-[10px] px-2.5 py-1 rounded-full bg-panel2 border border-edge text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
