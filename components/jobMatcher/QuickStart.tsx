"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TagInput } from "@/components/jobMatcher/TagInput";
import { saveJobProfile } from "@/lib/jobs/client";
import { EMPTY_PROFILE, PROFILE_LIMITS } from "@/lib/jobs/profile";

/**
 * Only shown when there is nothing in the user's profile, resumes or applications to match on:
 * one question instead of a form. Everything else can be refined later with "Adjust".
 */
export function QuickStart({ onDone, onMoreOptions }: { onDone: () => void; onMoreOptions: () => void }) {
  const [titles, setTitles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (titles.length === 0) {
      setError("Add at least one job title");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await saveJobProfile({ ...EMPTY_PROFILE, targetTitles: titles }, { automatic: true });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="mx-auto flex max-w-lg flex-col gap-4 py-4 text-center" noValidate>
        <div>
          <h2 className="text-h3 font-semibold text-ink">What job are you looking for?</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Add a job title and we&apos;ll find matching Australian jobs. Filling in your profile makes this automatic.
          </p>
        </div>
        <div className="text-left">
          <TagInput
            label="Job titles"
            values={titles}
            onChange={setTitles}
            max={PROFILE_LIMITS.targetTitles}
            placeholder="e.g. Nurse, Barista, Data Analyst"
            error={error ?? undefined}
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="submit" isLoading={isSaving}>
            {isSaving ? "Finding your matches…" : "Show my matches"}
          </Button>
          <Button variant="ghost" onClick={onMoreOptions} disabled={isSaving} className="text-ink-secondary hover:bg-paper-deep hover:text-ink">
            More options
          </Button>
        </div>
      </form>
    </Card>
  );
}
