import { useState, useEffect, useRef } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";

type VideoStatus = "idle" | "pending" | "running" | "done" | "failed";
type Format = "mp4" | "gif" | "webm";
type CodeFormat = "css" | "json" | "react";

export function ExportDialog() {
  const open = useUiStore((s) => s.exportOpen);
  const setOpen = useUiStore((s) => s.setExportOpen);
  const health = useUiStore((s) => s.health);
  const projectId = useProjectStore((s) => s.projectId);

  const [htmlResult, setHtmlResult] = useState<{ url: string; filename: string } | null>(null);
  const [htmlBusy, setHtmlBusy] = useState(false);
  const [htmlError, setHtmlError] = useState<string | null>(null);

  const [format, setFormat] = useState<Format>("mp4");
  const [fps, setFps] = useState(30);
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(360);
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("idle");
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [codeFormat, setCodeFormat] = useState<CodeFormat>("css");
  const [codeResult, setCodeResult] = useState<api.CodeExport | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [skillName, setSkillName] = useState("");
  const [skillDesc, setSkillDesc] = useState("");
  const [skillTags, setSkillTags] = useState("");
  const [skillBusy, setSkillBusy] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);
  const [skillResult, setSkillResult] = useState<{ id: string; name: string } | null>(null);

  const videoAvailable = !!(health?.puppeteer && health?.ffmpeg);

  useEffect(() => {
    if (!open) {
      setHtmlResult(null);
      setHtmlError(null);
      setHtmlBusy(false);
      setVideoStatus("idle");
      setVideoJobId(null);
      setVideoError(null);
      setVideoUrl(null);
      setCodeResult(null);
      setCodeError(null);
      setCodeBusy(false);
      setCopied(false);
      setSkillName("");
      setSkillDesc("");
      setSkillTags("");
      setSkillBusy(false);
      setSkillError(null);
      setSkillResult(null);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const exportHtml = async () => {
    if (!projectId) return;
    setHtmlBusy(true);
    setHtmlError(null);
    setHtmlResult(null);
    try {
      const result = await api.exportHtml(projectId);
      setHtmlResult({ url: result.url, filename: result.filename });
      window.open(result.url, "_blank");
    } catch (e) {
      setHtmlError(e instanceof Error ? e.message : String(e));
    } finally {
      setHtmlBusy(false);
    }
  };

  const exportVideo = async () => {
    if (!projectId) return;
    setVideoStatus("pending");
    setVideoError(null);
    setVideoUrl(null);
    setVideoJobId(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    try {
      const { jobId } = await api.exportVideo(projectId, { format, fps, width, height });
      setVideoJobId(jobId);
      pollRef.current = setInterval(async () => {
        try {
          const job = await api.getVideoJob(jobId);
          setVideoStatus(job.status as VideoStatus);
          if (job.status === "done") {
            if (job.filePath) {
              setVideoUrl(`/api/exports/files/${job.filePath}`);
            }
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } else if (job.status === "failed") {
            setVideoError(job.error ?? "export failed");
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch {
          /* keep polling */
        }
      }, 1500);
    } catch (e) {
      setVideoStatus("failed");
      setVideoError(e instanceof Error ? e.message : String(e));
    }
  };

  const exportCode = async () => {
    if (!projectId) return;
    setCodeBusy(true);
    setCodeError(null);
    setCodeResult(null);
    setCopied(false);
    try {
      const result =
        codeFormat === "css"
          ? await api.exportCss(projectId)
          : codeFormat === "json"
            ? await api.exportJson(projectId)
            : await api.exportReact(projectId);
      setCodeResult(result);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : String(e));
    } finally {
      setCodeBusy(false);
    }
  };

  const copyCode = async () => {
    if (!codeResult) return;
    try {
      await navigator.clipboard.writeText(codeResult.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCodeError("clipboard unavailable");
    }
  };

  const downloadCode = () => {
    if (!codeResult) return;
    const blob = new Blob([codeResult.code], {
      type:
        codeResult.language === "json"
          ? "application/json"
          : codeResult.language === "css"
            ? "text/css"
            : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = codeResult.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const packageSkill = async () => {
    if (!projectId) return;
    const name = skillName.trim();
    const description = skillDesc.trim();
    if (!name || !description) {
      setSkillError("name and description are required");
      return;
    }
    setSkillBusy(true);
    setSkillError(null);
    setSkillResult(null);
    try {
      const tags = skillTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const skill = await api.createSkill({ projectId, name, description, tags });
      setSkillResult({ id: skill.id, name: skill.name });
      setSkillName("");
      setSkillDesc("");
      setSkillTags("");
    } catch (e) {
      setSkillError(e instanceof Error ? e.message : String(e));
    } finally {
      setSkillBusy(false);
    }
  };

  if (!open) return null;

  const inputCls =
    "w-full bg-panel2 border border-edge rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-accent";

  const tabCls = (active: boolean) =>
    `px-3 py-1 text-xs rounded transition-colors ${
      active
        ? "bg-accent text-white"
        : "bg-panel2 border border-edge text-gray-400 hover:text-gray-200"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-panel border border-edge rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h2 className="text-sm font-semibold text-gray-200">Export</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-4 space-y-5 overflow-y-auto">
          {/* HTML export */}
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Standalone HTML</div>
            <button
              onClick={exportHtml}
              disabled={!projectId || htmlBusy}
              className="w-full px-3 py-2 rounded-lg bg-accent hover:bg-accent2 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              {htmlBusy ? "Exporting…" : "Export HTML"}
            </button>
            {htmlError && <p className="text-xs text-red-400 mt-2">{htmlError}</p>}
            {htmlResult && (
              <div className="mt-2 text-xs text-gray-400">
                Generated{" "}
                <a
                  href={htmlResult.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent2 underline"
                >
                  {htmlResult.filename}
                </a>
              </div>
            )}
          </section>

          <div className="border-t border-edge" />

          {/* Code export */}
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Code</div>
            <div className="flex gap-1 mb-2">
              <button className={tabCls(codeFormat === "css")} onClick={() => setCodeFormat("css")}>
                CSS
              </button>
              <button className={tabCls(codeFormat === "json")} onClick={() => setCodeFormat("json")}>
                JSON
              </button>
              <button
                className={tabCls(codeFormat === "react")}
                onClick={() => setCodeFormat("react")}
              >
                React
              </button>
            </div>
            <button
              onClick={exportCode}
              disabled={!projectId || codeBusy}
              className="w-full px-3 py-2 rounded-lg bg-panel2 border border-edge hover:border-accent disabled:opacity-40 text-gray-200 text-sm font-medium transition-colors"
            >
              {codeBusy ? "Generating…" : `Export ${codeFormat.toUpperCase()}`}
            </button>
            {codeError && <p className="text-xs text-red-400 mt-2">{codeError}</p>}
            {codeResult && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500 font-mono">{codeResult.filename}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={copyCode}
                      className="text-[10px] px-2 py-0.5 rounded bg-panel2 border border-edge text-gray-300 hover:border-accent"
                    >
                      {copied ? "Copied ✓" : "Copy"}
                    </button>
                    <button
                      onClick={downloadCode}
                      className="text-[10px] px-2 py-0.5 rounded bg-panel2 border border-edge text-gray-300 hover:border-accent"
                    >
                      Download
                    </button>
                  </div>
                </div>
                <pre className="bg-black/40 border border-edge rounded p-2 text-[10px] leading-relaxed text-gray-300 font-mono max-h-56 overflow-auto whitespace-pre">
                  {codeResult.code}
                </pre>
              </div>
            )}
          </section>

          <div className="border-t border-edge" />

          {/* Video export */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wide text-gray-500">Video</div>
              {!videoAvailable && (
                <span className="text-[10px] text-amber-400">requires puppeteer + ffmpeg</span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 mb-2">
              <div>
                <label className="text-[10px] text-gray-500">Format</label>
                <select
                  className={inputCls}
                  value={format}
                  onChange={(e) => setFormat(e.target.value as Format)}
                  disabled={!videoAvailable}
                >
                  <option value="mp4">mp4</option>
                  <option value="webm">webm</option>
                  <option value="gif">gif</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500">FPS</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className={inputCls}
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  disabled={!videoAvailable}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Width</label>
                <input
                  type="number"
                  min={64}
                  step={16}
                  className={inputCls}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  disabled={!videoAvailable}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Height</label>
                <input
                  type="number"
                  min={64}
                  step={16}
                  className={inputCls}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  disabled={!videoAvailable}
                />
              </div>
            </div>

            <button
              onClick={exportVideo}
              disabled={
                !projectId ||
                !videoAvailable ||
                videoStatus === "pending" ||
                videoStatus === "running"
              }
              className="w-full px-3 py-2 rounded-lg bg-panel2 border border-edge hover:border-accent disabled:opacity-40 text-gray-200 text-sm font-medium transition-colors"
            >
              {videoStatus === "pending" || videoStatus === "running"
                ? `Exporting… (${videoStatus})`
                : "Export Video"}
            </button>

            {videoJobId && (
              <div className="mt-2 text-[10px] text-gray-600 font-mono">job: {videoJobId}</div>
            )}
            {videoError && <p className="text-xs text-red-400 mt-2">{videoError}</p>}
            {videoStatus === "done" && videoUrl && (
              <div className="mt-2 text-xs text-gray-400">
                Ready:{" "}
                <a href={videoUrl} download className="text-accent2 underline">
                  download
                </a>
              </div>
            )}
          </section>

          <div className="border-t border-edge" />

          {/* Skill packaging */}
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Skill</div>
            <p className="text-[10px] text-gray-600 mb-2">
              Package the current project as a reusable Skill unit.
            </p>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Skill name"
                className={inputCls}
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                disabled={!projectId || skillBusy}
              />
              <textarea
                placeholder="Description"
                className={inputCls}
                rows={2}
                value={skillDesc}
                onChange={(e) => setSkillDesc(e.target.value)}
                disabled={!projectId || skillBusy}
              />
              <input
                type="text"
                placeholder="tags (comma-separated)"
                className={inputCls}
                value={skillTags}
                onChange={(e) => setSkillTags(e.target.value)}
                disabled={!projectId || skillBusy}
              />
            </div>
            <button
              onClick={packageSkill}
              disabled={!projectId || skillBusy}
              className="w-full mt-2 px-3 py-2 rounded-lg bg-panel2 border border-edge hover:border-accent disabled:opacity-40 text-gray-200 text-sm font-medium transition-colors"
            >
              {skillBusy ? "Packaging…" : "Package Skill"}
            </button>
            {skillError && <p className="text-xs text-red-400 mt-2">{skillError}</p>}
            {skillResult && (
              <div className="mt-2 text-xs text-gray-400">
                Packaged{" "}
                <span className="text-accent2 font-mono">{skillResult.name}</span> (id: {skillResult.id}). Find it in the Skills panel.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
