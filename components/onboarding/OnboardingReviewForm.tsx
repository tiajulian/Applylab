"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
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

    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.toPayload(true)),
    });

    if (!response.ok) {
      setIsSaving(false);
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/resume/new");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Review your details</h2>
        <p className="mt-1 text-sm text-gray-500">
          Everything below is editable — make sure it&apos;s accurate before you continue.
        </p>
      </div>
      <ProfileFieldsFieldset state={state} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" isLoading={isSaving} className="self-start">
        Save &amp; continue
      </Button>
    </form>
  );
}
