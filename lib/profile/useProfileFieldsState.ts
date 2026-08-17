"use client";

import { useMemo, useRef, useState } from "react";
import { normalizeWorkExperience } from "@/lib/profile/normalizeWorkExperience";
import { normalizeEducation } from "@/lib/profile/normalizeEducation";
import { sortByRecency } from "@/lib/profile/parseRoleDate";
import { groupIssuesByField, validateProfile } from "@/lib/profile/validate";
import type { EducationEntry, ProjectEntry, RefereeEntry, WorkExperienceEntry } from "@/types";

// Work experience rows need a React key that survives removing an earlier row (array index does
// not - it shifts every later row's key, which can hand a role's stateful WinsField editor to the
// wrong role's data). `_key` is a client-only identity tag, stripped in toPayload() before the
// entry is sent anywhere.
export type WorkExperienceRow = WorkExperienceEntry & { _key: number };

const EMPTY_EXPERIENCE: WorkExperienceEntry = {
  job_title: "",
  company: "",
  location: "",
  start_date: "",
  end_date: "",
  is_current: false,
  description: "",
  wins: [],
};

const EMPTY_PROJECT: ProjectEntry = {
  title: "",
  description: "",
  context: "",
  timeframe: "",
  tools: [],
  link: "",
  outcome: "",
  outcome_metric: "",
};

const EMPTY_EDUCATION: EducationEntry = {
  degree: "",
  institution: "",
  start_date: "",
  end_date: "",
  is_current: false,
  notes: "",
};

const EMPTY_REFEREE: RefereeEntry = {
  name: "",
  title: "",
  organisation: "",
  phone: "",
  email: "",
};

export interface ProfileFieldsInitial {
  fullName?: string | null;
  work_rights?: string | null;
  phone?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  skills?: string[] | null;
  tools?: string[] | null;
  stakeholders?: string[] | null;
  work_experience?: WorkExperienceEntry[] | null;
  projects?: ProjectEntry[] | null;
  education?: EducationEntry[] | null;
  referees?: RefereeEntry[] | null;
  raw_linkedin_paste?: string | null;
}

export function useProfileFieldsState(initial: ProfileFieldsInitial) {
  const [fullName, setFullName] = useState(initial.fullName ?? "");
  const [workRights, setWorkRights] = useState(initial.work_rights ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedin_url ?? "");
  const [skills, setSkills] = useState(initial.skills?.join(", ") ?? "");
  const [tools, setTools] = useState<string[]>(initial.tools ?? []);
  const [stakeholders, setStakeholders] = useState<string[]>(initial.stakeholders ?? []);
  const nextExperienceKeyRef = useRef(0);
  // Sorted most-recent-first (same convention as generated resumes, see
  // app/api/generate-resume/route.ts) once here on load - not re-sorted on every edit, since
  // reordering a role's card out from under the user while they're mid-edit on its dates would be
  // disorienting. A newly added role stays wherever addExperience() appends it until next load.
  const [experience, setExperience] = useState<WorkExperienceRow[]>(() =>
    initial.work_experience?.length
      ? sortByRecency(normalizeWorkExperience(initial.work_experience)).map((entry) => ({
          ...EMPTY_EXPERIENCE,
          ...entry,
          _key: nextExperienceKeyRef.current++,
        }))
      : [{ ...EMPTY_EXPERIENCE, _key: nextExperienceKeyRef.current++ }]
  );

  function addExperience() {
    const _key = nextExperienceKeyRef.current++;
    setExperience((current) => [...current, { ...EMPTY_EXPERIENCE, _key }]);
  }
  const [projects, setProjects] = useState<ProjectEntry[]>(
    initial.projects?.length ? initial.projects.map((entry) => ({ ...EMPTY_PROJECT, ...entry })) : []
  );
  const [education, setEducation] = useState<EducationEntry[]>(() =>
    initial.education?.length
      ? normalizeEducation(initial.education).map((entry) => ({ ...EMPTY_EDUCATION, ...entry }))
      : [EMPTY_EDUCATION]
  );
  const [referees, setReferees] = useState<RefereeEntry[]>(
    initial.referees?.length ? initial.referees : [EMPTY_REFEREE, EMPTY_REFEREE]
  );
  const [rawLinkedinPaste, setRawLinkedinPaste] = useState(initial.raw_linkedin_paste ?? "");

  function updateEntry<T>(list: T[], index: number, patch: Partial<T>): T[] {
    return list.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
  }

  const validationIssues = useMemo(
    () =>
      validateProfile({
        fullName,
        work_rights: workRights,
        phone,
        location,
        linkedin_url: linkedinUrl,
        raw_linkedin_paste: rawLinkedinPaste,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        work_experience: experience,
        education,
        referees,
      }),
    [fullName, workRights, phone, location, linkedinUrl, rawLinkedinPaste, skills, experience, education, referees]
  );
  const issuesByField = useMemo(() => groupIssuesByField(validationIssues), [validationIssues]);

  function toPayload(completeOnboarding: boolean) {
    return {
      fullName,
      work_rights: workRights,
      phone,
      location,
      linkedin_url: linkedinUrl,
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      tools,
      stakeholders,
      work_experience: experience
        .filter((e) => e.job_title || e.company)
        .map(({ _key, ...entry }) => {
          void _key;
          return entry;
        }),
      projects: projects.filter((p) => p.title.trim()),
      education: education.filter((e) => e.degree || e.institution),
      referees: referees.filter((r) => r.name || r.email),
      raw_linkedin_paste: rawLinkedinPaste,
      completeOnboarding,
    };
  }

  return {
    fullName,
    setFullName,
    workRights,
    setWorkRights,
    phone,
    setPhone,
    location,
    setLocation,
    linkedinUrl,
    setLinkedinUrl,
    skills,
    setSkills,
    tools,
    setTools,
    stakeholders,
    setStakeholders,
    experience,
    setExperience,
    addExperience,
    projects,
    setProjects,
    education,
    setEducation,
    referees,
    setReferees,
    rawLinkedinPaste,
    setRawLinkedinPaste,
    updateEntry,
    validationIssues,
    issuesByField,
    toPayload,
  };
}

export type ProfileFieldsState = ReturnType<typeof useProfileFieldsState>;
