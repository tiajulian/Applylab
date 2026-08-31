"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { ProfileFieldsFieldset } from "@/components/profile/ProfileFieldsFieldset";
import { useProfileFieldsState, type ProfileFieldsInitial } from "@/lib/profile/useProfileFieldsState";
import { MVP_FIELD_LABELS, joinSuggestions, type MvpFieldKey } from "@/lib/profile/completeness";

// Where each missing-MVP field actually lives on the page, so we can jump straight to it -
// these ids are the section wrappers in ProfileFieldsFieldset (id="contact" etc).
const MVP_FIELD_ANCHORS: Record<MvpFieldKey, string> = {
  fullName: "contact",
  location: "contact",
  workRights: "contact",
  experience: "experience",
  skills: "skills",
};

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

    const missingFields: MvpFieldKey[] = data.missingFields ?? [];
    if (!data.meetsMvp && missingFields.length > 0) {
      setError(
        `Before continuing, please add: ${joinSuggestions(missingFields.map((f) => MVP_FIELD_LABELS[f]))}.`
      );
      document
        .getElementById(MVP_FIELD_ANCHORS[missingFields[0]])
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
