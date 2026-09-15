// Pure ResumeContent mutation functions, promoted out of ResumeEditorForm.tsx's inline spreads
// so both the accordion form and the WYSIWYG canvas (components/templates/BaseResumeTemplate.tsx)
// compute the exact same "next ResumeContent" shape from an edit, rather than duplicating
// bullet/index-splicing logic in two places.
import { arrayMove, moveItem } from "@/lib/resume/resumeSections";
import type {
  ResumeContact,
  ResumeContent,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectEntry,
  ResumeReferee,
} from "@/types";

export const EMPTY_EXPERIENCE: ResumeExperienceEntry = {
  job_title: "",
  company: "",
  company_description: "",
  location: "",
  start_date: "",
  end_date: "",
  bullets: [],
};

export const EMPTY_EDUCATION: ResumeEducationEntry = { degree: "", institution: "", year: "", notes: "" };
export const EMPTY_REFEREE: ResumeReferee = { name: "", title: "", organisation: "", phone: "", email: "" };
export const EMPTY_PROJECT: ResumeProjectEntry = { title: "", context: "", year: "", bullets: [] };

export function updateContact(resume: ResumeContent, field: keyof ResumeContact, value: string): ResumeContent {
  return { ...resume, contact: { ...resume.contact, [field]: value } };
}

export function updateSummary(resume: ResumeContent, value: string): ResumeContent {
  return { ...resume, summary: value };
}

export function setTargetTitles(resume: ResumeContent, target_titles: string[]): ResumeContent {
  return { ...resume, target_titles };
}

export function setSkills(resume: ResumeContent, skills: string[]): ResumeContent {
  return { ...resume, skills };
}

export function setTools(resume: ResumeContent, tools: string[]): ResumeContent {
  return { ...resume, tools };
}

// --- Experience -------------------------------------------------------------------------------

export function addExperience(resume: ResumeContent): ResumeContent {
  return { ...resume, experience: [EMPTY_EXPERIENCE, ...resume.experience] };
}

export function removeExperience(resume: ResumeContent, index: number): ResumeContent {
  return { ...resume, experience: resume.experience.filter((_, i) => i !== index) };
}

export function moveExperience(resume: ResumeContent, index: number, direction: -1 | 1): ResumeContent {
  const experience = moveItem(resume.experience, index, direction);
  return experience === resume.experience ? resume : { ...resume, experience };
}

/** Arbitrary-distance reorder for the canvas's drag-to-reorder handle, as opposed to
 * moveExperience's adjacent-swap (the toolbar's up/down arrows) - both stay, callers pick
 * whichever matches the interaction that triggered them. */
export function reorderExperience(resume: ResumeContent, from: number, to: number): ResumeContent {
  const experience = arrayMove(resume.experience, from, to);
  return experience === resume.experience ? resume : { ...resume, experience };
}

export function updateExperience(
  resume: ResumeContent,
  index: number,
  patch: Partial<ResumeExperienceEntry>
): ResumeContent {
  return {
    ...resume,
    experience: resume.experience.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
  };
}

export function addExperienceBullet(resume: ResumeContent, index: number): ResumeContent {
  const entry = resume.experience[index];
  return updateExperience(resume, index, { bullets: ["", ...entry.bullets] });
}

export function removeExperienceBullet(resume: ResumeContent, index: number, bulletIndex: number): ResumeContent {
  const entry = resume.experience[index];
  return updateExperience(resume, index, { bullets: entry.bullets.filter((_, i) => i !== bulletIndex) });
}

export function moveExperienceBullet(
  resume: ResumeContent,
  index: number,
  bulletIndex: number,
  direction: -1 | 1
): ResumeContent {
  const entry = resume.experience[index];
  const bullets = moveItem(entry.bullets, bulletIndex, direction);
  return bullets === entry.bullets ? resume : updateExperience(resume, index, { bullets });
}

export function reorderExperienceBullet(resume: ResumeContent, index: number, from: number, to: number): ResumeContent {
  const entry = resume.experience[index];
  const bullets = arrayMove(entry.bullets, from, to);
  return bullets === entry.bullets ? resume : updateExperience(resume, index, { bullets });
}

export function updateExperienceBullet(
  resume: ResumeContent,
  index: number,
  bulletIndex: number,
  value: string
): ResumeContent {
  const entry = resume.experience[index];
  return updateExperience(resume, index, {
    bullets: entry.bullets.map((b, i) => (i === bulletIndex ? value : b)),
  });
}

// --- Projects -----------------------------------------------------------------------------------
// The accordion never had adjacent-swap arrows for project entries (unlike experience roles), so
// there's intentionally no moveProject function - but the canvas's drag handle is a new capability
// requested directly for the canvas, not something being carried over, so reorderProject exists
// even though moveProject doesn't.

export function addProject(resume: ResumeContent, entry: ResumeProjectEntry = EMPTY_PROJECT): ResumeContent {
  return { ...resume, projects: [entry, ...resume.projects] };
}

export function reorderProject(resume: ResumeContent, from: number, to: number): ResumeContent {
  const projects = arrayMove(resume.projects, from, to);
  return projects === resume.projects ? resume : { ...resume, projects };
}

export function removeProject(resume: ResumeContent, index: number): ResumeContent {
  return { ...resume, projects: resume.projects.filter((_, i) => i !== index) };
}

export function updateProject(resume: ResumeContent, index: number, patch: Partial<ResumeProjectEntry>): ResumeContent {
  return {
    ...resume,
    projects: resume.projects.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
  };
}

export function addProjectBullet(resume: ResumeContent, index: number): ResumeContent {
  const entry = resume.projects[index];
  return updateProject(resume, index, { bullets: ["", ...entry.bullets] });
}

export function removeProjectBullet(resume: ResumeContent, index: number, bulletIndex: number): ResumeContent {
  const entry = resume.projects[index];
  return updateProject(resume, index, { bullets: entry.bullets.filter((_, i) => i !== bulletIndex) });
}

export function moveProjectBullet(
  resume: ResumeContent,
  index: number,
  bulletIndex: number,
  direction: -1 | 1
): ResumeContent {
  const entry = resume.projects[index];
  const bullets = moveItem(entry.bullets, bulletIndex, direction);
  return bullets === entry.bullets ? resume : updateProject(resume, index, { bullets });
}

export function reorderProjectBullet(resume: ResumeContent, index: number, from: number, to: number): ResumeContent {
  const entry = resume.projects[index];
  const bullets = arrayMove(entry.bullets, from, to);
  return bullets === entry.bullets ? resume : updateProject(resume, index, { bullets });
}

export function updateProjectBullet(
  resume: ResumeContent,
  index: number,
  bulletIndex: number,
  value: string
): ResumeContent {
  const entry = resume.projects[index];
  return updateProject(resume, index, {
    bullets: entry.bullets.map((b, i) => (i === bulletIndex ? value : b)),
  });
}

// --- Education ------------------------------------------------------------------------------
// No entry-level reordering exists for education today - intentionally no moveEducation function.

export function addEducation(resume: ResumeContent): ResumeContent {
  return { ...resume, education: [EMPTY_EDUCATION, ...resume.education] };
}

export function removeEducation(resume: ResumeContent, index: number): ResumeContent {
  return { ...resume, education: resume.education.filter((_, i) => i !== index) };
}

export function updateEducation(
  resume: ResumeContent,
  index: number,
  patch: Partial<ResumeEducationEntry>
): ResumeContent {
  return {
    ...resume,
    education: resume.education.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
  };
}

// --- Referees -------------------------------------------------------------------------------
// No entry-level reordering exists for referees today - intentionally no moveReferee function.

export function addReferee(resume: ResumeContent): ResumeContent {
  return { ...resume, referees: [EMPTY_REFEREE, ...resume.referees] };
}

export function removeReferee(resume: ResumeContent, index: number): ResumeContent {
  return { ...resume, referees: resume.referees.filter((_, i) => i !== index) };
}

export function updateReferee(resume: ResumeContent, index: number, patch: Partial<ResumeReferee>): ResumeContent {
  return {
    ...resume,
    referees: resume.referees.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
  };
}
