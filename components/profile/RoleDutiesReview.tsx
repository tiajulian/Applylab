"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { ImpactField } from "@/components/profile/ImpactField";
import type { RoleDutyItem, RoleDutySuggestion } from "@/types";

function ThinRoleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
      <path d="M12 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m5.6 5.6 2.8 2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m15.6 15.6 2.8 2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m5.6 18.4 2.8-2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m15.6 8.4 2.8-2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

async function fetchSuggestions(
  jobTitle: string,
  company: string,
  location: string
): Promise<{ suggestion: RoleDutySuggestion; items: RoleDutyItem[] } | { error: string }> {
  const response = await fetch("/api/role-duties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobTitle, company, location }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { error: data.error ?? "Something went wrong. Please try again." };
  return { suggestion: data.suggestion, items: data.items ?? [] };
}

async function patchItem(
  suggestionId: string,
  itemId: string,
  update: {
    user_state?: "confirmed" | "rejected";
    user_edited_text?: string | null;
    outcome_text?: string | null;
    outcome_metric?: string | null;
  }
): Promise<RoleDutyItem | null> {
  const response = await fetch(`/api/role-duties/${suggestionId}/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  return data?.item ?? null;
}

function ConfirmedDutyImpact({
  item,
  suggestionId,
  onUpdate,
}: {
  item: RoleDutyItem;
  suggestionId: string;
  onUpdate: (item: RoleDutyItem) => void;
}) {
  const [outcomeText, setOutcomeText] = useState(item.outcome_text ?? "");
  const [outcomeMetric, setOutcomeMetric] = useState(item.outcome_metric ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function saveImpact() {
    setIsSaving(true);
    const updated = await patchItem(suggestionId, item.id, {
      outcome_text: outcomeText.trim() || null,
      outcome_metric: outcomeMetric.trim() || null,
    });
    setIsSaving(false);
    if (updated) onUpdate(updated);
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <ImpactField
        label="What did this achieve, or why did it matter? (optional)"
        description="In your own words. No pressure for a number, a plain honest task is a good bullet too."
        textValue={outcomeText}
        onTextChange={setOutcomeText}
        metricValue={outcomeMetric}
        onMetricChange={setOutcomeMetric}
        rows={2}
      />
      <Button type="button" variant="ghost" size="sm" isLoading={isSaving} onClick={saveImpact} className="self-start">
        Save impact
      </Button>
    </div>
  );
}

function DutyCard({
  item,
  suggestionId,
  onUpdate,
}: {
  item: RoleDutyItem;
  suggestionId: string;
  onUpdate: (item: RoleDutyItem) => void;
}) {
  const displayText = item.user_edited_text ?? item.duty_text;
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(displayText);

  function startEditing() {
    setDraft(displayText);
    setIsEditing(true);
  }

  async function respond(userState: "confirmed" | "rejected") {
    setIsSaving(true);
    const updated = await patchItem(suggestionId, item.id, { user_state: userState });
    setIsSaving(false);
    if (updated) onUpdate(updated);
  }

  async function saveEdit() {
    const trimmedDraft = draft.trim();
    if (!trimmedDraft || trimmedDraft === displayText) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    const updated = await patchItem(suggestionId, item.id, { user_edited_text: trimmedDraft });
    setIsSaving(false);
    if (updated) {
      onUpdate(updated);
      setIsEditing(false);
    }
  }

  async function resetToSuggestion() {
    setIsSaving(true);
    const updated = await patchItem(suggestionId, item.id, { user_edited_text: null });
    setIsSaving(false);
    if (updated) onUpdate(updated);
  }

  if (item.user_state !== "pending") {
    const confirmed = item.user_state === "confirmed";
    return (
      <div
        className={`rounded p-3 text-sm transition-colors duration ease-editorial ${confirmed ? "bg-success-soft text-success" : "bg-paper-deep text-ink-muted line-through"}`}
      >
        {displayText}
        {confirmed && <ConfirmedDutyImpact item={item} suggestionId={suggestionId} onUpdate={onUpdate} />}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="rounded bg-attention-soft p-3 transition-colors duration ease-editorial">
        <textarea
          className="w-full rounded border border-border bg-paper p-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
        />
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" isLoading={isSaving} disabled={!draft.trim()} onClick={saveEdit}>
            Use this
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => {
              setDraft(displayText);
              setIsEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded bg-attention-soft p-3 transition-colors duration ease-editorial">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-attention">{displayText}</p>
        <div className="flex shrink-0 gap-2">
          {item.user_edited_text && (
            <button
              type="button"
              className="rounded-sm text-xs text-attention/70 transition-colors duration-fast ease-editorial hover:text-attention focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isSaving}
              onClick={resetToSuggestion}
            >
              Reset to suggestion
            </button>
          )}
          <button
            type="button"
            className="rounded-sm text-xs text-attention/70 transition-colors duration-fast ease-editorial hover:text-attention focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={startEditing}
          >
            Edit
          </button>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" isLoading={isSaving} onClick={() => respond("confirmed")}>
          I did this
        </Button>
        <Button type="button" variant="outline" size="sm" isLoading={isSaving} onClick={() => respond("rejected")}>
          Not me
        </Button>
      </div>
    </div>
  );
}

/**
 * Shown next to a thin work_experience entry (see lib/profile/thinExperience.ts). Suggests what
 * this JOB TITLE typically involves - never derived from any target job - and only ever feeds
 * ticked duties into a resume (see lib/resume/factCheck.ts and lib/anthropic/generateResume.ts).
 * Confirmations are saved directly via PATCH as they happen, independent of the profile form's
 * own "Save profile" button, so nothing here is lost if the form isn't submitted.
 */
export function RoleDutiesReview({
  jobTitle,
  company,
  location,
}: {
  jobTitle: string;
  company: string;
  location: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error" | "dismissed">("idle");
  const [suggestion, setSuggestion] = useState<RoleDutySuggestion | null>(null);
  const [items, setItems] = useState<RoleDutyItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSuggest() {
    setStatus("loading");
    setError(null);
    const result = await fetchSuggestions(jobTitle, company, location);
    if ("error" in result) {
      setError(result.error);
      setStatus("error");
      return;
    }
    setSuggestion(result.suggestion);
    setItems(result.items);
    setStatus("ready");
  }

  function updateItem(updated: RoleDutyItem) {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  if (status === "dismissed") return null;

  if (status === "idle" || status === "error") {
    return (
      <div className="flex items-start justify-between gap-3 rounded bg-accent-soft p-3">
        <div className="flex items-start gap-2">
          <ThinRoleIcon />
          <div>
            <p className="text-sm text-accent">
              This role looks thin. See typical duties for &ldquo;{jobTitle || "this role"}&rdquo; and tick the ones
              you actually did.
            </p>
            {error && <p className="mt-1 text-xs text-critical">{error}</p>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setStatus("dismissed")}>
            Dismiss
          </Button>
          <Button type="button" size="sm" disabled={!jobTitle.trim()} onClick={handleSuggest}>
            Suggest duties
          </Button>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="rounded bg-accent-soft p-3">
        <p className="text-sm text-accent">Looking up typical duties for &ldquo;{jobTitle}&rdquo;…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-border bg-paper-deep/50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
        Tasks people in this role usually do
      </p>
      <p className="text-xs text-ink-muted">
        These are general to the job title, not claims about you. Only what you tick gets used.
      </p>
      <StaggerList className="flex flex-col gap-2">
        {items.map((item) => (
          <StaggerItem key={item.id}>
            <DutyCard item={item} suggestionId={suggestion!.id} onUpdate={updateItem} />
          </StaggerItem>
        ))}
        {items.length === 0 && <p className="text-sm text-ink-secondary">No suggestions found for this title.</p>}
      </StaggerList>
    </div>
  );
}
