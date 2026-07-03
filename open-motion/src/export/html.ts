import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { getProjectSpec } from "../db/repositories/projects.js";
import { generateStandaloneHtml } from "../motion/generator/html.js";
import { exportsDir } from "../db/index.js";
import { publicBaseUrl } from "../config.js";

export interface ExportHtmlResult {
  html: string;
  url: string;
  filePath: string;
  filename: string;
}

/** Render a project to a standalone, runnable HTML file and persist it for download. */
export function exportProjectHtml(projectId: string): ExportHtmlResult | null {
  const spec = getProjectSpec(projectId);
  if (!spec) return null;
  const html = generateStandaloneHtml(spec);
  const ts = Date.now();
  const filename = `${projectId}-${ts}.html`;
  const filePath = join(exportsDir, filename);
  writeFileSync(filePath, html, "utf8");
  const url = `${publicBaseUrl()}/api/exports/${filename}`;
  return { html, url, filePath, filename };
}
