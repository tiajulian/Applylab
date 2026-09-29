// The exact strings that get embedded. Changing either format changes every similarity score, so
// profile_text is stored alongside the profile embedding for reproducible results.

const RESUME_CHARS = 2000;

export interface JobTextFields {
  title: string;
  company: string | null;
  category_label: string | null;
  location_display: string;
  description_snippet: string;
}

export interface ProfileTextFields {
  targetTitles: string[];
  skills: string[];
  seniority: string | null;
  locations: string[];
  resumeText: string | null;
}

export function buildJobText(job: JobTextFields): string {
  return [job.title, job.company ?? "", job.category_label ?? "", job.location_display, job.description_snippet].join("\n");
}

export function buildProfileText(profile: ProfileTextFields): string {
  const lines = [
    `Target roles: ${profile.targetTitles.join(", ")}`,
    `Skills: ${profile.skills.join(", ")}`,
    `Seniority: ${profile.seniority ?? ""}`,
    `Locations: ${profile.locations.join(", ")}`,
  ];
  const resume = profile.resumeText?.trim().slice(0, RESUME_CHARS);
  if (resume) lines.push(resume);
  return lines.join("\n");
}
