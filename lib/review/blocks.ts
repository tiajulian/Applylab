import type { ResumeContent } from "@/types";

/** One reviewable piece of text. `id` uses the same format as factCheckTargetKey, so it is also the
 * data-fc-target the preview renders the field under. */
export interface ReviewBlock {
  id: string;
  text: string;
  /** Section and entry for the card header, e.g. "Experience, Analytics Engineer". */
  label: string;
  /** False for composite lines (a role's dates, "title at company"): they can be reviewed and
   * edited but never rewritten by an automatic fix. */
  writable: boolean;
}

const entryName = (...parts: string[]) => parts.find((p) => p.trim()) ?? "";
const labelled = (section: string, name: string) => (name ? `${section}, ${name}` : section);

export function listBlocks(c: ResumeContent): ReviewBlock[] {
  const blocks: ReviewBlock[] = [{ id: "summary", text: c.summary, label: "Summary", writable: true }];
  c.skills.forEach((text, i) => blocks.push({ id: `skill:${i}`, text, label: "Skills", writable: true }));

  c.experience.forEach((e, i) => {
    const label = labelled("Experience", entryName(e.job_title, e.company));
    const header = (field: string, text: string, writable = true) =>
      blocks.push({ id: `experienceHeader:${i}:${field}`, text, label, writable });
    header("job_title", e.job_title);
    header("company", e.company);
    header("dates", [e.start_date, e.end_date].filter(Boolean).join(" - "), false);
    header("role", [e.job_title, e.company].filter(Boolean).join(" at "), false);
    e.bullets.forEach((text, j) => blocks.push({ id: `experienceBullet:${i}:${j}`, text, label, writable: true }));
  });

  c.projects.forEach((p, i) => {
    const label = labelled("Projects", p.title);
    blocks.push({ id: `projectHeader:${i}:title`, text: p.title, label, writable: true });
    blocks.push({ id: `projectHeader:${i}:project`, text: p.title, label, writable: false });
    blocks.push({ id: `projectHeader:${i}:year`, text: p.year, label, writable: true });
    p.bullets.forEach((text, j) => blocks.push({ id: `projectBullet:${i}:${j}`, text, label, writable: true }));
  });

  c.education.forEach((e, i) => {
    const label = labelled("Education", entryName(e.degree, e.institution));
    blocks.push({ id: `education:${i}:degree`, text: e.degree, label, writable: true });
    blocks.push({ id: `education:${i}:institution`, text: e.institution, label, writable: true });
  });

  c.tools.forEach((text, i) => blocks.push({ id: `tool:${i}`, text, label: "Tools", writable: true }));
  return blocks;
}

/** Rewrites one block's text, or returns `content` unchanged if the id is unknown/not writable. */
export function setBlockText(c: ResumeContent, blockId: string, text: string): ResumeContent {
  const [kind, a, b] = blockId.split(":");
  const i = Number(a);
  const j = Number(b);
  const replaceAt = <T>(list: T[], index: number, next: T) => list.map((item, k) => (k === index ? next : item));

  switch (kind) {
    case "summary":
      return { ...c, summary: text };
    case "skill":
      return { ...c, skills: replaceAt(c.skills, i, text) };
    case "tool":
      return { ...c, tools: replaceAt(c.tools, i, text) };
    case "experienceBullet":
      return { ...c, experience: replaceAt(c.experience, i, { ...c.experience[i], bullets: replaceAt(c.experience[i].bullets, j, text) }) };
    case "projectBullet":
      return { ...c, projects: replaceAt(c.projects, i, { ...c.projects[i], bullets: replaceAt(c.projects[i].bullets, j, text) }) };
    case "experienceHeader":
      return b === "job_title" || b === "company" ? { ...c, experience: replaceAt(c.experience, i, { ...c.experience[i], [b]: text }) } : c;
    case "projectHeader":
      return b === "title" || b === "year" ? { ...c, projects: replaceAt(c.projects, i, { ...c.projects[i], [b]: text }) } : c;
    case "education":
      return b === "degree" || b === "institution" ? { ...c, education: replaceAt(c.education, i, { ...c.education[i], [b]: text }) } : c;
    default:
      return c;
  }
}

/** The rendered fields a block's highlight lands on. A composite line ("title at company") has no field
 * of its own: its passage is drawn on the fields it is made of. */
export function fieldKeysFor(blockId: string): string[] {
  const [kind, i, field] = blockId.split(":");
  if (kind === "experienceHeader" && field === "role") return [`experienceHeader:${i}:job_title`, `experienceHeader:${i}:company`];
  if (kind === "projectHeader" && field === "project") return [`projectHeader:${i}:title`];
  return [blockId];
}

/** Document-order position of each block, for sorting cards top-to-bottom like the page. */
export function blockOrder(blocks: ReviewBlock[]): Map<string, number> {
  return new Map(blocks.map((b, i) => [b.id, i]));
}
