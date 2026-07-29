"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SkillChips } from "@/components/resume/SkillChips";
import { BulletEditor } from "@/components/resume/BulletEditor";
import type {
  ResumeContent,
  ResumeEducationEntry,
  ResumeExperienceEntry,
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

  function updateExperience(index: number, patch: Partial<ResumeExperienceEntry>) {
    onChange({
      ...resume,
      experience: resume.experience.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
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
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-900">Contact</h2>
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

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-900">Professional summary</h2>
        <Textarea
          className="mt-4"
          rows={4}
          value={resume.summary}
          onChange={(e) => onChange({ ...resume, summary: e.target.value })}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-900">Key skills</h2>
        <div className="mt-4">
          <SkillChips skills={resume.skills} onChange={(skills) => onChange({ ...resume, skills })} />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Work experience</h2>
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
            <div key={index} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-4">
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
                    className="text-xs text-gray-400 hover:text-gray-700"
                    onClick={() => {
                      onChange({ ...resume, experience: moveItem(resume.experience, index, -1) });
                      setBulletIds((ids) => moveItem(ids, index, -1));
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-400 hover:text-gray-700"
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
                  <span className="text-sm font-medium text-gray-700">Bullets</span>
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
                className="self-start text-xs text-red-600 hover:underline"
                onClick={() => {
                  onChange({ ...resume, experience: resume.experience.filter((_, i) => i !== index) });
                  setBulletIds((ids) => ids.filter((_, i) => i !== index));
                }}
              >
                Remove role
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Education</h2>
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
            <div key={index} className="grid gap-3 rounded-lg border border-gray-100 p-4 sm:grid-cols-2">
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
                className="col-span-full self-start text-xs text-red-600 hover:underline"
                onClick={() => onChange({ ...resume, education: resume.education.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Referees</h2>
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
            <div key={index} className="grid gap-3 rounded-lg border border-gray-100 p-4 sm:grid-cols-2">
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
                className="col-span-full self-start text-xs text-red-600 hover:underline"
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
