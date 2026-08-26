"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Reveal } from "@/components/ui/Reveal";
import { ResumeForm } from "@/components/resume/ResumeForm";
import { ProfileCompleteness } from "@/components/profile/ProfileCompleteness";
import { useProfileFieldsState, type ProfileFieldsInitial } from "@/lib/profile/useProfileFieldsState";
import {
  computeCompleteness,
  getImprovementSuggestions,
  getMissingMvpFields,
  joinSuggestions,
} from "@/lib/profile/completeness";

export function ResumeGate({
  initial,
  isPaidPlan,
  remaining,
  limit,
  firstRun = false,
}: {
  initial: ProfileFieldsInitial;
  isPaidPlan: boolean;
  remaining: number | null;
  limit: number;
  firstRun?: boolean;
}) {
  const state = useProfileFieldsState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const scorable = {
    fullName: state.fullName,
    work_rights: state.workRights,
    phone: state.phone,
    location: state.location,
    linkedin_url: state.linkedinUrl,
    raw_linkedin_paste: state.rawLinkedinPaste,
    skills: state.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    work_experience: state.experience,
    education: state.education,
    referees: state.referees,
  };

  const missingFields = getMissingMvpFields(scorable);
  const meetsMvp = missingFields.length === 0;
  const completeness = computeCompleteness(scorable);

  async function handleGapFillSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.toPayload(false)),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSavedAt(new Date());
  }

  if (!meetsMvp) {
    return (
      <div className="flex flex-col gap-6">
        <Reveal>
        <form
          onSubmit={handleGapFillSubmit}
          className="flex flex-col gap-4 rounded border border-attention/30 bg-attention-soft p-6"
        >
          <div>
            <h2 className="font-display text-h3 text-attention">Finish these to generate</h2>
            <p className="mt-1 text-sm text-attention">
              We need a bit more from your profile before we can write a resume that isn&apos;t generic.
            </p>
          </div>

          {missingFields.includes("fullName") && (
            <Input label="Full name" value={state.fullName} onChange={(e) => state.setFullName(e.target.value)} />
          )}

          {(missingFields.includes("location") || missingFields.includes("workRights")) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {missingFields.includes("location") && (
                <Input
                  label="Location (Suburb, State)"
                  placeholder="e.g. Parramatta, NSW"
                  value={state.location}
                  onChange={(e) => state.setLocation(e.target.value)}
                />
              )}
              {missingFields.includes("workRights") && (
                <Input
                  label="Work rights"
                  placeholder="e.g. Australian citizen"
                  value={state.workRights}
                  onChange={(e) => state.setWorkRights(e.target.value)}
                />
              )}
            </div>
          )}

          {missingFields.includes("skills") && (
            <Textarea
              label="Key skills (comma-separated, at least 3)"
              rows={2}
              value={state.skills}
              onChange={(e) => state.setSkills(e.target.value)}
            />
          )}

          {missingFields.includes("experience") && (
            <div className="grid gap-3 rounded border border-attention/20 bg-surface p-4 sm:grid-cols-2">
              <Input
                label="Most recent job title"
                value={state.experience[0]?.job_title ?? ""}
                onChange={(e) =>
                  state.setExperience(state.updateEntry(state.experience, 0, { job_title: e.target.value }))
                }
              />
              <Input
                label="Company"
                value={state.experience[0]?.company ?? ""}
                onChange={(e) =>
                  state.setExperience(state.updateEntry(state.experience, 0, { company: e.target.value }))
                }
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="What did you do there?"
                  rows={3}
                  value={state.experience[0]?.description ?? ""}
                  onChange={(e) =>
                    state.setExperience(state.updateEntry(state.experience, 0, { description: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-critical">{error}</p>}

          <div className="flex items-center gap-4">
            <Button type="submit" isLoading={isSaving} className="self-start">
              Save
            </Button>
            {savedAt && <span className="text-sm text-attention">Saved at {savedAt.toLocaleTimeString()}</span>}
          </div>
        </form>
        </Reveal>

        <ResumeForm disabled isPaidPlan={isPaidPlan} remaining={remaining} limit={limit} />
      </div>
    );
  }

  const suggestions = getImprovementSuggestions(scorable);
  const suggestionText = suggestions.length > 0 ? joinSuggestions(suggestions) : "";

  return (
    <div className="flex flex-col gap-6">
      <ResumeForm isPaidPlan={isPaidPlan} remaining={remaining} limit={limit} />
      <ProfileCompleteness
        completeness={completeness}
        suggestionText={suggestionText}
        context="matcher"
        firstRun={firstRun}
      />
    </div>
  );
}
