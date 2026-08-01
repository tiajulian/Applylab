"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SkillChips } from "@/components/resume/SkillChips";
import { BulletEditor } from "@/components/resume/BulletEditor";
import type {
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
  onChange,
}: {
  resumeId: string;
  resume: ResumeContent;
  onChange: (resume: ResumeContent) => void;
}) {
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
          rows={4}
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
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-h3 font-semibold text-ink">Projects</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange({ ...resume, projects: [...resume.projects, EMPTY_PROJECT] });
              setProjectBulletIds((ids) => [...ids, []]);
            }}
          >
            + Add project
          </Button>
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
