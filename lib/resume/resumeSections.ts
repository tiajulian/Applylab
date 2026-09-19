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

/** The order sections actually render in: the user's saved order, else the template's own default
 * (Technical promotes Skills & Tools above Experience) for resumes never reordered. Shared by the
 * canvas and the reorder pop-up so the pop-up always shows what's on the page. */
export function effectiveSectionOrder(saved: ReorderableResumeSection[] | undefined, skillsFirst: boolean): ReorderableResumeSection[] {
  if (saved) return saved;
  return skillsFirst ? ["summary", "skills", "tools", "experience", "projects", "education"] : DEFAULT_RESUME_SECTION_ORDER;
}

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

/** Arbitrary-distance reorder (drag from index A to index B), as opposed to moveItem's
 * adjacent-swap (the toolbar's up/down arrows). Deliberately not imported from @dnd-kit/sortable's
 * own arrayMove here, so this pure data-logic module has no dependency on a drag UI library -
 * canvas drag handlers (which do use dnd-kit) call this with the indices dnd-kit's onDragEnd gives
 * them. */
export function arrayMove<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}
