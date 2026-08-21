import { PRESENT_WORDS } from "@/lib/profile/parseRoleDate";
import type { EducationEntry } from "@/types";

/** Migrates a pre-date-range row (single free-text `year`, e.g. "2018 - 2022" or "2022") into the
 * current start_date/end_date/is_current shape, same treatment as
 * lib/profile/normalizeWorkExperience.ts#migrateIsCurrent for work_experience. Call this at every
 * read boundary (server routes, profile forms) rather than trusting the stored shape matches
 * EducationEntry. */
function migrateDates(entry: unknown): { start_date: string; end_date: string; is_current: boolean } {
  const raw = entry as { start_date?: string; end_date?: string; is_current?: boolean; year?: string };
  if (typeof raw.start_date === "string" || typeof raw.end_date === "string" || typeof raw.is_current === "boolean") {
    return { start_date: raw.start_date ?? "", end_date: raw.end_date ?? "", is_current: raw.is_current ?? false };
  }

  const legacyYear = (raw.year ?? "").trim();
  if (!legacyYear) return { start_date: "", end_date: "", is_current: false };
  if (PRESENT_WORDS.has(legacyYear.toLowerCase())) {
    return { start_date: "", end_date: "", is_current: true };
  }

  const [rawStart, rawEnd] = legacyYear.split(/\s*[-–—]\s*/);
  if (rawEnd !== undefined) {
    const isCurrent = PRESENT_WORDS.has(rawEnd.trim().toLowerCase());
    return { start_date: rawStart.trim(), end_date: isCurrent ? "" : rawEnd.trim(), is_current: isCurrent };
  }
  // A single value with no range separator reads most naturally as a completion year.
  return { start_date: "", end_date: legacyYear, is_current: false };
}

function getAcronym(text: string): string {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== "of" && w !== "and" && w !== "the" && w !== "for" && w !== "in")
    .map((w) => w[0])
    .join("");
}

function isSameInstitution(inst1: string, inst2: string): boolean {
  const i1 = inst1.toLowerCase();
  const i2 = inst2.toLowerCase();
  if (i1.includes(i2) || i2.includes(i1)) return true;

  const ac1 = getAcronym(inst1);
  const ac2 = getAcronym(inst2);
  if ((ac1.length >= 2 && (i2.includes(ac1) || ac2 === ac1)) || (ac2.length >= 2 && (i1.includes(ac2) || ac1 === ac2))) {
    return true;
  }

  const stopWords = new Set(["university", "college", "insearch", "tafe", "institute", "of", "and", "the"]);
  const words1 = i1.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !stopWords.has(w));
  const words2 = i2.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !stopWords.has(w));
  return words1.some((w) => words2.includes(w));
}

export function prunePathwayQualifications(entries: EducationEntry[]): EducationEntry[] {
  if (!entries || entries.length <= 1) return entries ?? [];

  const higherDegrees = entries.filter((e) => {
    const deg = e.degree.toLowerCase();
    return deg.includes("bachelor") || deg.includes("master") || deg.includes("phd") || deg.includes("doctor");
  });

  if (higherDegrees.length === 0) return entries;

  return entries.filter((entry) => {
    const deg = entry.degree.toLowerCase();
    const isPathway =
      deg.includes("diploma") ||
      deg.includes("certificate") ||
      deg.includes("foundation") ||
      deg.includes("insearch") ||
      deg.includes("pathway");

    if (!isPathway) return true;

    const hasHigherAtSameInst = higherDegrees.some((higher) =>
      isSameInstitution(entry.institution, higher.institution)
    );

    return !hasHigherAtSameInst;
  });
}

export function normalizeEducation(entries: EducationEntry[] | null | undefined): EducationEntry[] {
  if (!entries) return [];
  const normalized = entries.map((entry) => {
    const raw = entry as { degree?: string; institution?: string; notes?: string };
    return {
      degree: raw.degree ?? "",
      institution: raw.institution ?? "",
      notes: raw.notes ?? "",
      ...migrateDates(entry),
    };
  });
  return prunePathwayQualifications(normalized);
}
