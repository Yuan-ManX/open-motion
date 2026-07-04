/** Branded id helpers (string-based; ulid-like for ordering). */
export type ProjectId = string & { readonly __brand: "ProjectId" };
export type ComponentId = string & { readonly __brand: "ComponentId" };
export type SkillId = string & { readonly __brand: "SkillId" };
export type TemplateId = string & { readonly __brand: "TemplateId" };

/** Time-prefixed sortable id: ms-since-epoch + random. */
export function createId(prefix = ""): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${ts}${rand}`;
}
