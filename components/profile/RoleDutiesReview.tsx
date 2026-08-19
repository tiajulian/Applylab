"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { WinBuilder } from "@/components/profile/WinBuilder";
import { checkSlotCoverage } from "@/lib/wins/dutyCoverage";
import { patchDutyItem, type UseRoleDutiesResult } from "@/lib/profile/useRoleDuties";
import { useSaveAction } from "@/lib/hooks/useSaveAction";
import type { RoleDutyItem, WorkExperienceWin } from "@/types";

export function ThinRoleIcon() {
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

/**
 * Coverage check, not a critique: reports whether this confirmed duty already has proof of impact
 * (an outcome or a number) using the shared slot-coverage helper (lib/wins/dutyCoverage.ts), the
 * same yardstick as the Win Builder. A covered duty shows its outcome/metric quietly, with a small
 * "Edit impact" link to reopen the builder rather than a dead end. A thin one gets the same-weight
 * "Want to make this stronger?" link instead - never a coloured warning, never a judgement on the
 * wording. Either way, filling or changing the gap opens the Win Builder itself (pre-seeded, jumping straight to
 * the review step), so this never becomes a second capture path and never rewrites the duty's own
 * text. Reused directly as a row action inside the unified role list (RoleContentList.tsx).
 */
export function DutyImpact({
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
      const updated = await patchDutyItem(suggestionId, item.id, {
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
    <div className="flex flex-col gap-1">
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
          {coverage.isThin ? "✨ Want to make this stronger?" : "Edit impact"}
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
  onRespond,
  onUpdate,
}: {
  item: RoleDutyItem;
  suggestionId: string;
  onRespond: (itemId: string, userState: "confirmed" | "rejected") => Promise<RoleDutyItem | null>;
  onUpdate: (item: RoleDutyItem) => void;
}) {
  const displayText = item.user_edited_text ?? item.duty_text;
  const { isSaving, error: saveError, run, clearError } = useSaveAction<RoleDutyItem>();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(displayText);

  function startEditing() {
    setDraft(displayText);
    clearError();
    setIsEditing(true);
  }

  async function respond(userState: "confirmed" | "rejected") {
    await run(() => onRespond(item.id, userState));
  }

  async function saveEdit() {
    const trimmedDraft = draft.trim();
    if (!trimmedDraft || trimmedDraft === displayText) {
      setIsEditing(false);
      return;
    }
    const updated = await run(() => patchDutyItem(suggestionId, item.id, { user_edited_text: trimmedDraft }));
    if (!updated) return;
    onUpdate(updated);
    setIsEditing(false);
  }

  async function resetToSuggestion() {
    const updated = await run(() => patchDutyItem(suggestionId, item.id, { user_edited_text: null }));
    if (updated) onUpdate(updated);
  }

  if (item.user_state === "rejected") {
    return (
      <div className="rounded bg-paper-deep p-3 text-sm text-ink-muted line-through">
        {displayText}
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
 * Content for the "Ideas from this role" disclosure (see RoleCard.tsx): suggests what this JOB
 * TITLE typically involves - never derived from any target job - and only ever feeds ticked duties
 * into a resume (see lib/resume/factCheck.ts and lib/anthropic/generateResume.ts). Confirmations
 * are saved directly via PATCH as they happen, independent of the profile form's own "Save
 * profile" button, so nothing here is lost if the form isn't submitted.
 *
 * Deliberately only ever shows pending and rejected items - once a duty is confirmed it moves up
 * into the unified "what you did here" list (RoleContentList.tsx) instead, so it is never rendered
 * in two places at once. Fetching/state ownership lives one level up in useRoleDuties.ts so both
 * this component and the unified list share one array and never drift out of sync.
 */
export function RoleDutiesReview({
  jobTitle,
  company,
  location,
  duties,
}: {
  jobTitle: string;
  company: string;
  location: string;
  duties: UseRoleDutiesResult;
}) {
  const { status, suggestion, items, error, handleSuggest, updateItem, respond, dismiss } = duties;

  if (status === "hidden" || status === "dismissed") return null;

  if (status === "idle" || status === "error") {
    return (
      <div className="flex items-start justify-between gap-3 rounded bg-accent-soft p-3">
        <div className="flex items-start gap-2">
          <ThinRoleIcon />
          <div>
            <p className="text-sm text-accent">
              See typical duties for &ldquo;{jobTitle || "this role"}&rdquo; and tick the ones you actually did.
            </p>
            {error && <p className="mt-1 text-xs text-critical">{error}</p>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={dismiss}>
            Dismiss
          </Button>
          <Button type="button" size="sm" disabled={!jobTitle.trim()} onClick={() => handleSuggest(company, location)}>
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

  const openItems = items.filter((item) => item.user_state !== "confirmed");

  return (
    <div className="flex flex-col gap-3">
      <StaggerList className="flex flex-col gap-2">
        {openItems.map((item) => (
          <StaggerItem key={item.id}>
            <DutyCard item={item} suggestionId={suggestion!.id} onRespond={respond} onUpdate={updateItem} />
          </StaggerItem>
        ))}
        {items.length === 0 && <p className="text-sm text-ink-secondary">No suggestions found for this title.</p>}
        {items.length > 0 && openItems.length === 0 && (
          <p className="text-sm text-ink-secondary">You&apos;ve been through all the suggestions for this role.</p>
        )}
      </StaggerList>
    </div>
  );
}
