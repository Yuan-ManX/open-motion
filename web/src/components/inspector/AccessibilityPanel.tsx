import { useState, useCallback, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import * as api from "../../api/endpoints.js";
import type {
  AccessibilityReport,
  AccessibilityIssue,
  AccessibilityProfile,
  StrictestProfileResult,
} from "../../api/endpoints.js";

const SEVERITY_COLORS: Record<AccessibilityIssue["severity"], string> = {
  critical: "text-red-400 border-red-500/50",
  warning: "text-yellow-400 border-yellow-500/50",
  info: "text-gray-400 border-gray-500/50",
};

const SEVERITY_ICONS: Record<AccessibilityIssue["severity"], string> = {
  critical: "✕",
  warning: "▲",
  info: "i",
};

const CATEGORY_LABELS: Record<AccessibilityIssue["category"], string> = {
  vestibular: "Vestibular",
  seizure: "Seizure",
  "reduced-motion": "Reduced Motion",
  cognitive: "Cognitive",
};

/** Accessibility & Safety panel — fetches a direct report from the backend
 *  and displays categorized issues with remediation guidance. Also surfaces
 *  the accessibility motion profile library so designers can pick a safe
 *  operating envelope (vestibular-safe, reduced-motion, seizure-safe, etc.)
 *  and resolve the strictest intersection of several profiles. */
export function AccessibilityPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.getAccessibilityReport(projectId);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run accessibility check");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  if (!projectId) {
    // No project — still surface the profile library so designers can review
    // safe operating envelopes before applying them.
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-edge flex-shrink-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Accessibility & Safety
          </span>
        </div>
        <div className="px-3 py-2 text-[10px] text-gray-600 border-b border-edge">
          Open a project to run an accessibility check. Meanwhile, browse the
          motion safety profiles below.
        </div>
        <ProfilesSection />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with run button */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Accessibility & Safety
          </span>
          {report && (
            <span className={`text-[10px] font-mono font-bold ${
              report.score >= 80 ? "text-gray-200" : report.score >= 50 ? "text-yellow-400" : "text-red-400"
            }`}>
              {report.score}/100
            </span>
          )}
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors disabled:opacity-50"
          title="Run accessibility check directly"
        >
          {loading ? "Checking…" : "Run Accessibility Check"}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="px-3 py-2 text-[10px] text-red-400 border-b border-edge">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Results */}
      {report && !loading && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Summary */}
          <div className="px-3 py-2 border-b border-edge bg-panel2">
            <div className="text-[9px] text-gray-500 mb-1">{report.summary}</div>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-1 mt-2">
              <StatChip label="Vestibular" count={report.stats.vestibularIssues} />
              <StatChip label="Seizure" count={report.stats.seizureIssues} />
              <StatChip label="Reduced Motion" count={report.stats.reducedMotionIssues} />
              <StatChip label="Cognitive" count={report.stats.cognitiveIssues} />
            </div>
            <div className="flex gap-2 mt-2 text-[8px] text-gray-600">
              <span>Components: {report.stats.totalComponents}</span>
              <span>Simultaneous: {report.stats.maxSimultaneousAnimations}</span>
              {report.stats.hasInfiniteLoops && <span className="text-yellow-500">∞ Loops</span>}
              {report.stats.hasFlashingRisk && <span className="text-red-400">⚡ Flash</span>}
            </div>
          </div>

          {/* Issues list */}
          <div className="px-3 py-2 space-y-1.5">
            {report.issues.length === 0 ? (
              <div className="text-center text-[10px] text-gray-500 py-4">
                No accessibility issues detected.
              </div>
            ) : (
              report.issues.map((issue, i) => (
                <div
                  key={i}
                  className={`border ${SEVERITY_COLORS[issue.severity]} p-2 rounded`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] font-bold">{SEVERITY_ICONS[issue.severity]}</span>
                    <span className="text-[8px] font-mono uppercase tracking-wider text-gray-500">
                      {CATEGORY_LABELS[issue.category]}
                    </span>
                    {issue.componentName && (
                      <span className="text-[8px] text-gray-600 ml-auto truncate max-w-[80px]">
                        {issue.componentName}
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-gray-400 leading-relaxed mb-1">
                    {issue.message}
                  </div>
                  <div className="text-[9px] text-gray-600 leading-relaxed">
                    <span className="text-gray-500">Fix: </span>{issue.remediation}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Motion profiles library — always available below the report. */}
          <ProfilesSection />
        </div>
      )}

      {/* Empty state — before first check */}
      {!report && !loading && !error && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 py-6 text-center text-[10px] text-gray-600">
            Click "Run Accessibility Check" to analyze your motion for vestibular
            safety, seizure risk, reduced-motion compliance, and cognitive load.
          </div>
          <div className="px-3 pb-3 space-y-2">
            <div className="border border-edge p-2">
              <div className="text-[8px] font-mono uppercase text-gray-600 mb-1">What it checks</div>
              <ul className="text-[9px] text-gray-500 space-y-1">
                <li><span className="text-gray-400">⟿</span> Vestibular — large displacement, rotation, speed</li>
                <li><span className="text-gray-400">⚡</span> Seizure — flashing above 3Hz (WCAG 2.3.1)</li>
                <li><span className="text-gray-400">⊘</span> Reduced motion — loops, hidden content</li>
                <li><span className="text-gray-400">◐</span> Cognitive — simultaneous count, consistency</li>
              </ul>
            </div>
            <button
              onClick={() => useChatStore.getState().send(projectId, "Check the accessibility and safety of all motion in this project")}
              className="w-full text-[9px] text-gray-600 hover:text-gray-400 transition-colors py-1"
            >
              Or run via Agent chat →
            </button>
          </div>

          {/* Motion profiles library — always available below the prompt. */}
          <ProfilesSection />
        </div>
      )}
    </div>
  );
}

/**
 * Profiles section — lists every accessibility motion profile and lets the
 * designer pick the strictest intersection of several profiles. Profiles are
 * fetched once on mount and rendered as compact constraint cards; selecting
 * two or more reveals the strictest resolver so the designer can confirm the
 * intersection before applying it.
 */
function ProfilesSection() {
  const [profiles, setProfiles] = useState<AccessibilityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [strictest, setStrictest] = useState<StrictestProfileResult | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listAccessibilityProfiles()
      .then((r) => {
        if (!cancelled) setProfiles(r.profiles);
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setStrictest(null);
  };

  const handleResolveStrictest = () => {
    if (selectedIds.size < 2) return;
    setResolving(true);
    api
      .pickStrictestAccessibilityProfile(Array.from(selectedIds))
      .then(setStrictest)
      .catch(() => setStrictest(null))
      .finally(() => setResolving(false));
  };

  return (
    <div className="border-t border-edge">
      <div className="px-3 py-2 bg-panel2 flex items-center justify-between">
        <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">
          Motion Profiles
        </span>
        <span className="text-[9px] text-gray-600 font-mono">
          {profiles.length} profiles
        </span>
      </div>

      {loading && (
        <div className="px-3 py-3 text-[10px] text-gray-600">Loading profiles…</div>
      )}

      {!loading && (
        <>
          <div className="px-3 py-2 space-y-1">
            {profiles.map((profile) => {
              const isExpanded = expandedId === profile.id;
              const isSelected = selectedIds.has(profile.id);
              return (
                <div
                  key={profile.id}
                  className={`rounded border transition-colors ${
                    isSelected
                      ? "border-accent bg-accent/5"
                      : "border-edge bg-panel2 hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    <button
                      onClick={() => toggleSelect(profile.id)}
                      className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                        isSelected
                          ? "border-accent bg-accent text-black"
                          : "border-gray-500"
                      }`}
                      aria-label={`Select ${profile.name}`}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <span className="text-[8px] leading-none">✓</span>}
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : profile.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] px-1 py-0.5 rounded bg-edge text-gray-400 uppercase tracking-wide flex-shrink-0">
                          {profile.context}
                        </span>
                        <span className="text-[10px] font-medium text-gray-200 truncate">
                          {profile.name}
                        </span>
                      </div>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="px-2 pb-2 pt-0.5 border-t border-edge/50">
                      <p className="text-[9px] text-gray-500 leading-snug mb-1.5">
                        {profile.description}
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-[9px]">
                        <LimitRow label="Displacement" value={`${profile.maxDisplacementPx}px`} />
                        <LimitRow label="Rotation" value={`${profile.maxRotationDeg}°`} />
                        <LimitRow label="Opacity freq" value={`${profile.maxOpacityFrequencyHz}Hz`} />
                        <LimitRow label="Duration" value={`${profile.maxDurationMs}ms`} />
                        <LimitRow label="Simultaneous" value={String(profile.maxSimultaneousAnimations)} />
                        <LimitRow label="Loops" value={profile.allowLoops ? "yes" : "no"} />
                        <LimitRow label="Parallax" value={profile.allowParallax ? "yes" : "no"} />
                        <LimitRow label="Overshoot" value={profile.disableOvershoot ? "off" : "on"} />
                      </div>
                      {profile.discouragedCategories.length > 0 && (
                        <div className="mt-1.5">
                          <div className="text-[8px] uppercase tracking-wide text-gray-600 mb-0.5">
                            Discouraged
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {profile.discouragedCategories.map((c) => (
                              <span
                                key={c}
                                className="text-[8px] px-1 py-0.5 rounded bg-edge text-gray-500"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Strictest resolver — appears once two or more profiles are picked. */}
          {selectedIds.size >= 2 && (
            <div className="px-3 pb-2">
              <button
                onClick={handleResolveStrictest}
                disabled={resolving}
                className="w-full text-[10px] px-2 py-1 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-black font-medium transition-colors"
              >
                {resolving
                  ? "Resolving…"
                  : `Resolve strictest of ${selectedIds.size} profiles`}
              </button>
              {strictest && strictest.strictest && (
                <div className="mt-1.5 rounded border border-accent/40 bg-accent/5 px-2 py-1.5">
                  <div className="text-[8px] uppercase tracking-wide text-accent mb-0.5">
                    Strictest intersection
                  </div>
                  <div className="text-[10px] font-medium text-gray-200">
                    {strictest.strictest.name}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">
                    {strictest.strictest.description}
                  </div>
                  <div className="flex gap-2 mt-1 text-[8px] text-gray-600 font-mono">
                    <span>↔ {strictest.strictest.maxDisplacementPx}px</span>
                    <span>↻ {strictest.strictest.maxRotationDeg}°</span>
                    <span>⚡ {strictest.strictest.maxOpacityFrequencyHz}Hz</span>
                    <span>◇ {strictest.strictest.maxSimultaneousAnimations}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-1.5 py-0.5 rounded border border-edge">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 font-mono">{value}</span>
    </div>
  );
}

function StatChip({ label, count }: { label: string; count: number }) {
  return (
    <div className={`flex items-center justify-between px-1.5 py-0.5 rounded text-[9px] border ${
      count > 0
        ? count >= 3 ? "border-red-500/30 text-red-400" : "border-yellow-500/30 text-yellow-400"
        : "border-edge text-gray-500"
    }`}>
      <span>{label}</span>
      <span className="font-mono font-bold">{count}</span>
    </div>
  );
}
