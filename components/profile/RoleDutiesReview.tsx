"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { WinBuilder } from "@/components/profile/WinBuilder";
import { checkSlotCoverage } from "@/lib/wins/dutyCoverage";
import { useSaveAction } from "@/lib/hooks/useSaveAction";
import type { RoleDutyItem, RoleDutySuggestion, WorkExperienceWin } from "@/types";

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
    tools?: string[];
    stakeholders?: string[];
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

/**
 * Coverage check, not a critique: reports whether this confirmed duty already has proof of impact
 * (an outcome or a number) using the shared slot-coverage helper (lib/wins/dutyCoverage.ts), the
 * same yardstick as the Win Builder. A covered duty shows its outcome/metric quietly, with a small
 * "Edit impact" link to reopen the builder rather than a dead end. A thin one gets the same-weight
 * "Add impact?" link instead - never a coloured warning, never a judgement on the wording. Either
 * way, filling or changing the gap opens the Win Builder itself (pre-seeded, jumping straight to
 * the review step), so this never becomes a second capture path and never rewrites the duty's own
 * text.
 */
function DutyImpact({
  item,
  suggestionId,
  jobTitle,
  description,
  profileTools,
  onAddProfileTool,
  profileStakeholders,
  onAddProfileStakeholder,
  onUpdate,
}: {
  item: RoleDutyItem;
  suggestionId: string;
  jobTitle: string;
  description: string;
  profileTools: string[];
  onAddProfileTool: (tool: string) => void;
  profileStakeholders: string[];
  onAddProfileStakeholder: (stakeholder: string) => void;
  onUpdate: (item: RoleDutyItem) => void;
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const coverage = checkSlotCoverage({
    outcome: item.outcome_text,
    metric: item.outcome_metric,
    tools: item.tools,
    stakeholders: item.stakeholders,
  });

  // Reports failure by throwing rather than local error state (unlike DutyCard's actions below):
  // this is wired in as WinBuilder's onSave prop, and WinBuilder's own try/catch is what shows
  // the error and keeps its modal open on failure - a thrown error is that contract, not a
  // stylistic choice. DutyCard's actions aren't behind a WinBuilder onSave, so they report
  // failure through their own local error state instead.
  async function handleBuilderSave(win: WorkExperienceWin) {
    setIsSaving(true);
    try {
      // A thrown network error (fetch itself failing) and a resolved-but-failed patch (null)
      // both need isSaving cleared - the finally below covers both, rather than only the
      // explicit `!updated` branch, so a dropped connection can't leave this stuck mid-save.
      const updated = await patchItem(suggestionId, item.id, {
        outcome_text: win.outcome?.trim() || null,
        outcome_metric: win.metric?.trim() || null,
        tools: win.tools ?? [],
        stakeholders: win.stakeholders ?? [],
      });
      if (!updated) {
        throw new Error("Couldn't save. Please try again.");
      }
      setBuilderOpen(false);
      onUpdate(updated);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  }

  const dutyText = item.user_edited_text?.trim() || item.duty_text;

  return (
    <div className="mt-2 flex flex-col gap-1">
      {!coverage.isThin && (
        <div className="text-xs text-ink-secondary">
          {item.outcome_text}
          {item.outcome_metric && <span className="text-ink-muted"> ({item.outcome_metric})</span>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="self-start rounded-sm text-xs font-medium text-accent underline transition-colors duration-fast ease-editorial hover:text-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          disabled={isSaving}
          onClick={() => setBuilderOpen(true)}
        >
          {coverage.isThin ? "Add impact?" : "Edit impact"}
        </button>
        {justSaved && <span className="text-xs font-medium text-success">Saved</span>}
      </div>
      {builderOpen && (
        <WinBuilder
          jobTitle={jobTitle}
          description={description}
          profileTools={profileTools}
          onAddProfileTool={onAddProfileTool}
          profileStakeholders={profileStakeholders}
          onAddProfileStakeholder={onAddProfileStakeholder}
          initialWin={{
            text: dutyText,
            metric: item.outcome_metric ?? "",
            what: dutyText,
            outcome: item.outcome_text ?? "",
            tools: item.tools,
            stakeholders: item.stakeholders,
          }}
          onSave={handleBuilderSave}
          onClose={() => setBuilderOpen(false)}
        />
      )}
    </div>
  );
}

function DutyCard({
  item,
  suggestionId,
  jobTitle,
  description,
  profileTools,
  onAddProfileTool,
  profileStakeholders,
  onAddProfileStakeholder,
  onUpdate,
}: {
  item: RoleDutyItem;
  suggestionId: string;
  jobTitle: string;
  description: string;
  profileTools: string[];
  onAddProfileTool: (tool: string) => void;
  profileStakeholders: string[];
  onAddProfileStakeholder: (stakeholder: string) => void;
  onUpdate: (item: RoleDutyItem) => void;
}) {
  const displayText = item.user_edited_text ?? item.duty_text;
  const { isSaving, error: saveError, run, clearError } = useSaveAction<RoleDutyItem>();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(displayText);
  const [justSaved, setJustSaved] = useState(false);

  function startEditing() {
    setDraft(displayText);
    clearError();
    setIsEditing(true);
  }

  async function respond(userState: "confirmed" | "rejected") {
    const updated = await run(() => patchItem(suggestionId, item.id, { user_state: userState }));
    if (!updated) return;
    onUpdate(updated);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  async function saveEdit() {
    const trimmedDraft = draft.trim();
    if (!trimmedDraft || trimmedDraft === displayText) {
      setIsEditing(false);
      return;
    }
    const updated = await run(() => patchItem(suggestionId, item.id, { user_edited_text: trimmedDraft }));
    if (!updated) return;
    onUpdate(updated);
    setIsEditing(false);
  }

  async function resetToSuggestion() {
    const updated = await run(() => patchItem(suggestionId, item.id, { user_edited_text: null }));
    if (updated) onUpdate(updated);
  }

  if (item.user_state !== "pending") {
    const confirmed = item.user_state === "confirmed";
    return (
      <div
        className={`rounded p-3 text-sm transition-colors duration ease-editorial ${confirmed ? "bg-success-soft text-success" : "bg-paper-deep text-ink-muted line-through"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span>{displayText}</span>
          {justSaved && (
            <span className="shrink-0 text-xs font-medium no-underline text-success">Saved</span>
          )}
        </div>
        {confirmed && (
          <DutyImpact
            item={item}
            suggestionId={suggestionId}
            jobTitle={jobTitle}
            description={description}
            profileTools={profileTools}
            onAddProfileTool={onAddProfileTool}
            profileStakeholders={profileStakeholders}
            onAddProfileStakeholder={onAddProfileStakeholder}
            onUpdate={onUpdate}
          />
        )}
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
              clearError();
              setIsEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
        {saveError && <p className="mt-2 text-xs text-critical">{saveError}</p>}
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
      <div className="mt-2 flex items-center gap-2">
        <Button type="button" size="sm" isLoading={isSaving} onClick={() => respond("confirmed")}>
          I did this
        </Button>
        <Button type="button" variant="outline" size="sm" isLoading={isSaving} onClick={() => respond("rejected")}>
          Not me
        </Button>
        {saveError && <span className="text-xs text-critical">{saveError}</span>}
      </div>
    </div>
  );
}

/**
 * Shown next to a work_experience entry with a job title. Suggests what this JOB TITLE typically
 * involves - never derived from any target job - and only ever feeds ticked duties into a resume
 * (see lib/resume/factCheck.ts and lib/anthropic/generateResume.ts). Confirmations are saved
 * directly via PATCH as they happen, independent of the profile form's own "Save profile" button,
 * so nothing here is lost if the form isn't submitted.
 *
 * On mount, does a zero-cost lookup (GET /api/role-duties?full=1) for duties already saved
 * against this job title from an earlier session, so a candidate never has to re-click "Suggest
 * duties" just to see (and keep confirming) what they already ticked. Only offers the "Suggest
 * duties" prompt for a role with nothing saved yet, and only when the role looks thin
 * (see lib/profile/thinExperience.ts) - a role with real content already has no need for it.
 */
export function RoleDutiesReview({
  jobTitle,
  company,
  location,
  description,
  isThin,
  profileTools,
  onAddProfileTool,
  profileStakeholders,
  onAddProfileStakeholder,
  onConfirmedDutiesChange,
}: {
  jobTitle: string;
  company: string;
  location: string;
  description: string;
  isThin: boolean;
  profileTools: string[];
  onAddProfileTool: (tool: string) => void;
  profileStakeholders: string[];
  onAddProfileStakeholder: (stakeholder: string) => void;
  /** Fires with the current list of confirmed duty texts whenever it changes, so the role card
   * can show them in its read-only combined preview (see RoleBulletsPreview.tsx) without this
   * component's local item state leaking further than it needs to. */
  onConfirmedDutiesChange?: (duties: string[]) => void;
}) {
  // "hidden" covers both "nothing to check yet" (no job title) and "checked, nothing found, and
  // the role isn't thin" - both render nothing, so there's no reason to track them separately.
  const [status, setStatus] = useState<"hidden" | "idle" | "loading" | "ready" | "error" | "dismissed">("hidden");
  const [suggestion, setSuggestion] = useState<RoleDutySuggestion | null>(null);
  const [items, setItems] = useState<RoleDutyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    const confirmedTexts = items
      .filter((item) => item.user_state === "confirmed")
      .map((item) => item.user_edited_text?.trim() || item.duty_text);
    onConfirmedDutiesChange?.(confirmedTexts);
    // Deliberately depends on `items` only, not `onConfirmedDutiesChange` itself - the parent
    // passes a new callback reference every render (ProfileFieldsFieldset.tsx), but since it's
    // never read as a dependency here, that reference change is harmless; only a genuine change
    // to `items` should re-fire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    if (checkedRef.current || !jobTitle.trim()) return;
    checkedRef.current = true;

    (async () => {
      try {
        const response = await fetch(`/api/role-duties?jobTitle=${encodeURIComponent(jobTitle.trim())}&full=1`);
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.suggestion && Array.isArray(data.items) && data.items.length > 0) {
          setSuggestion(data.suggestion);
          setItems(data.items);
          setStatus("ready");
          return;
        }
      } catch {
        // Falls through to the thin-nudge (or hidden) state below - this load-time check is a
        // convenience, never a blocker.
      }
      setStatus(isThin ? "idle" : "hidden");
    })();
    // Only ever runs once, guarded by checkedRef - isThin/company/location can change afterwards
    // (e.g. mid-edit) without re-triggering this check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobTitle]);

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

  if (status === "hidden" || status === "dismissed") return null;

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

  const thinConfirmedCount = items.filter(
    (item) =>
      item.user_state === "confirmed" &&
      checkSlotCoverage({
        outcome: item.outcome_text,
        metric: item.outcome_metric,
        tools: item.tools,
        stakeholders: item.stakeholders,
      }).isThin
  ).length;

  return (
    <div className="flex flex-col gap-3 rounded border border-border bg-paper-deep/50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
        Tasks people in this role usually do
      </p>
      <p className="text-xs text-ink-muted">
        These are general to the job title, not claims about you. Only what you tick gets used.
      </p>
      {thinConfirmedCount > 0 && (
        <p className="text-xs text-ink-muted">
          {thinConfirmedCount === 1
            ? "One duty below could show a bit more impact, no pressure though."
            : "A couple of duties below could show a bit more impact, no pressure though."}
        </p>
      )}
      <StaggerList className="flex flex-col gap-2">
        {items.map((item) => (
          <StaggerItem key={item.id}>
            <DutyCard
              item={item}
              suggestionId={suggestion!.id}
              jobTitle={jobTitle}
              description={description}
              profileTools={profileTools}
              onAddProfileTool={onAddProfileTool}
              profileStakeholders={profileStakeholders}
              onAddProfileStakeholder={onAddProfileStakeholder}
              onUpdate={updateItem}
            />
          </StaggerItem>
        ))}
        {items.length === 0 && <p className="text-sm text-ink-secondary">No suggestions found for this title.</p>}
      </StaggerList>
    </div>
  );
}
