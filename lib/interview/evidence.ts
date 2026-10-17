import type { EvidenceSource, UserProfile } from "@/types";

/** One citable piece of the Career Profile. Ids are positional ("role:0", "win:0:1",
 *  "project:2") because profile entries have no stable ids of their own. */
export interface EvidenceItem extends EvidenceSource {
  text: string;
}

const clip = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function buildEvidence(profile: Partial<UserProfile>): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  (profile.work_experience ?? []).forEach((role, r) => {
    const roleLabel = [role.job_title, role.company].filter(Boolean).join(" at ");
    items.push({ id: `role:${r}`, label: roleLabel || "A role in your profile", text: role.description || "" });
    (role.wins ?? []).forEach((win, w) => {
      if (!win.text?.trim()) return;
      items.push({
        id: `win:${r}:${w}`,
        label: `Win: ${clip(win.text.trim())}`,
        text: [win.text, win.metric && `(Metric: ${win.metric})`, win.outcome && `Outcome: ${win.outcome}`, win.tools?.length && `Tools: ${win.tools.join(", ")}`]
          .filter(Boolean)
          .join(" "),
      });
    });
  });
  (profile.projects ?? []).forEach((p, i) => {
    items.push({
      id: `project:${i}`,
      label: `Project: ${clip(p.title || "Untitled")}`,
      text: [p.description, p.context, p.tools?.length && `Tools: ${p.tools.join(", ")}`, p.outcome, p.outcome_metric]
        .filter(Boolean)
        .join(" "),
    });
  });
  return items;
}

/** Evidence block for the scorer prompt; each line starts with the id it may cite. */
export function formatEvidenceForPrompt(items: EvidenceItem[]): string {
  return items.map((i) => `[${i.id}] ${i.label}${i.text ? `: ${i.text}` : ""}`).join("\n");
}

/** Keeps only ids that exist, in the order given, as display chips. */
export function resolveSources(ids: unknown, items: EvidenceItem[]): EvidenceSource[] {
  if (!Array.isArray(ids)) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const out: EvidenceSource[] = [];
  for (const raw of ids) {
    const item = byId.get(String(raw));
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, label: item.label });
  }
  return out;
}
