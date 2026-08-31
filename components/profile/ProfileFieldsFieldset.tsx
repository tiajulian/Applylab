"use client";

import { useEffect, useRef, useState } from "react";
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
import { RoleCard } from "@/components/profile/RoleCard";
import { ProjectCard } from "@/components/profile/ProjectCard";
import { SkillChips } from "@/components/resume/SkillChips";
import { isEducationEntryEmpty, isProjectEntryEmpty } from "@/lib/profile/emptyEntry";
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

type RemovalKind = "role" | "project" | "education";

const REMOVAL_COPY: Record<RemovalKind, { title: string; description: string; confirmLabel: string }> = {
  role: {
    title: "Remove this role?",
    description: "This deletes the role and its wins. This can't be undone.",
    confirmLabel: "Remove role",
  },
  project: { title: "Remove this project?", description: "This can't be undone.", confirmLabel: "Remove project" },
  education: {
    title: "Remove this qualification?",
    description: "This can't be undone.",
    confirmLabel: "Remove qualification",
  },
};

export function ProfileFieldsFieldset({ state }: { state: ProfileFieldsState }) {
  // Single shared pending-removal slot for every destructive action below (role/project/education)
  // instead of one index-state and one ConfirmDialog per section - same dialog, same
  // wiring, only the copy (REMOVAL_COPY above) and which list gets filtered differ by kind.
  const [pendingRemoval, setPendingRemoval] = useState<{ kind: RemovalKind; index: number } | null>(null);
  const [dismissedIssueIds, setDismissedIssueIds] = useState<Set<string>>(new Set());
  // Compact-row overrides for Education (see lib/profile/emptyEntry.ts): an index in
  // here always renders full, regardless of emptiness, so tapping "+ Add" on a blank default row
  // opens that same row in place instead of a second one being created next to it.
  const [expandedEduIndexes, setExpandedEduIndexes] = useState<Set<number>>(new Set());
  // "Grab skills from work experience" state
  const [isGrabbingSkills, setIsGrabbingSkills] = useState(false);
  const [grabSkillsError, setGrabSkillsError] = useState<string | null>(null);
  const [suggestedSkills, setSuggestedSkills] = useState<string[] | null>(null);
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

  // Only one role expanded at a time - starts on the first role. A role added later (via "+ Add
  // role" or the effect below) becomes the expanded one so a candidate can start filling it in
  // straight away, rather than having to find and tap it in the collapsed list.
  const [expandedRoleKey, setExpandedRoleKey] = useState<number | null>(() => experience[0]?._key ?? null);
  const prevExperienceLengthRef = useRef(experience.length);
  useEffect(() => {
    if (experience.length > prevExperienceLengthRef.current) {
      const last = experience[experience.length - 1];
      if (last) setExpandedRoleKey(last._key);
    }
    prevExperienceLengthRef.current = experience.length;
  }, [experience]);

  function dismissIssue(id: string) {
    setDismissedIssueIds((current) => new Set(current).add(id));
  }

  function performPendingRemoval() {
    if (!pendingRemoval) return;
    const { kind, index } = pendingRemoval;
    if (kind === "role") setExperience(experience.filter((_, i) => i !== index));
    else if (kind === "project") setProjects(projects.filter((_, i) => i !== index));
    else if (kind === "education") setEducation(education.filter((_, i) => i !== index));
    setPendingRemoval(null);
  }

  function messagesFor(field: string) {
    return (
      <FieldMessages issues={issuesByField.get(field)} dismissedIds={dismissedIssueIds} onDismiss={dismissIssue} />
    );
  }

  // Lets a bullet's own tagged tools be added straight to Key skills (e.g. from a work-experience
  // win's "+ tool" chips) without ever creating a duplicate - comparison is case-insensitive since
  // "SQL" and "sql" typed in different places should count as the same skill.
  function addSkills(newSkills: string[]) {
    const existing = skills.split(",").map((s) => s.trim()).filter(Boolean);
    const existingLower = new Set(existing.map((s) => s.toLowerCase()));
    const toAdd: string[] = [];
    for (const raw of newSkills) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (existingLower.has(lower)) continue;
      existingLower.add(lower);
      toAdd.push(trimmed);
    }
    if (toAdd.length === 0) return;
    setSkills([...existing, ...toAdd].join(", "));
  }

  // Extracts key skills and tools directly from the candidate's work experience bullets,
  // descriptions, role titles, and tagged tools.
  async function handleGrabSkills() {
    setGrabSkillsError(null);
    setSuggestedSkills(null);

    const experienceBullets = experience
      .map((entry) => {
        const parts: string[] = [];
        const roleHeader = [entry.job_title, entry.company].filter(Boolean).join(" at ");
        if (roleHeader) parts.push(`Role: ${roleHeader}`);
        if (entry.description?.trim()) parts.push(entry.description.trim());
        for (const win of entry.wins) {
          if (win.text?.trim()) parts.push(win.text.trim());
          if (win.what?.trim()) parts.push(win.what.trim());
          if (win.outcome?.trim()) parts.push(win.outcome.trim());
        }
        return parts.join("\n");
      })
      .filter(Boolean)
      .join("\n\n");

    const roleTools = experience.flatMap((e) => e.wins.flatMap((w) => w.tools ?? []));
    const allLocalTools = [...tools, ...roleTools].filter(Boolean);

    if (!experienceBullets.trim() && allLocalTools.length === 0) {
      setGrabSkillsError(
        "Please add a job title, bullet points, or duties in the Work Experience section first."
      );
      return;
    }

    setIsGrabbingSkills(true);

    try {
      const candidateSkills: string[] = [...allLocalTools];

      if (experienceBullets.trim()) {
        const response = await fetch("/api/profile/extract-skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ experienceText: experienceBullets }),
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok && Array.isArray(data.skills)) {
          candidateSkills.push(...data.skills);
        } else if (!response.ok) {
          setGrabSkillsError(data.error ?? "Failed to extract skills. Please try again.");
          return;
        }
      }

      const existingLower = new Set(
        skills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      );
      const seenLower = new Set<string>();
      const deduped: string[] = [];
      for (const candidate of candidateSkills) {
        if (typeof candidate !== "string") continue;
        const trimmed = candidate.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (seenLower.has(lower) || existingLower.has(lower)) continue;
        seenLower.add(lower);
        deduped.push(trimmed);
      }

      setSuggestedSkills(deduped);
      if (deduped.length === 0) {
        setGrabSkillsError(
          candidateSkills.length === 0
            ? "Could not extract skills from your work experience. Try adding more bullet details."
            : "No new skills found - your Key skills already cover everything in your work experience."
        );
      }
    } catch {
      setGrabSkillsError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsGrabbingSkills(false);
    }
  }

  return (
    <>
      <div id="contact">
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
      </div>

      <div id="experience">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-h3 font-semibold text-ink">Work experience</h2>
            <Button type="button" variant="ghost" size="sm" onClick={addExperience}>
              + Add role
            </Button>
          </div>
          {messagesFor("work_experience")}

        <StaggerList className="mt-4 flex flex-col gap-3">
          {experience.map((entry, index) => (
            <StaggerItem key={entry._key}>
              <RoleCard
                entry={entry}
                index={index}
                isExpanded={entry._key === expandedRoleKey}
                onToggleExpand={() =>
                  setExpandedRoleKey((current) => (current === entry._key ? null : entry._key))
                }
                onUpdate={(patch) => setExperience((prev) => updateEntry(prev, index, patch))}
                onRemove={(hasContent) => {
                  if (hasContent) {
                    setPendingRemoval({ kind: "role", index });
                  } else {
                    setExperience((prev) => prev.filter((_, i) => i !== index));
                  }
                }}
                canRemove={experience.length > 1}
                tools={tools}
                onAddTool={(tool) => setTools(tools.includes(tool) ? tools : [...tools, tool])}
                stakeholders={stakeholders}
                onAddStakeholder={(person) =>
                  setStakeholders(stakeholders.includes(person) ? stakeholders : [...stakeholders, person])
                }
                onAddSkills={addSkills}
                messagesFor={messagesFor}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      </Card>
      </div>

      <div id="skills">
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

          <div className="mt-5 rounded-lg border border-border/80 bg-paper-deep/30 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-ink">Not sure what to add?</h3>
                <p className="text-xs text-ink-secondary">
                  We can pull relevant skills directly from your work experience bullets.
                </p>
              </div>

              <button
                type="button"
                disabled={isGrabbingSkills}
                onClick={handleGrabSkills}
                className="inline-flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-semibold text-orange-600 transition-all duration-fast ease-editorial hover:border-orange-300 hover:bg-orange-100/80 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
              >
                <div className="flex items-center gap-2">
                  {isGrabbingSkills ? (
                    <svg
                      className="h-4 w-4 animate-spin text-orange-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4 shrink-0 text-orange-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m15 4-1.5 4.5L9 10l4.5 1.5L15 16l1.5-4.5L21 10l-4.5-1.5Z" />
                      <path d="m6 4-1 2.5L2.5 7.5 5 8.5 6 11l1-2.5 2.5-1L7 6.5Z" />
                    </svg>
                  )}
                  <span>
                    {isGrabbingSkills ? "Extracting skills..." : "Grab skills from work experience"}
                  </span>
                </div>
                {!isGrabbingSkills && (
                  <svg
                    className="h-4 w-4 shrink-0 text-orange-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>
            </div>

            {grabSkillsError && (
              <p className="mt-3 text-xs text-critical">
                {grabSkillsError}
              </p>
            )}

            {suggestedSkills && suggestedSkills.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink">
                    Found {suggestedSkills.length} relevant skill{suggestedSkills.length > 1 ? "s" : ""}:
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-xs font-semibold text-orange-600 underline hover:text-orange-700"
                      onClick={() => {
                        addSkills(suggestedSkills);
                        setSuggestedSkills(null);
                      }}
                    >
                      + Add all
                    </button>
                    <button
                      type="button"
                      className="text-xs text-ink-muted underline hover:text-ink"
                      onClick={() => setSuggestedSkills(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {suggestedSkills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      title={`Add "${skill}" to your key skills`}
                      className="rounded-pill border border-orange-200 bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:border-orange-300 hover:text-orange-600"
                      onClick={() => {
                        addSkills([skill]);
                        setSuggestedSkills((current) => (current ?? []).filter((s) => s !== skill));
                      }}
                    >
                      + {skill}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

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
              <ProjectCard
                entry={entry}
                index={index}
                messagesFor={messagesFor}
                onUpdate={(patch) => setProjects(updateEntry(projects, index, patch))}
                onRemove={() => {
                  if (isProjectEntryEmpty(entry)) {
                    setProjects(projects.filter((_, i) => i !== index));
                  } else {
                    setPendingRemoval({ kind: "project", index });
                  }
                }}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      </Card>

      <div id="education">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-h3 font-semibold text-ink">Education</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const newIndex = education.length;
                setEducation([
                  ...education,
                  { degree: "", institution: "", start_date: "", end_date: "", is_current: false, notes: "" },
                ]);
                setExpandedEduIndexes((current) => new Set(current).add(newIndex));
              }}
            >
              + Add qualification
            </Button>
          </div>
          <StaggerList className="mt-4 flex flex-col gap-4">
            {education.map((entry, index) => {
              const isExpanded = !isEducationEntryEmpty(entry) || expandedEduIndexes.has(index);
              if (!isExpanded) {
                return (
                  <StaggerItem key={index}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded border border-dashed border-border px-4 py-3 text-left text-sm text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent/40 hover:text-accent"
                      onClick={() => setExpandedEduIndexes((current) => new Set(current).add(index))}
                    >
                      <span>Add a qualification</span>
                      <span className="text-xs font-medium">+ Add</span>
                    </button>
                  </StaggerItem>
                );
              }
              return (
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
                      onClick={() => {
                        if (isEducationEntryEmpty(entry)) {
                          setEducation(education.filter((_, i) => i !== index));
                        } else {
                          setPendingRemoval({ kind: "education", index });
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </StaggerItem>
              );
            })}
          </StaggerList>
        </Card>
      </div>

      <div id="referees">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-h3 font-semibold text-ink">Referees</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setReferees([
                  ...referees,
                  { name: "", title: "", organisation: "", phone: "", email: "" },
                ])
              }
            >
              + Add referee
            </Button>
          </div>
          <p className="mt-1 text-sm text-ink-secondary">
            Professional referees who can speak to your performance and work experience.
          </p>
          <StaggerList className="mt-4 flex flex-col gap-4">
            {referees.map((entry, index) => (
              <StaggerItem key={index}>
                <div className="grid gap-3 rounded border border-border p-4 sm:grid-cols-2">
                  <Input
                    label="Referee name"
                    value={entry.name}
                    onChange={(e) =>
                      setReferees(updateEntry(referees, index, { name: e.target.value }))
                    }
                  />
                  <Input
                    label="Title / Role"
                    value={entry.title}
                    onChange={(e) =>
                      setReferees(updateEntry(referees, index, { title: e.target.value }))
                    }
                  />
                  <Input
                    label="Organisation / Company"
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
                    value={entry.email}
                    onChange={(e) =>
                      setReferees(updateEntry(referees, index, { email: e.target.value }))
                    }
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
      </div>

      {pendingRemoval && (
        <ConfirmDialog
          title={REMOVAL_COPY[pendingRemoval.kind].title}
          description={REMOVAL_COPY[pendingRemoval.kind].description}
          confirmLabel={REMOVAL_COPY[pendingRemoval.kind].confirmLabel}
          isDestructive
          onConfirm={performPendingRemoval}
          onCancel={() => setPendingRemoval(null)}
        />
      )}

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
