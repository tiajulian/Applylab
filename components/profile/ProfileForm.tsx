"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ProfileFieldsFieldset } from "@/components/profile/ProfileFieldsFieldset";
import { useProfileFieldsState } from "@/lib/profile/useProfileFieldsState";
import type { UserProfile } from "@/types";

export function ProfileForm({
  initialFullName,
  initialProfile,
}: {
  initialFullName: string;
  initialProfile: UserProfile | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const state = useProfileFieldsState({
    fullName: initialFullName,
    work_rights: initialProfile?.work_rights,
    phone: initialProfile?.phone,
    location: initialProfile?.location,
    linkedin_url: initialProfile?.linkedin_url,
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

  async function handleSave(event: React.FormEvent) {
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

    showToast("Profile saved", "success");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="with-section-links flex flex-col gap-6">
      {/* Jump links: the profile is long, so every section is one tap away. Sticks under the
          app header (69px). */}
      <nav
        aria-label="Profile sections"
        className="sticky top-[69px] z-10 -mx-1 flex gap-1 overflow-x-auto bg-paper/95 px-1 py-2 backdrop-blur-[8px] [scrollbar-width:none]"
      >
        {[
          { id: "contact", label: "Contact" },
          { id: "experience", label: "Jobs" },
          { id: "skills", label: "Skills" },
          { id: "projects", label: "Projects" },
          { id: "education", label: "Education" },
          { id: "referees", label: "Referees" },
          { id: "linkedin", label: "LinkedIn" },
        ].map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-pill border border-border bg-surface px-3 py-1 text-[13px] font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
          >
            {section.label}
          </a>
        ))}
      </nav>
      <ProfileFieldsFieldset state={state} />

      {/* Stays in view while scrolling a long profile, so saving is never a hunt for the button.
          Sits above the phone tab bar (60px + safe area) and flush to the bottom on desktop. */}
      <div className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/95 p-2 shadow-lg backdrop-blur-[8px] sm:px-4 sm:py-3">
          <p className={`text-[13.5px] ${error ? "" : "hidden sm:block"}`} role={error ? "alert" : undefined}>
            {error ? <span className="font-medium text-critical">{error}</span> : <span className="text-ink-secondary">Changes aren&apos;t saved until you press Save.</span>}
          </p>
          <Button type="submit" isLoading={isSaving} className="flex-1 shrink-0 sm:min-w-[140px] sm:flex-none">
            Save profile
          </Button>
        </div>
      </div>
    </form>
  );
}
