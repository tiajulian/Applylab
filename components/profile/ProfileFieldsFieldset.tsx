"use client";

import { useState } from "react";
import { clsx } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { ImpactField } from "@/components/profile/ImpactField";
import { MonthYearField } from "@/components/profile/MonthYearField";
import { WinsField } from "@/components/profile/WinsField";
import { RoleDutiesReview } from "@/components/profile/RoleDutiesReview";
import { SkillChips } from "@/components/resume/SkillChips";
import { isThinExperience } from "@/lib/profile/thinExperience";
import type { ProfileValidationIssue } from "@/lib/profile/validate";
import type { ProfileFieldsState } from "@/lib/profile/useProfileFieldsState";

/** Real errors (invalid date, bad email/link) always show and are never dismissible - they need a
 * clear correction. Soft hints (overlaps, empty-but-started, missing-but-optional fields) can be
 * dismissed once seen, so the form never reads like a wall of red. */
function FieldMessages({
  issues,
  dismissedIds,
  onDismiss,
}: {
  issues: ProfileValidationIssue[] | undefined;
  dismissedIds: Set<string>;
  onDismiss: (id: string) => void;
}) {
  const visible = (issues ?? []).filter((issue) => issue.severity === "error" || !dismissedIds.has(issue.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {visible.map((issue) =>
        issue.severity === "error" ? (
          <p key={issue.id} className="text-xs text-critical">
            {issue.message}
          </p>
        ) : (
          <p
            key={issue.id}
            className={clsx(
              "flex items-start gap-2 text-xs",
              // Overlaps are still a dismissible hint (concurrent roles are legitimate, see
              // checkExperienceOverlaps in lib/profile/validate.ts), but red enough to actually
              // catch the eye against the surrounding hint text.
              issue.id.startsWith("overlap-") ? "text-critical" : "text-ink-secondary"
            )}
          >
            <span>{issue.message}</span>
            <button
              type="button"
              className="shrink-0 text-ink-muted underline transition-colors duration-fast ease-editorial hover:text-ink-secondary"
              onClick={() => onDismiss(issue.id)}
            >
              Dismiss
            </button>
          </p>
        )
      )}
    </div>
  );
}

export function ProfileFieldsFieldset({ state }: { state: ProfileFieldsState }) {
  const [removingRoleIndex, setRemovingRoleIndex] = useState<number | null>(null);
  const [dismissedIssueIds, setDismissedIssueIds] = useState<Set<string>>(new Set());
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
    issuesByField,
  } = state;

  function dismissIssue(id: string) {
    setDismissedIssueIds((current) => new Set(current).add(id));
  }

  function messagesFor(field: string) {
    return (
      <FieldMessages issues={issuesByField.get(field)} dismissedIds={dismissedIssueIds} onDismiss={dismissIssue} />
    );
  }

  return (
    <>
      <Card>
        <h2 className="text-h3 font-semibold text-ink">Contact &amp; work rights</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Input
              id="fullName"
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            {messagesFor("fullName")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Input
              id="phone"
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {messagesFor("phone")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Input
              id="location"
              label="Location (Suburb, State)"
              placeholder="e.g. Parramatta, NSW"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            {messagesFor("location")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Input
              id="linkedinUrl"
              label="LinkedIn URL"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
            {messagesFor("linkedin_url")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Input
              id="workRights"
              label="Work rights"
              placeholder="e.g. Australian Permanent Resident, Full Working Rights"
              value={workRights}
              onChange={(e) => setWorkRights(e.target.value)}
            />
            {messagesFor("work_rights")}
          </div>
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
        {messagesFor("skills")}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-ink">Work experience</h2>
          <Button type="button" variant="ghost" size="sm" onClick={addExperience}>
            + Add role
          </Button>
        </div>
        {messagesFor("work_experience")}
        <StaggerList className="mt-4 flex flex-col gap-6">
          {experience.map((entry, index) => (
            <StaggerItem key={entry._key}>
              <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-6 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>
                {messagesFor(`work_experience.${index}`)}
                <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr_1fr]">
                  <Input
                    label="Location"
                    value={entry.location}
                    onChange={(e) =>
                      setExperience(updateEntry(experience, index, { location: e.target.value }))
                    }
                  />
                  <div className="flex flex-col gap-1.5">
                    <MonthYearField
                      label="Start date"
                      value={entry.start_date}
                      onChange={(value) =>
                        setExperience(updateEntry(experience, index, { start_date: value }))
                      }
                    />
                    {messagesFor(`work_experience.${index}.start_date`)}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <MonthYearField
                      label="End date"
                      value={entry.end_date}
                      disabled={entry.is_current}
                      onChange={(value) =>
                        setExperience(updateEntry(experience, index, { end_date: value }))
                      }
                    />
                    {messagesFor(`work_experience.${index}.end_date`)}
                  </div>
                </div>
                <Checkbox
                  id={`current-role-${entry._key}`}
                  label="I currently work here"
                  checked={entry.is_current}
                  onChange={(e) => {
                    const isCurrent = e.target.checked;
                    setExperience(
                      updateEntry(experience, index, {
                        is_current: isCurrent,
                        end_date: isCurrent ? "" : entry.end_date,
                      })
                    );
                  }}
                />
                <Textarea
                  label="What did you do? (bullet points or notes, we'll help shape these into strong bullets)"
                  rows={3}
                  value={entry.description}
                  onChange={(e) =>
                    setExperience(updateEntry(experience, index, { description: e.target.value }))
                  }
                />
                <div className="h-px bg-border" />
                <WinsField
                  wins={entry.wins}
                  onChange={(wins) => setExperience(updateEntry(experience, index, { wins }))}
                  jobTitle={entry.job_title}
                  company={entry.company}
                  description={entry.description}
                  tools={tools}
                  onAddTool={(tool) => setTools(tools.includes(tool) ? tools : [...tools, tool])}
                  stakeholders={stakeholders}
                  onAddStakeholder={(person) =>
                    setStakeholders(stakeholders.includes(person) ? stakeholders : [...stakeholders, person])
                  }
                />
                {isThinExperience(entry) && entry.job_title.trim() && (
                  <RoleDutiesReview
                    jobTitle={entry.job_title}
                    company={entry.company}
                    location={entry.location}
                    description={entry.description}
                    profileTools={tools}
                    onAddProfileTool={(tool) => setTools(tools.includes(tool) ? tools : [...tools, tool])}
                    profileStakeholders={stakeholders}
                    onAddProfileStakeholder={(person) =>
                      setStakeholders(stakeholders.includes(person) ? stakeholders : [...stakeholders, person])
                    }
                  />
                )}
                {experience.length > 1 && (
                  <button
                    type="button"
                    className="self-start rounded-sm text-xs text-critical transition-colors duration-fast ease-editorial hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setRemovingRoleIndex(index)}
                  >
                    Remove role
                  </button>
                )}
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      </Card>

      {removingRoleIndex !== null && (
        <ConfirmDialog
          title="Remove this role?"
          description="This deletes the role and its wins. This can't be undone."
          confirmLabel="Remove role"
          isDestructive
          onConfirm={() => {
            setExperience(experience.filter((_, i) => i !== removingRoleIndex));
            setRemovingRoleIndex(null);
          }}
          onCancel={() => setRemovingRoleIndex(null)}
        />
      )}

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
              setEducation([
                ...education,
                { degree: "", institution: "", start_date: "", end_date: "", is_current: false, notes: "" },
              ])
            }
          >
            + Add qualification
          </Button>
        </div>
        <StaggerList className="mt-4 flex flex-col gap-4">
          {education.map((entry, index) => (
            <StaggerItem key={index}>
              <div className="grid gap-3 rounded border border-border p-4 sm:grid-cols-2">
                <div className="col-span-full">{messagesFor(`education.${index}`)}</div>
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
                <div className="flex flex-col gap-1.5">
                  <MonthYearField
                    label="Start date"
                    value={entry.start_date}
                    onChange={(value) => setEducation(updateEntry(education, index, { start_date: value }))}
                  />
                  {messagesFor(`education.${index}.start_date`)}
                </div>
                <div className="flex flex-col gap-1.5">
                  <MonthYearField
                    label="End date"
                    value={entry.end_date}
                    disabled={entry.is_current}
                    onChange={(value) => setEducation(updateEntry(education, index, { end_date: value }))}
                  />
                  {messagesFor(`education.${index}.end_date`)}
                </div>
                <div className="col-span-full">
                  <Checkbox
                    id={`current-education-${index}`}
                    label="I'm currently studying this"
                    checked={entry.is_current}
                    onChange={(e) => {
                      const isCurrent = e.target.checked;
                      setEducation(
                        updateEntry(education, index, {
                          is_current: isCurrent,
                          end_date: isCurrent ? "" : entry.end_date,
                        })
                      );
                    }}
                  />
                </div>
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
                <div className="col-span-full">{messagesFor(`referees.${index}`)}</div>
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
                <div className="flex flex-col gap-1.5">
                  <Input
                    label="Phone"
                    value={entry.phone}
                    onChange={(e) => setReferees(updateEntry(referees, index, { phone: e.target.value }))}
                  />
                  {messagesFor(`referees.${index}.phone`)}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Input
                    label="Email"
                    type="email"
                    value={entry.email}
                    onChange={(e) => setReferees(updateEntry(referees, index, { email: e.target.value }))}
                  />
                  {messagesFor(`referees.${index}.email`)}
                </div>
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
