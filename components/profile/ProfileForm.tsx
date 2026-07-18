"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { EducationEntry, RefereeEntry, UserProfile, WorkExperienceEntry } from "@/types";

const EMPTY_EXPERIENCE: WorkExperienceEntry = {
  job_title: "",
  company: "",
  location: "",
  start_date: "",
  end_date: "",
  description: "",
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

export function ProfileForm({
  userId,
  initialProfile,
}: {
  userId: string;
  initialProfile: UserProfile | null;
}) {
  const [workRights, setWorkRights] = useState(initialProfile?.work_rights ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [location, setLocation] = useState(initialProfile?.location ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile?.linkedin_url ?? "");
  const [skills, setSkills] = useState(initialProfile?.skills?.join(", ") ?? "");
  const [experience, setExperience] = useState<WorkExperienceEntry[]>(
    initialProfile?.work_experience?.length ? initialProfile.work_experience : [EMPTY_EXPERIENCE]
  );
  const [education, setEducation] = useState<EducationEntry[]>(
    initialProfile?.education?.length ? initialProfile.education : [EMPTY_EDUCATION]
  );
  const [referees, setReferees] = useState<RefereeEntry[]>(
    initialProfile?.referees?.length ? initialProfile.referees : [EMPTY_REFEREE, EMPTY_REFEREE]
  );
  const [rawLinkedinPaste, setRawLinkedinPaste] = useState(
    initialProfile?.raw_linkedin_paste ?? ""
  );

  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateEntry<T>(list: T[], index: number, patch: Partial<T>): T[] {
    return list.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: upsertError } = await supabase.from("user_profiles").upsert(
      {
        user_id: userId,
        work_rights: workRights,
        phone,
        location,
        linkedin_url: linkedinUrl,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        work_experience: experience.filter((e) => e.job_title || e.company),
        education: education.filter((e) => e.degree || e.institution),
        referees: referees.filter((r) => r.name || r.email),
        raw_linkedin_paste: rawLinkedinPaste,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setIsSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setSavedAt(new Date());
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-10">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-900">Contact &amp; work rights</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            id="phone"
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            id="location"
            label="Location (Suburb, State)"
            placeholder="e.g. Parramatta, NSW"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Input
            id="linkedinUrl"
            label="LinkedIn URL"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
          <Input
            id="workRights"
            label="Work rights"
            placeholder="e.g. Australian Permanent Resident — Full Working Rights"
            value={workRights}
            onChange={(e) => setWorkRights(e.target.value)}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-900">Key skills</h2>
        <p className="mt-1 text-sm text-gray-500">Comma-separated, e.g. Stakeholder Management, SQL, Project Coordination</p>
        <Textarea
          id="skills"
          className="mt-4"
          rows={2}
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Work experience</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExperience([...experience, EMPTY_EXPERIENCE])}
          >
            + Add role
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-6">
          {experience.map((entry, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Job title"
                  value={entry.job_title}
                  onChange={(e) =>
                    setExperience(updateEntry(experience, index, { job_title: e.target.value }))
                  }
                />
                <Input
                  label="Company"
                  value={entry.company}
                  onChange={(e) =>
                    setExperience(updateEntry(experience, index, { company: e.target.value }))
                  }
                />
                <Input
                  label="Location"
                  value={entry.location}
                  onChange={(e) =>
                    setExperience(updateEntry(experience, index, { location: e.target.value }))
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Start date"
                    placeholder="March 2022"
                    value={entry.start_date}
                    onChange={(e) =>
                      setExperience(updateEntry(experience, index, { start_date: e.target.value }))
                    }
                  />
                  <Input
                    label="End date"
                    placeholder="Present"
                    value={entry.end_date}
                    onChange={(e) =>
                      setExperience(updateEntry(experience, index, { end_date: e.target.value }))
                    }
                  />
                </div>
              </div>
              <Textarea
                label="What did you do? (bullet points or notes — we'll quantify and polish these)"
                rows={3}
                value={entry.description}
                onChange={(e) =>
                  setExperience(updateEntry(experience, index, { description: e.target.value }))
                }
              />
              {experience.length > 1 && (
                <button
                  type="button"
                  className="self-start text-xs text-red-600 hover:underline"
                  onClick={() => setExperience(experience.filter((_, i) => i !== index))}
                >
                  Remove role
                </button>
              )}
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
            onClick={() => setEducation([...education, EMPTY_EDUCATION])}
          >
            + Add qualification
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          {education.map((entry, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-gray-100 p-4 sm:grid-cols-2">
              <Input
                label="Degree / qualification"
                value={entry.degree}
                onChange={(e) =>
                  setEducation(updateEntry(education, index, { degree: e.target.value }))
                }
              />
              <Input
                label="Institution"
                value={entry.institution}
                onChange={(e) =>
                  setEducation(updateEntry(education, index, { institution: e.target.value }))
                }
              />
              <Input
                label="Year"
                value={entry.year}
                onChange={(e) =>
                  setEducation(updateEntry(education, index, { year: e.target.value }))
                }
              />
              <Input
                label="Notes"
                value={entry.notes}
                onChange={(e) =>
                  setEducation(updateEntry(education, index, { notes: e.target.value }))
                }
              />
              {education.length > 1 && (
                <button
                  type="button"
                  className="col-span-full self-start text-xs text-red-600 hover:underline"
                  onClick={() => setEducation(education.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              )}
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
            onClick={() => setReferees([...referees, EMPTY_REFEREE])}
          >
            + Add referee
          </Button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Australian resumes list full referee details — never &quot;available on request&quot;. Aim for at least 2.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {referees.map((entry, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-gray-100 p-4 sm:grid-cols-2">
              <Input
                label="Full name"
                value={entry.name}
                onChange={(e) =>
                  setReferees(updateEntry(referees, index, { name: e.target.value }))
                }
              />
              <Input
                label="Job title"
                value={entry.title}
                onChange={(e) =>
                  setReferees(updateEntry(referees, index, { title: e.target.value }))
                }
              />
              <Input
                label="Organisation"
                value={entry.organisation}
                onChange={(e) =>
                  setReferees(updateEntry(referees, index, { organisation: e.target.value }))
                }
              />
              <Input
                label="Phone"
                value={entry.phone}
                onChange={(e) =>
                  setReferees(updateEntry(referees, index, { phone: e.target.value }))
                }
              />
              <Input
                label="Email"
                type="email"
                value={entry.email}
                onChange={(e) =>
                  setReferees(updateEntry(referees, index, { email: e.target.value }))
                }
              />
              {referees.length > 1 && (
                <button
                  type="button"
                  className="col-span-full self-start text-xs text-red-600 hover:underline"
                  onClick={() => setReferees(referees.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-900">LinkedIn paste (optional)</h2>
        <p className="mt-1 text-sm text-gray-500">
          Paste your LinkedIn profile text here as backup context for the AI.
        </p>
        <Textarea
          className="mt-4"
          rows={6}
          value={rawLinkedinPaste}
          onChange={(e) => setRawLinkedinPaste(e.target.value)}
        />
      </section>

      <div className="flex items-center gap-4">
        <Button type="submit" isLoading={isSaving}>
          Save profile
        </Button>
        {savedAt && (
          <span className="text-sm text-gray-500">Saved at {savedAt.toLocaleTimeString()}</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
