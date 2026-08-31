"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { ProfileFieldsFieldset } from "@/components/profile/ProfileFieldsFieldset";
import { useProfileFieldsState, type ProfileFieldsInitial } from "@/lib/profile/useProfileFieldsState";

export function OnboardingReviewForm({ initial }: { initial: ProfileFieldsInitial }) {
  const router = useRouter();
  const state = useProfileFieldsState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.toPayload(true)),
      });
    } catch {
      setIsSaving(false);
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    const data = await response.json().catch(() => ({}));
    setIsSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/resume/new?firstrun=1");
    router.refresh();
  }

  return (
    <Reveal>
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div>
          <h2 className="text-h3 font-semibold text-ink">Review your details</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Everything below is editable, so make sure it&apos;s accurate before you continue.
          </p>
        </div>
        <ProfileFieldsFieldset state={state} />
        {error && <p className="text-sm text-critical">{error}</p>}
        <Button type="submit" isLoading={isSaving} className="self-start">
          Save &amp; continue
        </Button>
      </form>
    </Reveal>
  );
}
