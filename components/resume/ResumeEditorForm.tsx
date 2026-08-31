"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SkillChips } from "@/components/resume/SkillChips";
import { BulletEditor } from "@/components/resume/BulletEditor";
import type {
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

export function ResumeEditorForm({
  resumeId,
  resume,
  profileProjects = [],
  onChange,
}: {
  resumeId: string;
  resume: ResumeContent;
  profileProjects?: ProjectEntry[];
  onChange: (resume: ResumeContent) => void;
}) {
  const [showProfileProjectsModal, setShowProfileProjectsModal] = useState(false);

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

  // Stable client-side ids for bullets, assigned once on mount, kept in lockstep with
  // resume.experience[*].bullets through every add/remove/move operation below. bullets[]
  // is a plain string[] (shared Resume type — not changed here), so identity can't live on
  // the data itself; this parallel array is what BulletEditor is keyed by, so its local
  // in-flight assist state follows the right bullet through reorders instead of a position.
  const [bulletIds, setBulletIds] = useState<string[][]>(() =>
    resume.experience.map((entry) => entry.bullets.map(() => crypto.randomUUID()))
  );

  // Same stable-id pattern as bulletIds above, for the Projects section's own bullet lists.
  const [projectBulletIds, setProjectBulletIds] = useState<string[][]>(() =>
    resume.projects.map((entry) => entry.bullets.map(() => crypto.randomUUID()))
  );

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
    <div className="flex flex-col gap-6">
      <section className="rounded border border-border bg-surface p-6">
        <h2 className="font-sans text-h3 font-semibold text-ink">Contact</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            value={resume.contact.name}
            onChange={(e) => onChange({ ...resume, contact: { ...resume.contact, name: e.target.value } })}
          />
          <Input
            label="Phone"
            value={resume.contact.phone}
            onChange={(e) => onChange({ ...resume, contact: { ...resume.contact, phone: e.target.value } })}
          />
          <Input
            label="Email"
            value={resume.contact.email}
            onChange={(e) => onChange({ ...resume, contact: { ...resume.contact, email: e.target.value } })}
          />
          <Input
            label="Location"
            value={resume.contact.location}
            onChange={(e) => onChange({ ...resume, contact: { ...resume.contact, location: e.target.value } })}
          />
          <Input
            label="LinkedIn"
            value={resume.contact.linkedin}
            onChange={(e) => onChange({ ...resume, contact: { ...resume.contact, linkedin: e.target.value } })}
          />
          <Input
            label="Work rights"
            value={resume.contact.work_rights}
            onChange={(e) =>
              onChange({ ...resume, contact: { ...resume.contact, work_rights: e.target.value } })
            }
          />
        </div>
      </section>

      <section className="rounded border border-border bg-surface p-6">
        <h2 className="font-sans text-h3 font-semibold text-ink">Positioning line</h2>
        <p className="mt-1 text-sm text-ink-muted">
          2-3 title variants shown under your name, e.g. &apos;Operations Coordinator&apos; and close synonyms.
        </p>
        <div className="mt-4">
          <SkillChips
            skills={resume.target_titles}
            onChange={(target_titles) => onChange({ ...resume, target_titles })}
          />
        </div>
      </section>

      <section className="rounded border border-border bg-surface p-6">
        <h2 className="font-sans text-h3 font-semibold text-ink">Professional summary</h2>
        <Textarea
          className="mt-4"
          rows={7}
          value={resume.summary}
          onChange={(e) => onChange({ ...resume, summary: e.target.value })}
        />
      </section>

      <section className="rounded border border-border bg-surface p-6">
        <h2 className="font-sans text-h3 font-semibold text-ink">Key skills</h2>
        <p className="mt-1 text-sm text-ink-muted">What you do, e.g. &apos;Order Processing&apos;, &apos;Escalation Handling&apos;.</p>
        <div className="mt-4">
          <SkillChips skills={resume.skills} onChange={(skills) => onChange({ ...resume, skills })} />
        </div>
      </section>

      <section className="rounded border border-border bg-surface p-6">
        <h2 className="font-sans text-h3 font-semibold text-ink">Tools &amp; platforms</h2>
        <p className="mt-1 text-sm text-ink-muted">
          What you use, grouped by category, e.g. &apos;Data analysis: SQL, Python, R&apos;.
        </p>
        <div className="mt-4">
          <SkillChips skills={resume.tools} onChange={(tools) => onChange({ ...resume, tools })} />
        </div>
      </section>

      <section className="rounded border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-h3 font-semibold text-ink">Work experience</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange({ ...resume, experience: [...resume.experience, EMPTY_EXPERIENCE] });
              setBulletIds((ids) => [...ids, []]);
            }}
          >
            + Add role
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-6">
          {resume.experience.map((entry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex flex-col gap-3 rounded border border-border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
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
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Start date"
                      value={entry.start_date}
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
                <div className="flex flex-col gap-1 pt-6">
                  <button
                    type="button"
                    className="text-xs text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      onChange({ ...resume, experience: moveItem(resume.experience, index, -1) });
                      setBulletIds((ids) => moveItem(ids, index, -1));
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-xs text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      onChange({ ...resume, experience: moveItem(resume.experience, index, 1) });
                      setBulletIds((ids) => moveItem(ids, index, 1));
                    }}
                  >
                    ↓
                  </button>
                </div>
              </div>

              <Input
                label="Company description (optional)"
                value={entry.company_description}
                onChange={(e) => updateExperience(index, { company_description: e.target.value })}
              />

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-secondary">Bullets</span>
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
                      updateExperience(index, { bullets: entry.bullets.filter((_, i) => i !== bulletIndex) });
                      setBulletIds((ids) =>
                        ids.map((idList, i) => (i === index ? idList.filter((_, bi) => bi !== bulletIndex) : idList))
                      );
                    }}
                    onMoveUp={
                      bulletIndex > 0
                        ? () => {
                            updateExperience(index, { bullets: moveItem(entry.bullets, bulletIndex, -1) });
                            setBulletIds((ids) =>
                              ids.map((idList, i) => (i === index ? moveItem(idList, bulletIndex, -1) : idList))
                            );
                          }
                        : undefined
                    }
                    onMoveDown={
                      bulletIndex < entry.bullets.length - 1
                        ? () => {
                            updateExperience(index, { bullets: moveItem(entry.bullets, bulletIndex, 1) });
                            setBulletIds((ids) =>
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
                className="self-start text-xs text-critical hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onChange({ ...resume, experience: resume.experience.filter((_, i) => i !== index) });
                  setBulletIds((ids) => ids.filter((_, i) => i !== index));
                }}
              >
                Remove role
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="rounded border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-sans text-h3 font-semibold text-ink">Projects</h2>
          <div className="flex items-center gap-2">
            {profileProjects && profileProjects.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowProfileProjectsModal(true)}
                className="border-accent/40 bg-accent-soft/30 text-xs text-accent hover:bg-accent-soft"
              >
                + Import from profile
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange({ ...resume, projects: [...resume.projects, EMPTY_PROJECT] });
                setProjectBulletIds((ids) => [...ids, []]);
              }}
            >
              + Add blank
            </Button>
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-muted">Optional. Side work, freelance, or something you built independently.</p>
        <div className="mt-4 flex flex-col gap-6">
          {resume.projects.map((entry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex flex-col gap-3 rounded border border-border p-4"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Title"
                  value={entry.title}
                  onChange={(e) => updateProject(index, { title: e.target.value })}
                />
                <Input
                  label="Context"
                  value={entry.context}
                  onChange={(e) => updateProject(index, { context: e.target.value })}
                />
                <Input
                  label="Year"
                  value={entry.year}
                  onChange={(e) => updateProject(index, { year: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-secondary">Bullets</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      updateProject(index, { bullets: [...entry.bullets, ""] });
                      setProjectBulletIds((ids) =>
                        ids.map((idList, i) => (i === index ? [...idList, crypto.randomUUID()] : idList))
                      );
                    }}
                  >
                    + Add bullet
                  </Button>
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
                      updateProject(index, { bullets: entry.bullets.filter((_, i) => i !== bulletIndex) });
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
                className="self-start text-xs text-critical hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onChange({ ...resume, projects: resume.projects.filter((_, i) => i !== index) });
                  setProjectBulletIds((ids) => ids.filter((_, i) => i !== index));
                }}
              >
                Remove project
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {showProfileProjectsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity"
              onClick={() => setShowProfileProjectsModal(false)}
            />

            {/* Modal Dialog */}
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
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
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

      <section className="rounded border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-h3 font-semibold text-ink">Education</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...resume, education: [...resume.education, EMPTY_EDUCATION] })}
          >
            + Add qualification
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          {resume.education.map((entry, index) => (
            <div key={index} className="grid gap-3 rounded border border-border p-4 sm:grid-cols-2">
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
              <Input label="Year" value={entry.year} onChange={(e) => updateEducation(index, { year: e.target.value })} />
              <Input label="Notes" value={entry.notes} onChange={(e) => updateEducation(index, { notes: e.target.value })} />
              <button
                type="button"
                className="col-span-full self-start text-xs text-critical hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onChange({ ...resume, education: resume.education.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-h3 font-semibold text-ink">Referees</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...resume, referees: [...resume.referees, EMPTY_REFEREE] })}
          >
            + Add referee
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          {resume.referees.map((entry, index) => (
            <div key={index} className="grid gap-3 rounded border border-border p-4 sm:grid-cols-2">
              <Input label="Full name" value={entry.name} onChange={(e) => updateReferee(index, { name: e.target.value })} />
              <Input label="Job title" value={entry.title} onChange={(e) => updateReferee(index, { title: e.target.value })} />
              <Input
                label="Organisation"
                value={entry.organisation}
                onChange={(e) => updateReferee(index, { organisation: e.target.value })}
              />
              <Input label="Phone" value={entry.phone} onChange={(e) => updateReferee(index, { phone: e.target.value })} />
              <Input label="Email" value={entry.email} onChange={(e) => updateReferee(index, { email: e.target.value })} />
              <button
                type="button"
                className="col-span-full self-start text-xs text-critical hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onChange({ ...resume, referees: resume.referees.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
