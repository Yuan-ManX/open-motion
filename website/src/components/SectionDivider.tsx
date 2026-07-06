export function SectionDivider() {
  return (
    <div className="relative py-8 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
        <div className="h-px bg-gradient-to-r from-transparent via-edge to-transparent" />
        <div className="h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent mt-px opacity-50 blur-sm" />
      </div>

      {/* Center glow dot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-2 h-2 rounded-full bg-accent/50 animate-pulse" />
        <div className="absolute inset-0 w-2 h-2 rounded-full bg-accent/30 blur-md animate-pulse" />
      </div>
    </div>
  );
}
