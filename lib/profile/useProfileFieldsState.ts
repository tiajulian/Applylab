"use client";

import { useState } from "react";
import type { EducationEntry, ProjectEntry, RefereeEntry, WorkExperienceEntry } from "@/types";

const EMPTY_EXPERIENCE: WorkExperienceEntry = {
  job_title: "",
  company: "",
  location: "",
  start_date: "",
  end_date: "",
  description: "",
  achievement: "",
  achievement_metric: "",
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
  year: "",
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
  const [experience, setExperience] = useState<WorkExperienceEntry[]>(
    initial.work_experience?.length
      ? initial.work_experience.map((entry) => ({ ...EMPTY_EXPERIENCE, ...entry }))
      : [EMPTY_EXPERIENCE]
  );
  const [projects, setProjects] = useState<ProjectEntry[]>(
    initial.projects?.length ? initial.projects.map((entry) => ({ ...EMPTY_PROJECT, ...entry })) : []
  );
  const [education, setEducation] = useState<EducationEntry[]>(
    initial.education?.length ? initial.education : [EMPTY_EDUCATION]
  );
  const [referees, setReferees] = useState<RefereeEntry[]>(
    initial.referees?.length ? initial.referees : [EMPTY_REFEREE, EMPTY_REFEREE]
  );
  const [rawLinkedinPaste, setRawLinkedinPaste] = useState(initial.raw_linkedin_paste ?? "");

  function updateEntry<T>(list: T[], index: number, patch: Partial<T>): T[] {
    return list.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
  }

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
      work_experience: experience.filter((e) => e.job_title || e.company),
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
    experience,
    setExperience,
    projects,
    setProjects,
    education,
    setEducation,
    referees,
    setReferees,
    rawLinkedinPaste,
    setRawLinkedinPaste,
    updateEntry,
    toPayload,
  };
}

export type ProfileFieldsState = ReturnType<typeof useProfileFieldsState>;
