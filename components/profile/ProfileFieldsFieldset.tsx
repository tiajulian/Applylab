"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Card } from "@/components/ui/Card";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { ImpactField } from "@/components/profile/ImpactField";
import { RoleDutiesReview } from "@/components/profile/RoleDutiesReview";
import { SkillChips } from "@/components/resume/SkillChips";
import { isThinExperience } from "@/lib/profile/thinExperience";
import type { ProfileFieldsState } from "@/lib/profile/useProfileFieldsState";

export function ProfileFieldsFieldset({ state }: { state: ProfileFieldsState }) {
  const {
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
  } = state;

  return (
    <>
      <Card>
        <h2 className="text-h3 font-semibold text-ink">Contact &amp; work rights</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            id="fullName"
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
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
            placeholder="e.g. Australian Permanent Resident, Full Working Rights"
            value={workRights}
            onChange={(e) => setWorkRights(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-h3 font-semibold text-ink">Key skills</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Comma-separated, e.g. Stakeholder Management, SQL, Project Coordination
        </p>
        <Textarea
          id="skills"
          className="mt-4"
          rows={2}
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
        />
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-ink">Work experience</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setExperience([
                ...experience,
                {
                  job_title: "",
                  company: "",
                  location: "",
                  start_date: "",
                  end_date: "",
                  description: "",
                  achievement: "",
                  achievement_metric: "",
                },
              ])
            }
          >
            + Add role
          </Button>
        </div>
        <StaggerList className="mt-4 flex flex-col gap-6">
          {experience.map((entry, index) => (
            <StaggerItem key={index}>
              <div className="flex flex-col gap-3 rounded border border-border p-4">
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
                  label="What did you do? (bullet points or notes, we'll quantify and polish these)"
                  rows={3}
                  value={entry.description}
                  onChange={(e) =>
                    setExperience(updateEntry(experience, index, { description: e.target.value }))
                  }
                />
                <ImpactField
                  label="Achievement or project"
                  recommended
                  description="Something you built, improved, fixed, or delivered in this role. It does not need a big number, small and specific is great."
                  textPlaceholder="built a compliance report pipeline for a new report"
                  examples="Examples: set up a weekly reconciliation that caught errors early; trained two new starters on returns and till; reorganised the stockroom so month-end ran smoothly."
                  textValue={entry.achievement}
                  onTextChange={(value) => setExperience(updateEntry(experience, index, { achievement: value }))}
                  metricValue={entry.achievement_metric}
                  onMetricChange={(value) =>
                    setExperience(updateEntry(experience, index, { achievement_metric: value }))
                  }
                />
                {isThinExperience(entry) && entry.job_title.trim() && (
                  <RoleDutiesReview jobTitle={entry.job_title} company={entry.company} location={entry.location} />
                )}
                {experience.length > 1 && (
                  <button
                    type="button"
                    className="self-start rounded-sm text-xs text-critical transition-colors duration-fast ease-editorial hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setExperience(experience.filter((_, i) => i !== index))}
                  >
                    Remove role
                  </button>
                )}
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-ink">Projects</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setProjects([
                ...projects,
                {
                  title: "",
                  description: "",
                  context: "",
                  timeframe: "",
                  tools: [],
                  link: "",
                  outcome: "",
                  outcome_metric: "",
                },
              ])
            }
          >
            + Add project
          </Button>
        </div>
        <p className="mt-1 text-sm text-ink-secondary">
          Side projects, freelance, volunteer, or study work that shows what you can do. Great for
          skills your jobs do not cover. Optional.
        </p>
        <StaggerList className="mt-4 flex flex-col gap-6">
          {projects.map((entry, index) => (
            <StaggerItem key={index}>
              <div className="flex flex-col gap-3 rounded border border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Project title"
                    value={entry.title}
                    onChange={(e) =>
                      setProjects(updateEntry(projects, index, { title: e.target.value }))
                    }
                  />
                  <Input
                    label="Who it was for (optional)"
                    placeholder="personal, a client, a course, a volunteer group"
                    value={entry.context}
                    onChange={(e) =>
                      setProjects(updateEntry(projects, index, { context: e.target.value }))
                    }
                  />
                  <Input
                    label="When (optional)"
                    value={entry.timeframe}
                    onChange={(e) =>
                      setProjects(updateEntry(projects, index, { timeframe: e.target.value }))
                    }
                  />
                  <Input
                    label="Link (optional)"
                    placeholder="portfolio, GitHub, or live URL"
                    value={entry.link}
                    onChange={(e) =>
                      setProjects(updateEntry(projects, index, { link: e.target.value }))
                    }
                  />
                </div>
                <Textarea
                  label="What it was and what you did"
                  rows={3}
                  value={entry.description}
                  onChange={(e) =>
                    setProjects(updateEntry(projects, index, { description: e.target.value }))
                  }
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink-secondary">
                    Tools or skills used (optional)
                  </label>
                  <SkillChips
                    skills={entry.tools}
                    onChange={(tools) => setProjects(updateEntry(projects, index, { tools }))}
                  />
                </div>
                <ImpactField
                  label="Outcome (optional)"
                  description="In your own words, no need for a big number."
                  textValue={entry.outcome}
                  onTextChange={(value) => setProjects(updateEntry(projects, index, { outcome: value }))}
                  metricValue={entry.outcome_metric}
                  onMetricChange={(value) => setProjects(updateEntry(projects, index, { outcome_metric: value }))}
                />
                <button
                  type="button"
                  className="self-start rounded-sm text-xs text-critical transition-colors duration-fast ease-editorial hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setProjects(projects.filter((_, i) => i !== index))}
                >
                  Remove project
                </button>
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-ink">Education</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setEducation([...education, { degree: "", institution: "", year: "", notes: "" }])
            }
          >
            + Add qualification
          </Button>
        </div>
        <StaggerList className="mt-4 flex flex-col gap-4">
          {education.map((entry, index) => (
            <StaggerItem key={index}>
              <div className="grid gap-3 rounded border border-border p-4 sm:grid-cols-2">
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
                  onChange={(e) => setEducation(updateEntry(education, index, { year: e.target.value }))}
                />
                <Input
                  label="Notes"
                  value={entry.notes}
                  onChange={(e) => setEducation(updateEntry(education, index, { notes: e.target.value }))}
                />
                {education.length > 1 && (
                  <button
                    type="button"
                    className="col-span-full self-start rounded-sm text-xs text-critical transition-colors duration-fast ease-editorial hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setEducation(education.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                )}
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-ink">Referees</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setReferees([...referees, { name: "", title: "", organisation: "", phone: "", email: "" }])
            }
          >
            + Add referee
          </Button>
        </div>
        <p className="mt-1 text-sm text-ink-secondary">
          Australian resumes list full referee details, never &quot;available on request&quot;. Aim for at
          least 2.
        </p>
        <StaggerList className="mt-4 flex flex-col gap-4">
          {referees.map((entry, index) => (
            <StaggerItem key={index}>
              <div className="grid gap-3 rounded border border-border p-4 sm:grid-cols-2">
                <Input
                  label="Full name"
                  value={entry.name}
                  onChange={(e) => setReferees(updateEntry(referees, index, { name: e.target.value }))}
                />
                <Input
                  label="Job title"
                  value={entry.title}
                  onChange={(e) => setReferees(updateEntry(referees, index, { title: e.target.value }))}
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
                  onChange={(e) => setReferees(updateEntry(referees, index, { phone: e.target.value }))}
                />
                <Input
                  label="Email"
                  type="email"
                  value={entry.email}
                  onChange={(e) => setReferees(updateEntry(referees, index, { email: e.target.value }))}
                />
                {referees.length > 1 && (
                  <button
                    type="button"
                    className="col-span-full self-start rounded-sm text-xs text-critical transition-colors duration-fast ease-editorial hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setReferees(referees.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                )}
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      </Card>

      <Card>
        <h2 className="text-h3 font-semibold text-ink">LinkedIn paste (optional)</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Paste your LinkedIn profile text here as backup context for the AI.
        </p>
        <Textarea
          className="mt-4"
          rows={6}
          value={rawLinkedinPaste}
          onChange={(e) => setRawLinkedinPaste(e.target.value)}
        />
      </Card>
    </>
  );
}
