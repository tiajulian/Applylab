"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SkillChips } from "@/components/resume/SkillChips";
import { BulletEditor } from "@/components/resume/BulletEditor";
import { SectionAccordion, type SectionPipState } from "@/components/resume/SectionAccordion";
import {
  AlertCircleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  TrashIcon,
} from "@/components/ui/icons/LucideIcons";
import type {
  FactCheckFlag,
  ProjectEntry,
  ResumeContent,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectEntry,
  ResumeReferee,
} from "@/types";

const EMPTY_EXPERIENCE: ResumeExperienceEntry = {
  job_title: "",
  company: "",
  company_description: "",
  location: "",
  start_date: "",
  end_date: "",
  bullets: [],
};

const EMPTY_EDUCATION: ResumeEducationEntry = { degree: "", institution: "", year: "", notes: "" };
const EMPTY_REFEREE: ResumeReferee = { name: "", title: "", organisation: "", phone: "", email: "" };
const EMPTY_PROJECT: ResumeProjectEntry = { title: "", context: "", year: "", bullets: [] };

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

export type ResumeSectionId =
  | "contact"
  | "target_titles"
  | "summary"
  | "skills"
  | "tools"
  | "experience"
  | "projects"
  | "education"
  | "referees";

export function ResumeEditorForm({
  resumeId,
  resume,
  profileProjects = [],
  openSection = "experience",
  onSectionChange,
  flags = [],
  onReviewFlags,
  onChange,
}: {
  resumeId: string;
  resume: ResumeContent;
  profileProjects?: ProjectEntry[];
  openSection?: ResumeSectionId | null;
  onSectionChange?: (section: ResumeSectionId) => void;
  flags?: FactCheckFlag[];
  onReviewFlags?: () => void;
  onChange: (resume: ResumeContent) => void;
}) {
  const [activeSection, setActiveSection] = useState<ResumeSectionId | null>(openSection ?? "experience");
  const [openRoleIndex, setOpenRoleIndex] = useState<number | null>(0);
  const [showProfileProjectsModal, setShowProfileProjectsModal] = useState(false);

  // Synchronize internal activeSection if parent prop updates
  useEffect(() => {
    if (openSection !== undefined) {
      setActiveSection(openSection);
    }
  }, [openSection]);

  function handleToggleSection(section: ResumeSectionId) {
    const next = activeSection === section ? null : section;
    setActiveSection(next);
    if (next && onSectionChange) {
      onSectionChange(next);
    }
  }

  // Stable bullet IDs for experience bullets
  const [bulletIds, setBulletIds] = useState<string[][]>(() =>
    resume.experience.map((entry) => entry.bullets.map(() => crypto.randomUUID()))
  );

  // Stable bullet IDs for project bullets
  const [projectBulletIds, setProjectBulletIds] = useState<string[][]>(() =>
    resume.projects.map((entry) => entry.bullets.map(() => crypto.randomUUID()))
  );

  useEffect(() => {
    if (!showProfileProjectsModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowProfileProjectsModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showProfileProjectsModal]);

  // Section summary strings
  const summaries = useMemo(() => {
    const contactParts = [
      resume.contact.name,
      resume.contact.email,
      resume.contact.phone,
      resume.contact.location,
    ].filter(Boolean);

    const expBulletCount = resume.experience.reduce((sum, e) => sum + e.bullets.length, 0);
    const summaryWordCount = resume.summary.trim()
      ? resume.summary.trim().split(/\s+/).length
      : 0;

    return {
      contact: contactParts.length > 0 ? contactParts.slice(0, 3).join(", ") : "Nothing added yet",
      target_titles:
        resume.target_titles.length > 0
          ? `${resume.target_titles.length} ${resume.target_titles.length === 1 ? "title" : "titles"}`
          : "None added",
      summary: summaryWordCount > 0 ? `${summaryWordCount} words` : "Nothing added yet",
      skills:
        resume.skills.length > 0
          ? `${resume.skills.length} ${resume.skills.length === 1 ? "skill" : "skills"}`
          : "None added",
      tools:
        resume.tools && resume.tools.length > 0
          ? `${resume.tools.length} ${resume.tools.length === 1 ? "tool category" : "tool categories"}`
          : "None added",
      experience:
        resume.experience.length > 0
          ? `${resume.experience.length} ${resume.experience.length === 1 ? "role" : "roles"}, ${expBulletCount} ${expBulletCount === 1 ? "bullet" : "bullets"}`
          : "No roles added yet",
      projects:
        resume.projects && resume.projects.length > 0
          ? `${resume.projects.length} ${resume.projects.length === 1 ? "project" : "projects"}`
          : "None added (optional)",
      education:
        resume.education.length > 0
          ? `${resume.education.length} ${resume.education.length === 1 ? "qualification" : "qualifications"}`
          : "None added",
      referees:
        resume.referees && resume.referees.length > 0
          ? `${resume.referees.length} ${resume.referees.length === 1 ? "referee" : "referees"}`
          : "Available upon request (optional)",
    };
  }, [resume]);

  // Section pip states (done, flagged, empty)
  const pipStates = useMemo<Record<ResumeSectionId, SectionPipState>>(() => {
    const hasFlags = (kind: string) =>
      flags.some((f) => f.target && "kind" in f.target && f.target.kind.toLowerCase().includes(kind));

    return {
      contact:
        !resume.contact.name.trim()
          ? "empty"
          : hasFlags("contact")
          ? "flagged"
          : "done",
      target_titles: resume.target_titles.length > 0 ? "done" : "empty",
      summary:
        !resume.summary.trim()
          ? "empty"
          : flags.some((f) => f.target && f.target.kind === "summary")
          ? "flagged"
          : "done",
      skills:
        resume.skills.length === 0
          ? "empty"
          : hasFlags("skill")
          ? "flagged"
          : "done",
      tools:
        !resume.tools || resume.tools.length === 0
          ? "empty"
          : hasFlags("tool")
          ? "flagged"
          : "done",
      experience:
        resume.experience.length === 0
          ? "empty"
          : hasFlags("experience")
          ? "flagged"
          : "done",
      projects:
        !resume.projects || resume.projects.length === 0
          ? "empty"
          : hasFlags("project")
          ? "flagged"
          : "done",
      education:
        resume.education.length === 0
          ? "empty"
          : hasFlags("education")
          ? "flagged"
          : "done",
      referees:
        !resume.referees || resume.referees.length === 0
          ? "empty"
          : hasFlags("referee")
          ? "flagged"
          : "done",
    };
  }, [resume, flags]);

  function updateContact(field: keyof ResumeContent["contact"], value: string) {
    onChange({ ...resume, contact: { ...resume.contact, [field]: value } });
  }

  function updateExperience(index: number, patch: Partial<ResumeExperienceEntry>) {
    onChange({
      ...resume,
      experience: resume.experience.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    });
  }

  function updateProject(index: number, patch: Partial<ResumeProjectEntry>) {
    onChange({
      ...resume,
      projects: resume.projects.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    });
  }

  function handleImportProject(proj: ProjectEntry) {
    const bullets: string[] = [];
    if (proj.description) {
      const lines = proj.description
        .split(/\r?\n|•/)
        .map((l) => l.trim().replace(/^[-*]\s*/, ""))
        .filter(Boolean);
      bullets.push(...lines);
    }
    if (proj.outcome?.trim()) {
      const outcomeText = proj.outcome_metric?.trim()
        ? `${proj.outcome.trim()} (${proj.outcome_metric.trim()})`
        : proj.outcome.trim();
      bullets.push(outcomeText);
    }
    if (proj.link?.trim()) {
      bullets.push(`Project link: ${proj.link.trim()}`);
    }

    const newProjectEntry: ResumeProjectEntry = {
      title: proj.title.trim() || "Untitled Project",
      context: proj.context?.trim() || (proj.tools && proj.tools.length > 0 ? proj.tools.join(", ") : ""),
      year: proj.timeframe?.trim() || "",
      bullets: bullets.length > 0 ? bullets : [""],
    };

    const newBulletIds = newProjectEntry.bullets.map(() => crypto.randomUUID());

    onChange({
      ...resume,
      projects: [...resume.projects, newProjectEntry],
    });
    setProjectBulletIds((ids) => [...ids, newBulletIds]);
  }

  function updateEducation(index: number, patch: Partial<ResumeEducationEntry>) {
    onChange({
      ...resume,
      education: resume.education.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    });
  }

  function updateReferee(index: number, patch: Partial<ResumeReferee>) {
    onChange({
      ...resume,
      referees: resume.referees.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    });
  }

  return (
    <div className="flex flex-col gap-3 pb-8">
      {/* Top Review Flags Card */}
      {flags.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent-soft/50 p-3.5 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent font-bold text-xs">
              !
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                {flags.length} {flags.length === 1 ? "Thing to check" : "Things to check"}
              </span>
              <p className="text-xs text-ink-secondary truncate">
                {flags.slice(0, 2).map((f) => f.location || f.message).join(", ")}
                {flags.length > 2 ? `, +${flags.length - 2} more` : ""}
              </p>
            </div>
          </div>
          {onReviewFlags && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onReviewFlags}
              className="shrink-0 text-xs font-semibold px-3 py-1.5"
            >
              Review
            </Button>
          )}
        </div>
      )}

      {/* 1. Contact */}
      <SectionAccordion
        id="contact"
        title="Contact"
        summary={summaries.contact}
        pipState={pipStates.contact}
        isOpen={activeSection === "contact"}
        onToggle={() => handleToggleSection("contact")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Full name"
            value={resume.contact.name}
            onChange={(e) => updateContact("name", e.target.value)}
          />
          <Input
            label="Phone"
            value={resume.contact.phone}
            onChange={(e) => updateContact("phone", e.target.value)}
          />
          <Input
            label="Email"
            value={resume.contact.email}
            onChange={(e) => updateContact("email", e.target.value)}
          />
          <Input
            label="Location"
            value={resume.contact.location}
            onChange={(e) => updateContact("location", e.target.value)}
          />
          <Input
            label="LinkedIn"
            value={resume.contact.linkedin}
            onChange={(e) => updateContact("linkedin", e.target.value)}
          />
          <Input
            label="Work rights"
            value={resume.contact.work_rights}
            onChange={(e) => updateContact("work_rights", e.target.value)}
          />
        </div>
      </SectionAccordion>

      {/* 2. Positioning line */}
      <SectionAccordion
        id="target_titles"
        title="Positioning line"
        summary={summaries.target_titles}
        pipState={pipStates.target_titles}
        isOpen={activeSection === "target_titles"}
        onToggle={() => handleToggleSection("target_titles")}
      >
        <p className="text-xs text-ink-muted mb-3">
          2-3 title variants shown under your name, e.g. Operations Coordinator and close synonyms.
        </p>
        <SkillChips
          skills={resume.target_titles}
          onChange={(target_titles) => onChange({ ...resume, target_titles })}
        />
      </SectionAccordion>

      {/* 3. Professional summary */}
      <SectionAccordion
        id="summary"
        title="Professional summary"
        summary={summaries.summary}
        pipState={pipStates.summary}
        isOpen={activeSection === "summary"}
        onToggle={() => handleToggleSection("summary")}
      >
        <p className="text-xs text-ink-muted mb-2">
          A concise overview of your background, strengths, and target direction.
        </p>
        <textarea
          rows={5}
          value={resume.summary}
          placeholder="Brief summary of your experience..."
          onChange={(e) => onChange({ ...resume, summary: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </SectionAccordion>

      {/* 4. Key skills */}
      <SectionAccordion
        id="skills"
        title="Key skills"
        summary={summaries.skills}
        pipState={pipStates.skills}
        isOpen={activeSection === "skills"}
        onToggle={() => handleToggleSection("skills")}
      >
        <p className="text-xs text-ink-muted mb-3">
          What you do, e.g. Order Processing, Escalation Handling, Data Modeling.
        </p>
        <SkillChips
          skills={resume.skills}
          onChange={(skills) => onChange({ ...resume, skills })}
        />
      </SectionAccordion>

      {/* 5. Tools & platforms */}
      <SectionAccordion
        id="tools"
        title="Tools & platforms"
        summary={summaries.tools}
        pipState={pipStates.tools}
        isOpen={activeSection === "tools"}
        onToggle={() => handleToggleSection("tools")}
      >
        <p className="text-xs text-ink-muted mb-3">
          What you use, grouped by category, e.g. Data analysis: SQL, Python, Snowflake.
        </p>
        <SkillChips
          skills={resume.tools}
          onChange={(tools) => onChange({ ...resume, tools })}
        />
      </SectionAccordion>

      {/* 6. Work experience (Default Open) */}
      <SectionAccordion
        id="experience"
        title="Work experience"
        summary={summaries.experience}
        pipState={pipStates.experience}
        isOpen={activeSection === "experience"}
        onToggle={() => handleToggleSection("experience")}
        headerAction={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const nextExperience = [...resume.experience, EMPTY_EXPERIENCE];
              onChange({ ...resume, experience: nextExperience });
              setBulletIds((ids) => [...ids, []]);
              setOpenRoleIndex(nextExperience.length - 1);
            }}
            className="text-xs py-1 px-2.5 text-accent hover:text-accent hover:bg-accent-soft/40"
          >
            + Add role
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {resume.experience.map((entry, index) => {
            const isRoleOpen = openRoleIndex === index;
            const roleTitle = entry.job_title.trim() || "Untitled role";
            const roleCompany = entry.company.trim() || "Company";
            const roleDate = entry.start_date || entry.end_date ? `${entry.start_date} - ${entry.end_date || "Present"}` : "";
            const isDone = Boolean(entry.job_title.trim() && entry.company.trim() && entry.bullets.length > 0);

            return (
              <div
                key={index}
                className="rounded-lg border border-border/80 bg-paper/30 overflow-hidden transition-colors"
              >
                {/* Collapsed/Expanded Role Bar */}
                <div
                  className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-paper-deep/40 transition-colors"
                  onClick={() => setOpenRoleIndex(isRoleOpen ? null : index)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        isDone ? "bg-success-soft text-success text-[10px]" : "border border-border"
                      }`}
                    >
                      {isDone && <CheckIcon className="h-2.5 w-2.5" strokeWidth={2.75} />}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-ink truncate leading-tight">
                        {roleTitle} <span className="font-normal text-ink-muted">· {roleCompany}</span>
                      </span>
                      {roleDate && (
                        <span className="text-[11px] text-ink-muted truncate mt-0.5">{roleDate}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="rounded bg-paper-deep px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                      {entry.bullets.length} {entry.bullets.length === 1 ? "bullet" : "bullets"}
                    </span>
                    <button
                      type="button"
                      aria-label="Move role up"
                      title="Move up"
                      disabled={index === 0}
                      className="rounded p-1 text-ink-muted hover:bg-paper-deep hover:text-ink disabled:opacity-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        onChange({ ...resume, experience: moveItem(resume.experience, index, -1) });
                        setBulletIds((ids) => moveItem(ids, index, -1));
                        setOpenRoleIndex(Math.max(0, index - 1));
                      }}
                    >
                      <ArrowUpIcon className="h-3 w-3" strokeWidth={2.75} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move role down"
                      title="Move down"
                      disabled={index === resume.experience.length - 1}
                      className="rounded p-1 text-ink-muted hover:bg-paper-deep hover:text-ink disabled:opacity-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        onChange({ ...resume, experience: moveItem(resume.experience, index, 1) });
                        setBulletIds((ids) => moveItem(ids, index, 1));
                        setOpenRoleIndex(Math.min(resume.experience.length - 1, index + 1));
                      }}
                    >
                      <ArrowDownIcon className="h-3 w-3" strokeWidth={2.75} />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove role"
                      title="Remove role"
                      className="rounded p-1 text-ink-muted hover:bg-critical/10 hover:text-critical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        onChange({ ...resume, experience: resume.experience.filter((_, i) => i !== index) });
                        setBulletIds((ids) => ids.filter((_, i) => i !== index));
                        setOpenRoleIndex(null);
                      }}
                    >
                      <TrashIcon className="h-3 w-3" strokeWidth={2.75} />
                    </button>
                    <button
                      type="button"
                      aria-expanded={isRoleOpen}
                      aria-label={isRoleOpen ? "Collapse role" : "Expand role"}
                      onClick={() => setOpenRoleIndex(isRoleOpen ? null : index)}
                      className="rounded p-1 text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ChevronDownIcon
                        className={`h-4 w-4 transition-transform ${isRoleOpen ? "rotate-180 text-ink" : ""}`}
                        strokeWidth={2.75}
                      />
                    </button>
                  </div>
                </div>

                {/* Expanded Role Fields & Bullets */}
                <AnimatePresence initial={false}>
                  {isRoleOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
                      className="overflow-hidden border-t border-border/60 p-4 bg-surface"
                    >
                      <div className="grid gap-3 sm:grid-cols-2 mb-3">
                        <Input
                          label="Job title"
                          value={entry.job_title}
                          onChange={(e) => updateExperience(index, { job_title: e.target.value })}
                        />
                        <Input
                          label="Company"
                          value={entry.company}
                          onChange={(e) => updateExperience(index, { company: e.target.value })}
                        />
                        <Input
                          label="Location"
                          value={entry.location}
                          onChange={(e) => updateExperience(index, { location: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            label="Start date"
                            value={entry.start_date}
                            placeholder="e.g. 2023"
                            onChange={(e) => updateExperience(index, { start_date: e.target.value })}
                          />
                          <Input
                            label="End date"
                            placeholder="Present"
                            value={entry.end_date}
                            onChange={(e) => updateExperience(index, { end_date: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="mb-4">
                        <Input
                          label="Company description (optional)"
                          value={entry.company_description}
                          onChange={(e) => updateExperience(index, { company_description: e.target.value })}
                        />
                      </div>

                      {/* Bullets List */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                            Achievement Bullets
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              updateExperience(index, { bullets: [...entry.bullets, ""] });
                              setBulletIds((ids) =>
                                ids.map((idList, i) => (i === index ? [...idList, crypto.randomUUID()] : idList))
                              );
                            }}
                            className="text-xs py-1 px-2 text-accent hover:text-accent hover:bg-accent-soft/30"
                          >
                            + Add bullet
                          </Button>
                        </div>

                        {entry.bullets.map((bullet, bulletIndex) => (
                          <BulletEditor
                            key={bulletIds[index]?.[bulletIndex] ?? `${index}-${bulletIndex}`}
                            resumeId={resumeId}
                            roleTitle={entry.job_title}
                            roleCompany={entry.company}
                            value={bullet}
                            onChange={(value) =>
                              updateExperience(index, {
                                bullets: entry.bullets.map((b, i) => (i === bulletIndex ? value : b)),
                              })
                            }
                            onRemove={() => {
                              updateExperience(index, {
                                bullets: entry.bullets.filter((_, i) => i !== bulletIndex),
                              });
                              setBulletIds((ids) =>
                                ids.map((idList, i) =>
                                  i === index ? idList.filter((_, bi) => bi !== bulletIndex) : idList
                                )
                              );
                            }}
                            onMoveUp={
                              bulletIndex > 0
                                ? () => {
                                    updateExperience(index, {
                                      bullets: moveItem(entry.bullets, bulletIndex, -1),
                                    });
                                    setBulletIds((ids) =>
                                      ids.map((idList, i) =>
                                        i === index ? moveItem(idList, bulletIndex, -1) : idList
                                      )
                                    );
                                  }
                                : undefined
                            }
                            onMoveDown={
                              bulletIndex < entry.bullets.length - 1
                                ? () => {
                                    updateExperience(index, {
                                      bullets: moveItem(entry.bullets, bulletIndex, 1),
                                    });
                                    setBulletIds((ids) =>
                                      ids.map((idList, i) =>
                                        i === index ? moveItem(idList, bulletIndex, 1) : idList
                                      )
                                    );
                                  }
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </SectionAccordion>

      {/* 7. Projects */}
      <SectionAccordion
        id="projects"
        title="Projects"
        summary={summaries.projects}
        pipState={pipStates.projects}
        isOpen={activeSection === "projects"}
        onToggle={() => handleToggleSection("projects")}
        headerAction={
          <div className="flex items-center gap-1.5">
            {profileProjects && profileProjects.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfileProjectsModal(true);
                }}
                className="rounded px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft/40 transition-colors"
              >
                + Import
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...resume, projects: [...resume.projects, EMPTY_PROJECT] });
                setProjectBulletIds((ids) => [...ids, []]);
              }}
              className="rounded px-2 py-1 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              + Blank
            </button>
          </div>
        }
      >
        <p className="text-xs text-ink-muted mb-3">
          Optional. Side work, open source, or independent initiatives.
        </p>

        <div className="flex flex-col gap-4">
          {resume.projects.map((entry, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-lg border border-border/80 bg-paper/30 p-3.5">
              <div className="grid gap-2.5 sm:grid-cols-3">
                <Input
                  label="Title"
                  value={entry.title}
                  onChange={(e) => updateProject(index, { title: e.target.value })}
                />
                <Input
                  label="Context / Tools"
                  value={entry.context}
                  onChange={(e) => updateProject(index, { context: e.target.value })}
                />
                <Input
                  label="Year"
                  value={entry.year}
                  onChange={(e) => updateProject(index, { year: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Project Bullets</span>
                  <button
                    type="button"
                    onClick={() => {
                      updateProject(index, { bullets: [...entry.bullets, ""] });
                      setProjectBulletIds((ids) =>
                        ids.map((idList, i) => (i === index ? [...idList, crypto.randomUUID()] : idList))
                      );
                    }}
                    className="text-xs text-accent hover:underline"
                  >
                    + Add bullet
                  </button>
                </div>

                {entry.bullets.map((bullet, bulletIndex) => (
                  <BulletEditor
                    key={projectBulletIds[index]?.[bulletIndex] ?? `${index}-${bulletIndex}`}
                    resumeId={resumeId}
                    roleTitle={entry.title}
                    roleCompany={entry.context}
                    value={bullet}
                    onChange={(value) =>
                      updateProject(index, {
                        bullets: entry.bullets.map((b, i) => (i === bulletIndex ? value : b)),
                      })
                    }
                    onRemove={() => {
                      updateProject(index, {
                        bullets: entry.bullets.filter((_, i) => i !== bulletIndex),
                      });
                      setProjectBulletIds((ids) =>
                        ids.map((idList, i) => (i === index ? idList.filter((_, bi) => bi !== bulletIndex) : idList))
                      );
                    }}
                    onMoveUp={
                      bulletIndex > 0
                        ? () => {
                            updateProject(index, { bullets: moveItem(entry.bullets, bulletIndex, -1) });
                            setProjectBulletIds((ids) =>
                              ids.map((idList, i) => (i === index ? moveItem(idList, bulletIndex, -1) : idList))
                            );
                          }
                        : undefined
                    }
                    onMoveDown={
                      bulletIndex < entry.bullets.length - 1
                        ? () => {
                            updateProject(index, { bullets: moveItem(entry.bullets, bulletIndex, 1) });
                            setProjectBulletIds((ids) =>
                              ids.map((idList, i) => (i === index ? moveItem(idList, bulletIndex, 1) : idList))
                            );
                          }
                        : undefined
                    }
                  />
                ))}
              </div>

              <button
                type="button"
                className="self-start text-xs text-critical hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pt-1"
                onClick={() => {
                  onChange({ ...resume, projects: resume.projects.filter((_, i) => i !== index) });
                  setProjectBulletIds((ids) => ids.filter((_, i) => i !== index));
                }}
              >
                Remove project
              </button>
            </div>
          ))}
        </div>
      </SectionAccordion>

      {/* 8. Education */}
      <SectionAccordion
        id="education"
        title="Education"
        summary={summaries.education}
        pipState={pipStates.education}
        isOpen={activeSection === "education"}
        onToggle={() => handleToggleSection("education")}
        headerAction={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ ...resume, education: [...resume.education, EMPTY_EDUCATION] });
            }}
            className="rounded px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft/40 transition-colors"
          >
            + Add qualification
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          {resume.education.map((entry, index) => (
            <div key={index} className="grid gap-2.5 rounded-lg border border-border/80 bg-paper/30 p-3.5 sm:grid-cols-2">
              <Input
                label="Degree / qualification"
                value={entry.degree}
                onChange={(e) => updateEducation(index, { degree: e.target.value })}
              />
              <Input
                label="Institution"
                value={entry.institution}
                onChange={(e) => updateEducation(index, { institution: e.target.value })}
              />
              <Input
                label="Year"
                value={entry.year}
                onChange={(e) => updateEducation(index, { year: e.target.value })}
              />
              <Input
                label="Notes (optional)"
                value={entry.notes}
                onChange={(e) => updateEducation(index, { notes: e.target.value })}
              />
              <button
                type="button"
                className="col-span-full self-start text-xs text-critical hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onChange({ ...resume, education: resume.education.filter((_, i) => i !== index) })}
              >
                Remove qualification
              </button>
            </div>
          ))}
        </div>
      </SectionAccordion>

      {/* 9. Referees */}
      <SectionAccordion
        id="referees"
        title="Referees"
        summary={summaries.referees}
        pipState={pipStates.referees}
        isOpen={activeSection === "referees"}
        onToggle={() => handleToggleSection("referees")}
        headerAction={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ ...resume, referees: [...resume.referees, EMPTY_REFEREE] });
            }}
            className="rounded px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft/40 transition-colors"
          >
            + Add referee
          </button>
        }
      >
        <p className="text-xs text-ink-muted mb-3">
          Optional. If left blank, your resume will display &quot;Referees available upon request&quot;.
        </p>

        <div className="flex flex-col gap-3">
          {resume.referees.map((entry, index) => (
            <div key={index} className="grid gap-2.5 rounded-lg border border-border/80 bg-paper/30 p-3.5 sm:grid-cols-2">
              <Input
                label="Full name"
                value={entry.name}
                onChange={(e) => updateReferee(index, { name: e.target.value })}
              />
              <Input
                label="Job title"
                value={entry.title}
                onChange={(e) => updateReferee(index, { title: e.target.value })}
              />
              <Input
                label="Organisation"
                value={entry.organisation}
                onChange={(e) => updateReferee(index, { organisation: e.target.value })}
              />
              <Input
                label="Phone"
                value={entry.phone}
                onChange={(e) => updateReferee(index, { phone: e.target.value })}
              />
              <Input
                label="Email"
                value={entry.email}
                onChange={(e) => updateReferee(index, { email: e.target.value })}
              />
              <button
                type="button"
                className="col-span-full self-start text-xs text-critical hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onChange({ ...resume, referees: resume.referees.filter((_, i) => i !== index) })}
              >
                Remove referee
              </button>
            </div>
          ))}
        </div>
      </SectionAccordion>

      {/* Import Projects Modal */}
      <AnimatePresence>
        {showProfileProjectsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity"
              onClick={() => setShowProfileProjectsModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-surface shadow-pop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="import-projects-title"
            >
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <h3 id="import-projects-title" className="font-display text-h3 text-ink">
                    Import Projects from Profile
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Add projects from your profile directly into this resume.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileProjectsModal(false)}
                  className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto p-5">
                {profileProjects.map((proj, idx) => {
                  const added = resume.projects.some(
                    (p) => p.title.trim().toLowerCase() === proj.title.trim().toLowerCase()
                  );
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col gap-2 rounded-lg border p-4 transition-all ${
                        added ? "border-success/30 bg-success-soft/30" : "border-border bg-paper/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col min-w-0">
                          <span className="font-display text-sm font-bold text-ink truncate">
                            {proj.title}
                          </span>
                          {proj.context && (
                            <span className="text-xs text-ink-secondary truncate">{proj.context}</span>
                          )}
                          {proj.timeframe && (
                            <span className="text-[11px] text-ink-muted">{proj.timeframe}</span>
                          )}
                        </div>
                        {added ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-success/20 px-2 py-0.5 text-xs font-semibold text-success">
                            ✓ Added
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleImportProject(proj)}
                            className="shrink-0 bg-accent text-on-accent text-xs"
                          >
                            + Add to resume
                          </Button>
                        )}
                      </div>

                      {proj.tools && proj.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {proj.tools.map((t) => (
                            <span
                              key={t}
                              className="rounded bg-paper-deep px-1.5 py-0.5 text-[10px] text-ink-secondary"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {proj.description && (
                        <p className="line-clamp-2 text-xs text-ink-muted mt-0.5">
                          {proj.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end border-t border-border p-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowProfileProjectsModal(false)}
                >
                  Done
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
