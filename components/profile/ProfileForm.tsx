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
  const [savedAt, setSavedAt] = useState<Date | null>(null);
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

    setSavedAt(new Date());
    showToast("Profile saved", "success");
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-10">
      <ProfileFieldsFieldset state={state} />

      <div className="flex items-center gap-4">
        <Button type="submit" isLoading={isSaving}>
          Save profile
        </Button>
        {savedAt && (
          <span className="text-sm text-ink-secondary">
            Saved at {savedAt.toLocaleTimeString()}
          </span>
        )}
        {error && <span className="text-sm text-critical">{error}</span>}
      </div>
    </form>
  );
}
