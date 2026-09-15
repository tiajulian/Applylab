"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { moveItem } from "@/lib/resume/resumeSections";
import * as Updaters from "@/lib/resume/resumeFieldUpdaters";
import type {
  FactCheckFlag,
  ProjectEntry,
  ResumeContent,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectEntry,
  ResumeReferee,
} from "@/types";

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

export interface ReviewTargetItem {
  id: string;
  section: ResumeSectionId;
  fieldId: string;
  roleIndex?: number;
  projectIndex?: number;
  bulletIndex?: number;
  message: string;
}

const SECTION_ORDER: ResumeSectionId[] = [
  "contact",
  "target_titles",
  "summary",
  "skills",
  "tools",
  "experience",
  "projects",
  "education",
  "referees",
];

export function ResumeEditorForm({
  resumeId,
  resume,
  profileProjects = [],
  openSection = "experience",
  onSectionChange,
  flags = [],
  onReviewFlags,
  onChange,
  onCommitChange,
  onFieldBlur,
}: {
  resumeId: string;
  resume: ResumeContent;
  profileProjects?: ProjectEntry[];
  openSection?: ResumeSectionId | null;
  onSectionChange?: (section: ResumeSectionId) => void;
  flags?: FactCheckFlag[];
  onReviewFlags?: () => void;
  /** Per-keystroke edits (typing in a field) - applied immediately, checkpointed into undo
   * history later via onFieldBlur or an idle pause. */
  onChange: (resume: ResumeContent) => void;
  /** Discrete/structural edits (add, remove, reorder, import) - each call is its own undo step. */
  onCommitChange: (resume: ResumeContent) => void;
  /** Fires on blur of any field in this form (delegated on the root element below) so a pending
   * typing burst gets checkpointed into undo history without waiting for the idle timeout. */
  onFieldBlur: () => void;
}) {
  const [activeSection, setActiveSection] = useState<ResumeSectionId | null>(openSection ?? "experience");
  const [openRoleIndex, setOpenRoleIndex] = useState<number | null>(0);
  const [showProfileProjectsModal, setShowProfileProjectsModal] = useState(false);
  const [activeReviewIndex, setActiveReviewIndex] = useState<number>(0);
  const [highlightedField, setHighlightedField] = useState<{ fieldId: string; message: string } | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

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

  const completedCount = useMemo(
    () => SECTION_ORDER.filter((id) => pipStates[id] !== "empty").length,
    [pipStates]
  );

  const reviewItems = useMemo<ReviewTargetItem[]>(() => {
    const items: ReviewTargetItem[] = [];
    const addedFieldIds = new Set<string>();

    // 1. Process explicit FactCheckFlags
    flags.forEach((flag, idx) => {
      if (flag.target) {
        const t = flag.target;
        if (t.kind === "experienceBullet") {
          const fieldId = `experience-bullet-${t.index}-${t.bulletIndex}`;
          items.push({
            id: `flag-${idx}`,
            section: "experience",
            fieldId,
            roleIndex: t.index,
            bulletIndex: t.bulletIndex,
            message: flag.message || "Bullet missing metric",
          });
          addedFieldIds.add(fieldId);
        } else if (t.kind === "experienceHeader") {
          const fieldId = `experience-role-${t.index}-${t.field}`;
          items.push({
            id: `flag-${idx}`,
            section: "experience",
            fieldId,
            roleIndex: t.index,
            message: flag.message || "Role detail needs review",
          });
          addedFieldIds.add(fieldId);
        } else if (t.kind === "summary") {
          const fieldId = "summary-field";
          items.push({
            id: `flag-${idx}`,
            section: "summary",
            fieldId,
            message: flag.message || "Positioning statement too short",
          });
          addedFieldIds.add(fieldId);
        } else if (t.kind === "skill") {
          const fieldId = "skills-field";
          items.push({
            id: `flag-${idx}`,
            section: "skills",
            fieldId,
            message: flag.message || "Skill claim needs review",
          });
          addedFieldIds.add(fieldId);
        } else if (t.kind === "tool") {
          const fieldId = "tools-field";
          items.push({
            id: `flag-${idx}`,
            section: "tools",
            fieldId,
            message: flag.message || "Tool claim needs review",
          });
          addedFieldIds.add(fieldId);
        } else if (t.kind === "education") {
          const fieldId = `education-${t.index}-${t.field}`;
          items.push({
            id: `flag-${idx}`,
            section: "education",
            fieldId,
            message: flag.message || "Education qualification needs review",
          });
          addedFieldIds.add(fieldId);
        } else if (t.kind === "referee") {
          const fieldId = `referee-${t.index}-name`;
          items.push({
            id: `flag-${idx}`,
            section: "referees",
            fieldId,
            message: flag.message || "Referee details need review",
          });
          addedFieldIds.add(fieldId);
        } else if (t.kind === "projectBullet") {
          const fieldId = `project-bullet-${t.index}-${t.bulletIndex}`;
          items.push({
            id: `flag-${idx}`,
            section: "projects",
            fieldId,
            projectIndex: t.index,
            bulletIndex: t.bulletIndex,
            message: flag.message || "Project bullet needs review",
          });
          addedFieldIds.add(fieldId);
        } else if (t.kind === "projectHeader") {
          const fieldId = `project-${t.index}-${t.field}`;
          items.push({
            id: `flag-${idx}`,
            section: "projects",
            fieldId,
            projectIndex: t.index,
            message: flag.message || "Project detail needs review",
          });
          addedFieldIds.add(fieldId);
        }
      } else {
        const loc = (flag.location || "").toLowerCase();
        let section: ResumeSectionId = "experience";
        let fieldId = "experience-field";
        if (loc.includes("contact")) {
          section = "contact";
          fieldId = "contact-name";
        } else if (loc.includes("summary")) {
          section = "summary";
          fieldId = "summary-field";
        } else if (loc.includes("skill")) {
          section = "skills";
          fieldId = "skills-field";
        } else if (loc.includes("tool")) {
          section = "tools";
          fieldId = "tools-field";
        } else if (loc.includes("education")) {
          section = "education";
          fieldId = "education-field";
        } else if (loc.includes("referee")) {
          section = "referees";
          fieldId = "referees-field";
        } else if (loc.includes("project")) {
          section = "projects";
          fieldId = "projects-field";
        }
        items.push({
          id: `flag-${idx}`,
          section,
          fieldId,
          message: flag.message || "Section needs review",
        });
      }
    });

    // 2. Identify missing / incomplete section fields
    if (!resume.contact.name.trim() && !addedFieldIds.has("contact-name")) {
      items.push({
        id: "missing-contact-name",
        section: "contact",
        fieldId: "contact-name",
        message: "Full name is missing",
      });
      addedFieldIds.add("contact-name");
    }

    if (resume.target_titles.length === 0 && !addedFieldIds.has("target_titles-field")) {
      items.push({
        id: "missing-target-titles",
        section: "target_titles",
        fieldId: "target_titles-field",
        message: "Positioning statement too short",
      });
      addedFieldIds.add("target_titles-field");
    }

    if (!resume.summary.trim() && !addedFieldIds.has("summary-field")) {
      items.push({
        id: "missing-summary",
        section: "summary",
        fieldId: "summary-field",
        message: "Professional summary is missing",
      });
      addedFieldIds.add("summary-field");
    }

    if (resume.skills.length === 0 && !addedFieldIds.has("skills-field")) {
      items.push({
        id: "missing-skills",
        section: "skills",
        fieldId: "skills-field",
        message: "Add key skills",
      });
      addedFieldIds.add("skills-field");
    }

    if ((!resume.tools || resume.tools.length === 0) && !addedFieldIds.has("tools-field")) {
      items.push({
        id: "missing-tools",
        section: "tools",
        fieldId: "tools-field",
        message: "Add tools & platforms",
      });
      addedFieldIds.add("tools-field");
    }

    if (resume.experience.length === 0 && !addedFieldIds.has("experience-field")) {
      items.push({
        id: "missing-experience",
        section: "experience",
        fieldId: "experience-field",
        message: "Add work experience role",
      });
      addedFieldIds.add("experience-field");
    } else {
      resume.experience.forEach((role, i) => {
        const titleFieldId = `experience-role-${i}-job_title`;
        if (!role.job_title.trim() && !addedFieldIds.has(titleFieldId)) {
          items.push({
            id: `missing-role-${i}-title`,
            section: "experience",
            fieldId: titleFieldId,
            roleIndex: i,
            message: "Job title is missing",
          });
          addedFieldIds.add(titleFieldId);
        }
        const compFieldId = `experience-role-${i}-company`;
        if (!role.company.trim() && !addedFieldIds.has(compFieldId)) {
          items.push({
            id: `missing-role-${i}-company`,
            section: "experience",
            fieldId: compFieldId,
            roleIndex: i,
            message: "Company name is missing",
          });
          addedFieldIds.add(compFieldId);
        }
        if (role.bullets.length === 0) {
          const bulletAreaId = `experience-role-${i}-bullets`;
          if (!addedFieldIds.has(bulletAreaId)) {
            items.push({
              id: `missing-role-${i}-bullets`,
              section: "experience",
              fieldId: bulletAreaId,
              roleIndex: i,
              message: "Add achievement bullets",
            });
            addedFieldIds.add(bulletAreaId);
          }
        } else {
          role.bullets.forEach((b, bi) => {
            const bFieldId = `experience-bullet-${i}-${bi}`;
            if (!b.trim() && !addedFieldIds.has(bFieldId)) {
              items.push({
                id: `empty-bullet-${i}-${bi}`,
                section: "experience",
                fieldId: bFieldId,
                roleIndex: i,
                bulletIndex: bi,
                message: "Bullet missing metric",
              });
              addedFieldIds.add(bFieldId);
            }
          });
        }
      });
    }

    if (resume.education.length === 0 && !addedFieldIds.has("education-field")) {
      items.push({
        id: "missing-education",
        section: "education",
        fieldId: "education-field",
        message: "Add education / qualification",
      });
      addedFieldIds.add("education-field");
    }

    return items;
  }, [flags, resume]);

  function handleJumpToReview() {
    if (reviewItems.length === 0) return;

    const item = reviewItems[activeReviewIndex % reviewItems.length];
    setActiveReviewIndex((prev) => (prev + 1) % reviewItems.length);

    // 1. Expand section
    setActiveSection(item.section);
    if (onSectionChange) {
      onSectionChange(item.section);
    }

    // 2. Expand role in experience if applicable
    if (item.roleIndex !== undefined) {
      setOpenRoleIndex(item.roleIndex);
    }

    // 3. Highlight field & set tooltip
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setHighlightedField({ fieldId: item.fieldId, message: item.message });

    highlightTimerRef.current = setTimeout(() => {
      setHighlightedField(null);
    }, 7000);

    // 4. Smoothly scroll to the target field or section
    setTimeout(() => {
      const el = document.getElementById(item.fieldId) || document.getElementById(`section-${item.section}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
  }

  function updateContact(field: keyof ResumeContent["contact"], value: string) {
    onChange(Updaters.updateContact(resume, field, value));
  }

  // Text-field patches only (typing, checkpointed later via blur/idle - see onFieldBlur).
  // Bullet add/remove/move are discrete actions dispatched directly at their call sites below via
  // the dedicated Updaters.*Bullet functions, each wrapped in onCommitChange there instead of here.
  function updateExperience(index: number, patch: Partial<ResumeExperienceEntry>) {
    onChange(Updaters.updateExperience(resume, index, patch));
  }

  function updateProject(index: number, patch: Partial<ResumeProjectEntry>) {
    onChange(Updaters.updateProject(resume, index, patch));
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

    onCommitChange(Updaters.addProject(resume, newProjectEntry));
    setProjectBulletIds((ids) => [newBulletIds, ...ids]);
  }

  function updateEducation(index: number, patch: Partial<ResumeEducationEntry>) {
    onChange(Updaters.updateEducation(resume, index, patch));
  }

  function updateReferee(index: number, patch: Partial<ResumeReferee>) {
    onChange(Updaters.updateReferee(resume, index, patch));
  }

  return (
    // onBlur here relies on React's bubbling synthetic focus events (unlike native DOM blur) to
    // checkpoint whichever field lost focus, without needing an onBlur handler on every input.
    <div className="flex flex-col gap-3 pb-8" onBlur={onFieldBlur}>
      {/* Progress strip: interactive badge that jumps directly to problem */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface/70 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={handleJumpToReview}
            disabled={reviewItems.length === 0}
            aria-label={`Status: ${completedCount} of ${SECTION_ORDER.length} complete${
              reviewItems.length > 0 ? `, ${reviewItems.length} to review` : ""
            }. Click to jump to problem.`}
            className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold transition-all duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              reviewItems.length > 0
                ? "bg-attention-soft text-attention hover:bg-attention/20 border border-attention/30 cursor-pointer shadow-xs"
                : "bg-success-soft text-success border border-success/30 cursor-default"
            }`}
          >
            <span>
              {completedCount} of {SECTION_ORDER.length} complete
            </span>
            {reviewItems.length > 0 ? (
              <>
                <span className="opacity-60">•</span>
                <span className="inline-flex items-center gap-1">
                  {reviewItems.length} to review
                  <span aria-hidden="true">⚠️</span>
                </span>
              </>
            ) : (
              <>
                <span className="opacity-60">•</span>
                <span className="inline-flex items-center gap-1">
                  <CheckIcon className="h-3 w-3" strokeWidth={2.75} />
                  Complete
                </span>
              </>
            )}
          </button>
          <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-pill bg-paper-deep">
            <div
              className="h-full rounded-pill bg-success transition-[width] duration-slow ease-editorial"
              style={{ width: `${(completedCount / SECTION_ORDER.length) * 100}%` }}
            />
          </div>
        </div>
        {flags.length > 0 && onReviewFlags && (
          <button
            type="button"
            onClick={onReviewFlags}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-attention-soft px-2.5 py-1 text-xs font-semibold text-attention transition-colors hover:bg-attention/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AlertCircleIcon className="h-3.5 w-3.5" strokeWidth={2.75} />
            <span>
              {flags.length} flag details →
            </span>
          </button>
        )}
      </div>

      {/* Header & Summary */}
      <h2 className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted first:mt-0">
        Header &amp; Summary
      </h2>

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
            id="contact-name"
            label="Full name"
            value={resume.contact.name}
            isHighlighted={highlightedField?.fieldId === "contact-name"}
            tooltipMessage={highlightedField?.fieldId === "contact-name" ? highlightedField.message : undefined}
            onChange={(e) => {
              if (highlightedField?.fieldId === "contact-name") setHighlightedField(null);
              updateContact("name", e.target.value);
            }}
          />
          <Input
            id="contact-phone"
            label="Phone"
            value={resume.contact.phone}
            isHighlighted={highlightedField?.fieldId === "contact-phone"}
            tooltipMessage={highlightedField?.fieldId === "contact-phone" ? highlightedField.message : undefined}
            onChange={(e) => {
              if (highlightedField?.fieldId === "contact-phone") setHighlightedField(null);
              updateContact("phone", e.target.value);
            }}
          />
          <Input
            id="contact-email"
            label="Email"
            value={resume.contact.email}
            isHighlighted={highlightedField?.fieldId === "contact-email"}
            tooltipMessage={highlightedField?.fieldId === "contact-email" ? highlightedField.message : undefined}
            onChange={(e) => {
              if (highlightedField?.fieldId === "contact-email") setHighlightedField(null);
              updateContact("email", e.target.value);
            }}
          />
          <Input
            id="contact-location"
            label="Location"
            value={resume.contact.location}
            isHighlighted={highlightedField?.fieldId === "contact-location"}
            tooltipMessage={highlightedField?.fieldId === "contact-location" ? highlightedField.message : undefined}
            onChange={(e) => {
              if (highlightedField?.fieldId === "contact-location") setHighlightedField(null);
              updateContact("location", e.target.value);
            }}
          />
          <Input
            id="contact-linkedin"
            label="LinkedIn"
            value={resume.contact.linkedin}
            isHighlighted={highlightedField?.fieldId === "contact-linkedin"}
            tooltipMessage={highlightedField?.fieldId === "contact-linkedin" ? highlightedField.message : undefined}
            onChange={(e) => {
              if (highlightedField?.fieldId === "contact-linkedin") setHighlightedField(null);
              updateContact("linkedin", e.target.value);
            }}
          />
          <Input
            id="contact-work_rights"
            label="Work rights"
            value={resume.contact.work_rights}
            isHighlighted={highlightedField?.fieldId === "contact-work_rights"}
            tooltipMessage={highlightedField?.fieldId === "contact-work_rights" ? highlightedField.message : undefined}
            onChange={(e) => {
              if (highlightedField?.fieldId === "contact-work_rights") setHighlightedField(null);
              updateContact("work_rights", e.target.value);
            }}
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
        <div
          id="target_titles-field"
          className={`relative rounded-lg p-2.5 transition-all ${
            highlightedField?.fieldId === "target_titles-field"
              ? "animate-pulse-amber border border-attention ring-2 ring-attention/40 bg-attention-soft/10"
              : ""
          }`}
        >
          <AnimatePresence>
            {highlightedField?.fieldId === "target_titles-field" && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 2, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute -top-7 right-0 z-30 inline-flex items-center gap-1.5 rounded-lg border border-attention/40 bg-attention-soft px-2.5 py-0.5 text-xs font-semibold text-attention shadow-pop pointer-events-none"
              >
                <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                <span>{highlightedField.message}</span>
                <div className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 border-b border-r border-attention/40 bg-attention-soft" />
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-xs text-ink-muted mb-3">
            2-3 title variants shown under your name, e.g. Operations Coordinator and close synonyms.
          </p>
          <SkillChips
            skills={resume.target_titles}
            onChange={(target_titles) => {
              if (highlightedField?.fieldId === "target_titles-field") setHighlightedField(null);
              onCommitChange(Updaters.setTargetTitles(resume, target_titles));
            }}
          />
        </div>
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
        <div
          id="summary-field"
          className={`relative rounded-lg transition-all ${
            highlightedField?.fieldId === "summary-field"
              ? "animate-pulse-amber border border-attention ring-2 ring-attention/40 bg-attention-soft/10 p-1"
              : ""
          }`}
        >
          <AnimatePresence>
            {highlightedField?.fieldId === "summary-field" && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 2, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute -top-7 right-0 z-30 inline-flex items-center gap-1.5 rounded-lg border border-attention/40 bg-attention-soft px-2.5 py-0.5 text-xs font-semibold text-attention shadow-pop pointer-events-none"
              >
                <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                <span>{highlightedField.message}</span>
                <div className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 border-b border-r border-attention/40 bg-attention-soft" />
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-xs text-ink-muted mb-2">
            A concise overview of your background, strengths, and target direction.
          </p>
          <textarea
            rows={5}
            value={resume.summary}
            placeholder="Brief summary of your experience..."
            onChange={(e) => {
              if (highlightedField?.fieldId === "summary-field") setHighlightedField(null);
              onChange({ ...resume, summary: e.target.value });
            }}
            className="w-full rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </SectionAccordion>

      {/* Experience */}
      <h2 className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        Experience
      </h2>

      {/* 4. Key skills */}
      <SectionAccordion
        id="skills"
        title="Key skills"
        summary={summaries.skills}
        pipState={pipStates.skills}
        isOpen={activeSection === "skills"}
        onToggle={() => handleToggleSection("skills")}
      >
        <div
          id="skills-field"
          className={`relative rounded-lg p-2.5 transition-all ${
            highlightedField?.fieldId === "skills-field"
              ? "animate-pulse-amber border border-attention ring-2 ring-attention/40 bg-attention-soft/10"
              : ""
          }`}
        >
          <AnimatePresence>
            {highlightedField?.fieldId === "skills-field" && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 2, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute -top-7 right-0 z-30 inline-flex items-center gap-1.5 rounded-lg border border-attention/40 bg-attention-soft px-2.5 py-0.5 text-xs font-semibold text-attention shadow-pop pointer-events-none"
              >
                <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                <span>{highlightedField.message}</span>
                <div className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 border-b border-r border-attention/40 bg-attention-soft" />
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-xs text-ink-muted mb-3">
            What you do, e.g. Order Processing, Escalation Handling, Data Modeling.
          </p>
          <SkillChips
            skills={resume.skills}
            onChange={(skills) => {
              if (highlightedField?.fieldId === "skills-field") setHighlightedField(null);
              onCommitChange(Updaters.setSkills(resume, skills));
            }}
          />
        </div>
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
        <div
          id="tools-field"
          className={`relative rounded-lg p-2.5 transition-all ${
            highlightedField?.fieldId === "tools-field"
              ? "animate-pulse-amber border border-attention ring-2 ring-attention/40 bg-attention-soft/10"
              : ""
          }`}
        >
          <AnimatePresence>
            {highlightedField?.fieldId === "tools-field" && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 2, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute -top-7 right-0 z-30 inline-flex items-center gap-1.5 rounded-lg border border-attention/40 bg-attention-soft px-2.5 py-0.5 text-xs font-semibold text-attention shadow-pop pointer-events-none"
              >
                <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                <span>{highlightedField.message}</span>
                <div className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 border-b border-r border-attention/40 bg-attention-soft" />
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-xs text-ink-muted mb-3">
            What you use, grouped by category, e.g. Data analysis: SQL, Python, Snowflake.
          </p>
          <SkillChips
            skills={resume.tools}
            onChange={(tools) => {
              if (highlightedField?.fieldId === "tools-field") setHighlightedField(null);
              onCommitChange(Updaters.setTools(resume, tools));
            }}
          />
        </div>
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
              onCommitChange(Updaters.addExperience(resume));
              setBulletIds((ids) => [[], ...ids]);
              setOpenRoleIndex(0);
            }}
            className="text-xs py-1 px-2.5 text-accent hover:text-accent hover:bg-accent-soft/40"
          >
            + Add role
          </Button>
        }
      >
        <div id="experience-field" className="flex flex-col gap-3">
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
                        onCommitChange(Updaters.moveExperience(resume, index, -1));
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
                        onCommitChange(Updaters.moveExperience(resume, index, 1));
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
                        onCommitChange(Updaters.removeExperience(resume, index));
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
                          id={`experience-role-${index}-job_title`}
                          label="Job title"
                          value={entry.job_title}
                          isHighlighted={highlightedField?.fieldId === `experience-role-${index}-job_title`}
                          tooltipMessage={
                            highlightedField?.fieldId === `experience-role-${index}-job_title`
                              ? highlightedField.message
                              : undefined
                          }
                          onChange={(e) => {
                            if (highlightedField?.fieldId === `experience-role-${index}-job_title`) {
                              setHighlightedField(null);
                            }
                            updateExperience(index, { job_title: e.target.value });
                          }}
                        />
                        <Input
                          id={`experience-role-${index}-company`}
                          label="Company"
                          value={entry.company}
                          isHighlighted={highlightedField?.fieldId === `experience-role-${index}-company`}
                          tooltipMessage={
                            highlightedField?.fieldId === `experience-role-${index}-company`
                              ? highlightedField.message
                              : undefined
                          }
                          onChange={(e) => {
                            if (highlightedField?.fieldId === `experience-role-${index}-company`) {
                              setHighlightedField(null);
                            }
                            updateExperience(index, { company: e.target.value });
                          }}
                        />
                        <Input
                          id={`experience-role-${index}-location`}
                          label="Location"
                          value={entry.location}
                          isHighlighted={highlightedField?.fieldId === `experience-role-${index}-location`}
                          tooltipMessage={
                            highlightedField?.fieldId === `experience-role-${index}-location`
                              ? highlightedField.message
                              : undefined
                          }
                          onChange={(e) => updateExperience(index, { location: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            id={`experience-role-${index}-dates`}
                            label="Start date"
                            value={entry.start_date}
                            placeholder="e.g. 2023"
                            isHighlighted={highlightedField?.fieldId === `experience-role-${index}-dates`}
                            tooltipMessage={
                              highlightedField?.fieldId === `experience-role-${index}-dates`
                                ? highlightedField.message
                                : undefined
                            }
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
                            id={`experience-role-${index}-bullets`}
                            onClick={() => {
                              onCommitChange(Updaters.addExperienceBullet(resume, index));
                              setBulletIds((ids) =>
                                ids.map((idList, i) => (i === index ? [crypto.randomUUID(), ...idList] : idList))
                              );
                            }}
                            className="text-xs py-1 px-2 text-accent hover:text-accent hover:bg-accent-soft/30"
                          >
                            + Add bullet
                          </Button>
                        </div>

                        {entry.bullets.map((bullet, bulletIndex) => (
                          <BulletEditor
                            id={`experience-bullet-${index}-${bulletIndex}`}
                            isHighlighted={highlightedField?.fieldId === `experience-bullet-${index}-${bulletIndex}`}
                            tooltipMessage={
                              highlightedField?.fieldId === `experience-bullet-${index}-${bulletIndex}`
                                ? highlightedField.message
                                : undefined
                            }
                            key={bulletIds[index]?.[bulletIndex] ?? `${index}-${bulletIndex}`}
                            resumeId={resumeId}
                            roleTitle={entry.job_title}
                            roleCompany={entry.company}
                            value={bullet}
                            onChange={(value) => {
                              if (highlightedField?.fieldId === `experience-bullet-${index}-${bulletIndex}`) {
                                setHighlightedField(null);
                              }
                              onChange(Updaters.updateExperienceBullet(resume, index, bulletIndex, value));
                            }}
                            onRemove={() => {
                              onCommitChange(Updaters.removeExperienceBullet(resume, index, bulletIndex));
                              setBulletIds((ids) =>
                                ids.map((idList, i) =>
                                  i === index ? idList.filter((_, bi) => bi !== bulletIndex) : idList
                                )
                              );
                            }}
                            onMoveUp={
                              bulletIndex > 0
                                ? () => {
                                    onCommitChange(Updaters.moveExperienceBullet(resume, index, bulletIndex, -1));
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
                                    onCommitChange(Updaters.moveExperienceBullet(resume, index, bulletIndex, 1));
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
                onCommitChange(Updaters.addProject(resume));
                setProjectBulletIds((ids) => [[], ...ids]);
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

        <div id="projects-field" className="flex flex-col gap-4">
          {resume.projects.map((entry, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-lg border border-border/80 bg-paper/30 p-3.5">
              <div className="grid gap-2.5 sm:grid-cols-3">
                <Input
                  id={`project-${index}-title`}
                  label="Title"
                  value={entry.title}
                  isHighlighted={highlightedField?.fieldId === `project-${index}-title`}
                  tooltipMessage={
                    highlightedField?.fieldId === `project-${index}-title`
                      ? highlightedField.message
                      : undefined
                  }
                  onChange={(e) => {
                    if (highlightedField?.fieldId === `project-${index}-title`) setHighlightedField(null);
                    updateProject(index, { title: e.target.value });
                  }}
                />
                <Input
                  id={`project-${index}-context`}
                  label="Context / Tools"
                  value={entry.context}
                  onChange={(e) => updateProject(index, { context: e.target.value })}
                />
                <Input
                  id={`project-${index}-year`}
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
                      onCommitChange(Updaters.addProjectBullet(resume, index));
                      setProjectBulletIds((ids) =>
                        ids.map((idList, i) => (i === index ? [crypto.randomUUID(), ...idList] : idList))
                      );
                    }}
                    className="text-xs text-accent hover:underline"
                  >
                    + Add bullet
                  </button>
                </div>

                {entry.bullets.map((bullet, bulletIndex) => (
                  <BulletEditor
                    id={`project-bullet-${index}-${bulletIndex}`}
                    isHighlighted={highlightedField?.fieldId === `project-bullet-${index}-${bulletIndex}`}
                    tooltipMessage={
                      highlightedField?.fieldId === `project-bullet-${index}-${bulletIndex}`
                        ? highlightedField.message
                        : undefined
                    }
                    key={projectBulletIds[index]?.[bulletIndex] ?? `${index}-${bulletIndex}`}
                    resumeId={resumeId}
                    roleTitle={entry.title}
                    roleCompany={entry.context}
                    value={bullet}
                    onChange={(value) => {
                      if (highlightedField?.fieldId === `project-bullet-${index}-${bulletIndex}`) {
                        setHighlightedField(null);
                      }
                      onChange(Updaters.updateProjectBullet(resume, index, bulletIndex, value));
                    }}
                    onRemove={() => {
                      onCommitChange(Updaters.removeProjectBullet(resume, index, bulletIndex));
                      setProjectBulletIds((ids) =>
                        ids.map((idList, i) => (i === index ? idList.filter((_, bi) => bi !== bulletIndex) : idList))
                      );
                    }}
                    onMoveUp={
                      bulletIndex > 0
                        ? () => {
                            onCommitChange(Updaters.moveProjectBullet(resume, index, bulletIndex, -1));
                            setProjectBulletIds((ids) =>
                              ids.map((idList, i) => (i === index ? moveItem(idList, bulletIndex, -1) : idList))
                            );
                          }
                        : undefined
                    }
                    onMoveDown={
                      bulletIndex < entry.bullets.length - 1
                        ? () => {
                            onCommitChange(Updaters.moveProjectBullet(resume, index, bulletIndex, 1));
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
                  onCommitChange(Updaters.removeProject(resume, index));
                  setProjectBulletIds((ids) => ids.filter((_, i) => i !== index));
                }}
              >
                Remove project
              </button>
            </div>
          ))}
        </div>
      </SectionAccordion>

      {/* Additional */}
      <h2 className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        Additional
      </h2>

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
              onCommitChange(Updaters.addEducation(resume));
            }}
            className="rounded px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft/40 transition-colors"
          >
            + Add qualification
          </button>
        }
      >
        <div id="education-field" className="flex flex-col gap-3">
          {resume.education.map((entry, index) => (
            <div key={index} className="grid gap-2.5 rounded-lg border border-border/80 bg-paper/30 p-3.5 sm:grid-cols-2">
              <Input
                id={`education-${index}-degree`}
                label="Degree / qualification"
                value={entry.degree}
                isHighlighted={highlightedField?.fieldId === `education-${index}-degree`}
                tooltipMessage={
                  highlightedField?.fieldId === `education-${index}-degree`
                    ? highlightedField.message
                    : undefined
                }
                onChange={(e) => {
                  if (highlightedField?.fieldId === `education-${index}-degree`) setHighlightedField(null);
                  updateEducation(index, { degree: e.target.value });
                }}
              />
              <Input
                id={`education-${index}-institution`}
                label="Institution"
                value={entry.institution}
                isHighlighted={highlightedField?.fieldId === `education-${index}-institution`}
                tooltipMessage={
                  highlightedField?.fieldId === `education-${index}-institution`
                    ? highlightedField.message
                    : undefined
                }
                onChange={(e) => {
                  if (highlightedField?.fieldId === `education-${index}-institution`) setHighlightedField(null);
                  updateEducation(index, { institution: e.target.value });
                }}
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
                onClick={() =>
                  onCommitChange(Updaters.removeEducation(resume, index))
                }
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
              onCommitChange(Updaters.addReferee(resume));
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

        <div id="referees-field" className="flex flex-col gap-3">
          {resume.referees.map((entry, index) => (
            <div key={index} className="grid gap-2.5 rounded-lg border border-border/80 bg-paper/30 p-3.5 sm:grid-cols-2">
              <Input
                id={`referee-${index}-name`}
                label="Full name"
                value={entry.name}
                isHighlighted={highlightedField?.fieldId === `referee-${index}-name`}
                tooltipMessage={
                  highlightedField?.fieldId === `referee-${index}-name`
                    ? highlightedField.message
                    : undefined
                }
                onChange={(e) => {
                  if (highlightedField?.fieldId === `referee-${index}-name`) setHighlightedField(null);
                  updateReferee(index, { name: e.target.value });
                }}
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
                onClick={() =>
                  onCommitChange(Updaters.removeReferee(resume, index))
                }
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
