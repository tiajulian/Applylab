"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useUnsavedChangesGuard } from "@/components/dashboard/UnsavedChangesProvider";
import { ProfileFieldsFieldset } from "@/components/profile/ProfileFieldsFieldset";
import { useProfileFieldsState } from "@/lib/profile/useProfileFieldsState";
import type { UserProfile } from "@/types";

const PROFILE_SECTIONS = [
  { id: "contact", label: "Contact" },
  { id: "experience", label: "Jobs" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "education", label: "Education" },
  { id: "referees", label: "Referees" },
  { id: "linkedin", label: "LinkedIn" },
];

export function ProfileForm({
  initialFullName,
  initialProfile,
  initialMeetsMvp,
}: {
  initialFullName: string;
  initialProfile: UserProfile | null;
  /** Whether the saved profile already had enough to write a resume when the page loaded. */
  initialMeetsMvp: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const state = useProfileFieldsState({
    // Not edited on this page, but the save posts the whole profile: leaving these out would
    // wipe the onboarding answers (target_role also seeds the Find jobs search).
    career_goal: initialProfile?.career_goal,
    target_role: initialProfile?.target_role,
    job_hunt_pain: initialProfile?.job_hunt_pain,
    fullName: initialFullName,
    work_rights: initialProfile?.work_rights,
    phone: initialProfile?.phone,
    location: initialProfile?.location,
    linkedin_url: initialProfile?.linkedin_url,
    portfolio_url: initialProfile?.portfolio_url,
    github_url: initialProfile?.github_url,
    skills: initialProfile?.skills,
    tools: initialProfile?.tools,
    stakeholders: initialProfile?.stakeholders,
    work_experience: initialProfile?.work_experience,
    projects: initialProfile?.projects,
    education: initialProfile?.education,
    referees: initialProfile?.referees,
    raw_linkedin_paste: initialProfile?.raw_linkedin_paste,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dirty = differs from the last saved payload, so leaving (nav links, refresh, closing the tab)
  // asks first instead of silently dropping edits.
  const { setDirty } = useUnsavedChangesGuard();
  const payloadJson = JSON.stringify(state.toPayload(false));
  const [savedJson, setSavedJson] = useState(payloadJson);
  const isDirty = payloadJson !== savedJson;
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  // The section in view, for the jump links' current state.
  const [activeSection, setActiveSection] = useState<string>(PROFILE_SECTIONS[0].id);
  useEffect(() => {
    const elements = PROFILE_SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // The first section (in page order) that's in the band below the sticky header.
        const first = PROFILE_SECTIONS.find((s) => visible.has(s.id));
        if (first) setActiveSection(first.id);
      },
      { rootMargin: "-120px 0px -55% 0px" }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const sentJson = payloadJson;
    let response: Response;
    try {
      response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: sentJson,
      });
    } catch {
      setIsSaving(false);
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    setIsSaving(false);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSavedJson(sentJson);
    showToast("Profile saved", "success");
    // The first save that has enough to write a resume goes back to the dashboard's next step;
    // every other save stays put, so editing in several sittings isn't a trip out and back in.
    if (data.meetsMvp && !initialMeetsMvp) {
      router.push("/dashboard");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="with-section-links flex flex-col gap-6">
      {/* Jump links: the profile is long, so every section is one tap away. Sticks under the
          app header (64px). */}
      <nav
        aria-label="Profile sections"
        className="sticky top-[64px] z-10 -mx-1 flex gap-1 overflow-x-auto bg-paper/95 px-1 py-2 backdrop-blur-[8px] [scrollbar-width:none]"
      >
        {PROFILE_SECTIONS.map((section) => {
          const isCurrent = activeSection === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={isCurrent ? "location" : undefined}
              className={`shrink-0 rounded-pill border px-3 py-1 text-[13px] font-medium transition-colors ${
                isCurrent
                  ? "border-ink bg-ink text-surface"
                  : "border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink"
              }`}
            >
              {section.label}
            </a>
          );
        })}
      </nav>
      <ProfileFieldsFieldset state={state} />

      {/* Stays in view while scrolling a long profile, so saving is never a hunt for the button.
          Sits above the phone tab bar (60px + safe area) and flush to the bottom on desktop. */}
      <div className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/95 p-2 shadow-lg backdrop-blur-[8px] sm:px-4 sm:py-3">
          <p className={`text-[13.5px] ${error ? "" : "hidden sm:block"}`} role={error ? "alert" : undefined}>
            {error ? <span className="font-medium text-critical">{error}</span> : <span className="text-ink-secondary">{isDirty ? "Unsaved changes" : "Everything is saved."}</span>}
          </p>
          {/* Manual save: the button says whether there's anything to save. */}
          <Button
            type="submit"
            isLoading={isSaving}
            disabled={!isDirty && !isSaving}
            className="flex-1 shrink-0 sm:min-w-[140px] sm:flex-none"
          >
            {isDirty || isSaving ? "Save profile" : "Saved ✓"}
          </Button>
        </div>
      </div>
    </form>
  );
}
