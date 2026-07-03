interface Props {
  onReplay: () => void;
  totalDurationMs: number;
}

export function ReplayBar({ onReplay, totalDurationMs }: Props) {
  const seconds = (totalDurationMs / 1000).toFixed(2);
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-edge bg-panel2">
      <button
        onClick={onReplay}
        className="px-3 py-1 text-xs font-medium rounded-md bg-accent hover:bg-accent2 text-white transition-colors"
      >
        Replay
      </button>
      <span className="text-xs text-gray-400 font-mono">
        {totalDurationMs > 0 ? `${seconds}s` : "—"}
      </span>
      <span className="text-xs text-gray-600 ml-auto">Shift+R to replay in standalone preview</span>
    </div>
  );
}
