// Resume-output section ordering (Phase 1 toolbar "reorder sections" control). This is
// deliberately separate from ResumeEditorForm's own ResumeSectionId (the accordion's fixed
// editing order) - only the sections below actually move around in the rendered resume;
// contact/positioning stay in the header and referees stay as the closing line.
export type ReorderableResumeSection =
  | "summary"
  | "skills"
  | "tools"
  | "experience"
  | "projects"
  | "education";

export const DEFAULT_RESUME_SECTION_ORDER: ReorderableResumeSection[] = [
  "summary",
  "experience",
  "skills",
  "tools",
  "projects",
  "education",
];

export const RESUME_SECTION_LABELS: Record<ReorderableResumeSection, string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  tools: "Tools & platforms",
  projects: "Projects",
  education: "Education",
};

export function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}
