// Job profile: the API shape, input validation, and mapping to/from the job_profiles row.

export const PROFILE_LIMITS = {
  targetTitles: 5,
  skills: 30,
  locations: 5,
  itemChars: 100,
  resumeChars: 20_000,
  maxSalary: 1_000_000,
} as const;

export const CONTRACT_TYPES = ["full_time", "part_time", "permanent", "contract"] as const;
export const SENIORITY_LEVELS = ["graduate", "junior", "mid", "senior", "lead", "executive"] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];
export type Seniority = (typeof SENIORITY_LEVELS)[number];

export interface JobProfileInput {
  targetTitles: string[];
  skills: string[];
  locations: string[];
  remoteOk: boolean;
  minSalary: number | null;
  contractTypes: ContractType[];
  seniority: Seniority | null;
  resumeText: string | null;
}

export interface JobProfileRow {
  target_titles: string[];
  skills: string[];
  locations: string[];
  remote_ok: boolean;
  min_salary: number | null;
  contract_types: string[];
  seniority: string | null;
  resume_text: string | null;
  profile_text: string | null;
  embedding: string | null;
  updated_at: string;
  /** When the match cache was last written for this profile (null = never). */
  matches_computed_at: string | null;
}

export const PROFILE_COLUMNS =
  "target_titles, skills, locations, remote_ok, min_salary, contract_types, seniority, resume_text, profile_text, embedding, updated_at, matches_computed_at";

export const EMPTY_PROFILE: JobProfileInput = {
  targetTitles: [],
  skills: [],
  locations: [],
  remoteOk: false,
  minSalary: null,
  contractTypes: [],
  seniority: null,
  resumeText: null,
};

export function profileFromRow(row: JobProfileRow): JobProfileInput {
  return {
    targetTitles: row.target_titles,
    skills: row.skills,
    locations: row.locations,
    remoteOk: row.remote_ok,
    minSalary: row.min_salary,
    contractTypes: row.contract_types as ContractType[],
    seniority: row.seniority as Seniority | null,
    resumeText: row.resume_text,
  };
}

export function profileToRow(profile: JobProfileInput) {
  return {
    target_titles: profile.targetTitles,
    skills: profile.skills,
    locations: profile.locations,
    remote_ok: profile.remoteOk,
    min_salary: profile.minSalary,
    contract_types: profile.contractTypes,
    seniority: profile.seniority,
    resume_text: profile.resumeText,
  };
}

type FieldErrors = Partial<Record<keyof JobProfileInput, string>>;

/** Trims, drops blanks and case-insensitive duplicates, and checks count and item length. */
function stringList(value: unknown, max: number, label: string): { list: string[]; error?: string } {
  if (value === undefined || value === null) return { list: [] };
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) return { list: [], error: `${label} must be a list of text` };
  const seen = new Set<string>();
  const list: string[] = [];
  for (const raw of value as string[]) {
    const item = raw.trim().replace(/\s+/g, " ");
    if (!item || seen.has(item.toLowerCase())) continue;
    if (item.length > PROFILE_LIMITS.itemChars) return { list: [], error: `Each ${label.toLowerCase()} entry must be ${PROFILE_LIMITS.itemChars} characters or fewer` };
    seen.add(item.toLowerCase());
    list.push(item);
  }
  if (list.length > max) return { list: [], error: `Add up to ${max} ${label.toLowerCase()}` };
  return { list };
}

export function validateProfileInput(body: unknown): { input: JobProfileInput; errors: FieldErrors } {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const titles = stringList(b.targetTitles, PROFILE_LIMITS.targetTitles, "Target titles");
  if (titles.error) errors.targetTitles = titles.error;
  else if (titles.list.length === 0) errors.targetTitles = "Add at least one target job title";

  const skills = stringList(b.skills, PROFILE_LIMITS.skills, "Skills");
  if (skills.error) errors.skills = skills.error;

  const locations = stringList(b.locations, PROFILE_LIMITS.locations, "Locations");
  if (locations.error) errors.locations = locations.error;

  if (b.remoteOk !== undefined && typeof b.remoteOk !== "boolean") errors.remoteOk = "remoteOk must be true or false";

  let minSalary: number | null = null;
  if (b.minSalary !== undefined && b.minSalary !== null) {
    if (typeof b.minSalary === "number" && Number.isInteger(b.minSalary) && b.minSalary >= 0 && b.minSalary <= PROFILE_LIMITS.maxSalary) {
      minSalary = b.minSalary || null;
    } else {
      errors.minSalary = `Minimum salary must be a whole number from 0 to ${PROFILE_LIMITS.maxSalary}`;
    }
  }

  const contractTypes = Array.isArray(b.contractTypes) ? [...new Set(b.contractTypes)] : b.contractTypes ?? [];
  if (!Array.isArray(contractTypes) || contractTypes.some((c) => !CONTRACT_TYPES.includes(c as ContractType))) {
    errors.contractTypes = `Work type must be any of: ${CONTRACT_TYPES.join(", ")}`;
  }

  const seniority = b.seniority ?? null;
  if (seniority !== null && !SENIORITY_LEVELS.includes(seniority as Seniority)) {
    errors.seniority = `Seniority must be one of: ${SENIORITY_LEVELS.join(", ")}`;
  }

  let resumeText: string | null = null;
  if (b.resumeText !== undefined && b.resumeText !== null) {
    if (typeof b.resumeText !== "string") errors.resumeText = "Resume text must be text";
    else if (b.resumeText.length > PROFILE_LIMITS.resumeChars) errors.resumeText = `Resume text must be ${PROFILE_LIMITS.resumeChars} characters or fewer`;
    else resumeText = b.resumeText.trim() || null;
  }

  return {
    input: {
      targetTitles: titles.list,
      skills: skills.list,
      locations: locations.list,
      remoteOk: b.remoteOk === true,
      minSalary,
      contractTypes: Array.isArray(contractTypes) ? (contractTypes as ContractType[]) : [],
      seniority: seniority as Seniority | null,
      resumeText,
    },
    errors,
  };
}
