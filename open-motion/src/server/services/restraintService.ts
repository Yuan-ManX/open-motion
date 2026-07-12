import { getProjectSpec } from "../../db/repositories/projects.js";
import { analyzeRestraint, formatRestraintReport, type RestraintAnalysis } from "../../motion/restraint.js";

export type { RestraintAnalysis };

export function analyzeProjectRestraint(projectId: string): { analysis: RestraintAnalysis; report: string } | null {
  const spec = getProjectSpec(projectId);
  if (!spec) return null;
  const analysis = analyzeRestraint(spec);
  const report = formatRestraintReport(analysis);
  return { analysis, report };
}
