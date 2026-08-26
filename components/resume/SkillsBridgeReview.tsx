"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountUp } from "@/components/ui/CountUp";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { useProgressStage } from "@/lib/hooks/useProgressMessages";
import { useSaveAction } from "@/lib/hooks/useSaveAction";
import type { BridgeItemState, SkillsBridge, SkillsBridgeItem } from "@/types";

const GENERATION_STAGES = [
  "Applying your confirmed skills bridge…",
  "Tailoring career impact bullets to target role…",
  "Optimizing layout density & ATS keyword match…",
  "Finalizing SEEK-ready resume formatting…",
];

const GROUP_ORDER: Array<{ state: BridgeItemState; title: string; blurb: string }> = [
  { state: "matched", title: "You've got these", blurb: "Backed by what's already in your profile." },
  { state: "to_confirm", title: "Worth confirming", blurb: "Likely, but only counts once you say so." },
];

const GAPS_PREVIEW_COUNT = 3;

function CheckBadge() {
  return (
    <motion.span
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-pill bg-success text-on-accent"
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.span>
  );
}

async function patchItem(
  bridgeId: string,
  itemId: string,
  body: {
    user_state?: "confirmed" | "rejected" | "pending";
    user_note?: string | null;
    source_company?: string;
    source_job_title?: string;
    save_to_profile?: boolean;
    reset_to_gap?: boolean;
  }
): Promise<SkillsBridgeItem | null> {
  const response = await fetch(`/api/skills-bridge/${bridgeId}/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  return data?.item ?? null;
}

function MatchedCard({
  item,
  bridgeId,
  onUpdate,
}: {
  item: SkillsBridgeItem;
  bridgeId: string;
  onUpdate: (item: SkillsBridgeItem) => void;
}) {
  const [note, setNote] = useState(item.user_note ?? "");
  const { isSaving, error: saveError, run } = useSaveAction<SkillsBridgeItem>();
  const rejected = item.user_state === "rejected";

  async function save(patch: { user_state?: "confirmed" | "rejected"; user_note?: string | null }) {
    const updated = await run(() => patchItem(bridgeId, item.id, patch));
    if (updated) onUpdate(updated);
  }

  return (
    <div
      className={`rounded p-4 transition-colors duration-slow ease-editorial ${
        rejected ? "bg-paper-deep opacity-60" : "bg-success-soft"
      }`}
    >
      <p className="flex items-start gap-2 text-sm text-ink">
        {!rejected && <CheckBadge />}
        <span>
          <span className="font-medium">{item.competency}</span>
          <span className="text-ink-secondary"> at </span>
          <span className="font-medium">{item.source_job_title}</span>
          <span className="text-ink-secondary">, {item.source_company}</span>
          <span className="text-ink-secondary"> → helps meet: </span>
          <span className="font-medium">{item.target_requirement}</span>
        </span>
      </p>
      {item.source_snippet && (
        <p className="mt-1 text-xs italic text-ink-muted">&ldquo;{item.source_snippet}&rdquo;</p>
      )}
      {rejected ? (
        <p className="mt-2 text-xs text-ink-muted">Left off your resume.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <Textarea
            rows={1}
            placeholder="Add a note or correction (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-xs"
          />
          <div className="flex gap-3">
            <Button type="button" variant="ghost" size="sm" isLoading={isSaving} onClick={() => save({ user_note: note || null })}>
              Save note
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-ink-muted hover:bg-paper-deep"
              isLoading={isSaving}
              onClick={() => save({ user_state: "rejected" })}
            >
              Leave this off
            </Button>
          </div>
          {saveError && <p className="text-xs text-critical">{saveError}</p>}
        </div>
      )}
    </div>
  );
}

function ToConfirmCard({
  item,
  bridgeId,
  onUpdate,
}: {
  item: SkillsBridgeItem;
  bridgeId: string;
  onUpdate: (item: SkillsBridgeItem) => void;
}) {
  // Seeded from item.user_note (not "") so the question state shows the right note straight away
  // if the item arrives already confirmed with a note from an earlier session, not just when the
  // user types, confirms, and undoes within the same page load.
  const [note, setNote] = useState(item.user_note ?? "");
  // One shared busy flag, not separate isSaving/isUndoing ones: the optimistic undo flips this
  // card straight to the question state (with its own buttons) while the undo request is still in
  // flight, so respond() must also be blocked until that request settles - otherwise a fast
  // re-confirm could resolve before the undo write does, and the later write (the undo) would win,
  // silently reverting a confirmation the user just made again.
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function respond(confirmed: boolean) {
    if (isBusy) return;
    setIsBusy(true);
    setActionError(null);
    try {
      const updated = await patchItem(bridgeId, item.id, {
        user_state: confirmed ? "confirmed" : "rejected",
        user_note: confirmed && note ? note : undefined,
      });
      if (!updated) {
        setActionError("Couldn't save. Please try again.");
        return;
      }
      onUpdate(updated);
    } catch {
      setActionError("Couldn't save. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUndo() {
    if (isBusy) return;
    setIsBusy(true);
    setActionError(null);
    // Optimistic: flip straight back to the question state with the previous note pre-filled,
    // without waiting on the network. Rolled back below if the write fails or the request itself
    // throws (e.g. offline), so a network error can't leave the button stuck on "Undoing..." with
    // nothing ever shown to the user.
    setNote(item.user_note ?? "");
    onUpdate({ ...item, user_state: "pending" });

    try {
      const updated = await patchItem(bridgeId, item.id, { user_state: "pending" });
      if (updated) {
        onUpdate(updated);
      } else {
        // Put the confirmed card back exactly as it was, rather than leaving the user looking at
        // a question state that never actually saved server-side.
        onUpdate(item);
        setActionError("Couldn't undo that. Please try again.");
      }
    } catch {
      onUpdate(item);
      setActionError("Couldn't undo that. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  if (item.user_state !== "pending") {
    const confirmed = item.user_state === "confirmed";
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        className={`rounded p-4 transition-colors duration-slow ease-editorial ${
          confirmed ? "bg-success-soft" : "bg-paper-deep opacity-60"
        }`}
      >
        <p className="flex items-center gap-2 text-sm text-ink">
          {confirmed && <CheckBadge />}
          {item.competency}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{confirmed ? "Confirmed and included." : "Left off your resume."}</p>
        {confirmed && item.user_note && <p className="mt-1 text-xs italic text-ink-muted">&ldquo;{item.user_note}&rdquo;</p>}
        {confirmed && (
          <button
            type="button"
            disabled={isBusy}
            onClick={handleUndo}
            className="mt-2 text-xs font-medium text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink hover:underline disabled:opacity-60"
          >
            {isBusy ? "Undoing…" : "Undo"}
          </button>
        )}
        {actionError && <p className="mt-2 text-xs text-critical">{actionError}</p>}
      </motion.div>
    );
  }

  return (
    <div className="rounded bg-attention-soft p-4">
      <p className="text-sm text-ink">{item.competency}</p>
      <p className="mt-1 text-xs text-attention">
        For: {item.source_job_title}, {item.source_company} → helps meet: {item.target_requirement}
      </p>
      <Textarea
        rows={1}
        placeholder="Describe it in your own words (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-3 text-xs"
      />
      <div className="mt-3 flex gap-3">
        <Button type="button" size="sm" isLoading={isBusy} onClick={() => respond(true)}>
          Yes, I did this
        </Button>
        <Button type="button" variant="outline" size="sm" isLoading={isBusy} onClick={() => respond(false)}>
          Not really
        </Button>
      </div>
      {actionError && <p className="mt-2 text-xs text-critical">{actionError}</p>}
    </div>
  );
}

type GapAction = "proxy" | "course" | "leave";

function GapCard({
  item,
  bridgeId,
  roles,
  onUpdate,
}: {
  item: SkillsBridgeItem;
  bridgeId: string;
  roles: Array<{ company: string; job_title: string }>;
  onUpdate: (item: SkillsBridgeItem) => void;
}) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const [claimNote, setClaimNote] = useState(item.user_note ?? "");
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Private prep note state
  const [showPrepNote, setShowPrepNote] = useState(false);
  const [prepNote, setPrepNote] = useState(item.user_note ?? "");
  const [lastAction, setLastAction] = useState<GapAction | null>(null);

  const isConfirmed = item.user_state === "confirmed";

  async function handleClaim() {
    if (roles.length === 0) {
      setActionError("No work experience found in your profile to attach this to.");
      return;
    }
    const role = roles[selectedRoleIndex] || roles[0];
    setIsBusy(true);
    setActionError(null);
    try {
      const updated = await patchItem(bridgeId, item.id, {
        user_state: "confirmed",
        source_company: role.company,
        source_job_title: role.job_title,
        user_note: claimNote || null,
        save_to_profile: saveToProfile,
      });
      if (!updated) {
        setActionError("Couldn't save. Please try again.");
        return;
      }
      onUpdate(updated);
      setIsClaiming(false);
    } catch {
      setActionError("Couldn't save. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUndo() {
    setIsBusy(true);
    setActionError(null);
    try {
      const updated = await patchItem(bridgeId, item.id, {
        user_state: "pending",
        reset_to_gap: true,
      });
      if (updated) {
        onUpdate(updated);
      } else {
        setActionError("Couldn't undo that. Please try again.");
      }
    } catch {
      setActionError("Couldn't undo that. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function savePrepNote(nextNote: string, action: GapAction) {
    setIsBusy(true);
    setActionError(null);
    try {
      const updated = await patchItem(bridgeId, item.id, { user_note: nextNote || null });
      if (!updated) {
        setActionError("Couldn't save note. Please try again.");
        return;
      }
      onUpdate(updated);
      setLastAction(action);
    } catch {
      setActionError("Couldn't save note. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleLeaveOff() {
    setPrepNote("");
    setLastAction("leave");
  }

  if (isConfirmed) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        className="rounded bg-success-soft p-4 transition-colors duration-slow ease-editorial"
      >
        <p className="flex items-start gap-2 text-sm text-ink">
          <CheckBadge />
          <span>
            <span className="font-medium">{item.competency}</span>
            {item.source_job_title && (
              <>
                <span className="text-ink-secondary"> at </span>
                <span className="font-medium">{item.source_job_title}</span>
                <span className="text-ink-secondary">, {item.source_company}</span>
              </>
            )}
            <span className="text-ink-secondary"> → added to your resume</span>
          </span>
        </p>
        {item.user_note && <p className="mt-1 text-xs italic text-ink-muted">&ldquo;{item.user_note}&rdquo;</p>}
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={handleUndo}
            className="text-xs font-medium text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink hover:underline disabled:opacity-60"
          >
            {isBusy ? "Undoing…" : "Undo"}
          </button>
        </div>
        {actionError && <p className="mt-2 text-xs text-critical">{actionError}</p>}
      </motion.div>
    );
  }

  return (
    <div className="rounded bg-paper-deep p-4">
      <p className="text-sm font-medium text-ink">{item.competency}</p>
      <p className="mt-1 text-xs text-ink-muted">Wanted for: {item.target_requirement}</p>

      {isClaiming ? (
        <div className="mt-3 flex flex-col gap-3 rounded border border-border bg-surface p-3">
          <div>
            <label className="block text-xs font-medium text-ink">
              Which role did you do this in?
            </label>
            {roles.length > 0 ? (
              <select
                value={selectedRoleIndex}
                onChange={(e) => setSelectedRoleIndex(Number(e.target.value))}
                className="mt-1 w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                {roles.map((role, idx) => (
                  <option key={`${role.company}-${role.job_title}-${idx}`} value={idx}>
                    {role.job_title} at {role.company}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-xs text-attention">
                No past roles found in your profile. Add a role to your profile to attach this.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-ink">
              Describe what you did (optional context / tools / metrics)
            </label>
            <Textarea
              rows={2}
              placeholder="e.g. Implemented historical snapshots and SCD Type 2 tables in Snowflake with dbt"
              value={claimNote}
              onChange={(e) => setClaimNote(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={saveToProfile}
              onChange={(e) => setSaveToProfile(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border text-accent focus:ring-accent"
            />
            <span>Also save this to my profile work history for future resumes</span>
          </label>

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              isLoading={isBusy}
              disabled={roles.length === 0}
              onClick={handleClaim}
            >
              Add to my experience
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              onClick={() => setIsClaiming(false)}
            >
              Cancel
            </Button>
          </div>
          {actionError && <p className="text-xs text-critical">{actionError}</p>}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-accent text-accent hover:bg-accent-soft"
              onClick={() => {
                setIsClaiming(true);
                setShowPrepNote(false);
              }}
            >
              I did this in a past role
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-ink-secondary"
              onClick={() => setShowPrepNote((prev) => !prev)}
            >
              {showPrepNote ? "Hide interview note" : "Interview prep note…"}
            </Button>
          </div>

          {showPrepNote && (
            <div className="mt-2 flex flex-col gap-2 rounded border border-border/50 bg-surface/60 p-3">
              <label className="block text-xs font-medium text-ink-muted">
                Private note for interview prep, never shown on your resume
              </label>
              <Textarea
                rows={1}
                placeholder="Optional notes"
                value={prepNote}
                onChange={(e) => setPrepNote(e.target.value)}
                className="text-xs"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isLoading={isBusy}
                  onClick={() => savePrepNote(prepNote || "Closest experience: ", "proxy")}
                >
                  Use my closest experience instead
                  <span className="block text-[11px] font-normal text-ink-muted">
                    Saves a private note framing your closest real experience
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isLoading={isBusy}
                  onClick={() => savePrepNote(prepNote || "Currently completing: ", "course")}
                >
                  Show I&apos;m learning it
                  <span className="block text-[11px] font-normal text-ink-muted">
                    Saves a private note. Only if it&apos;s true
                  </span>
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleLeaveOff}>
                  Leave it off
                  <span className="block text-[11px] font-normal text-ink-muted">
                    The honest default. Nothing added to your resume
                  </span>
                </Button>
              </div>
              {lastAction && (
                <p className="mt-1 text-xs text-ink-muted">
                  {lastAction === "leave" ? "Left off." : "Saved as a private note."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GapsSection({
  items,
  bridgeId,
  roles,
  onUpdate,
}: {
  items: SkillsBridgeItem[];
  bridgeId: string;
  roles: Array<{ company: string; job_title: string }>;
  onUpdate: (item: SkillsBridgeItem) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (items.length === 0) return null;

  const unconfirmedCount = items.filter((item) => item.user_state !== "confirmed").length;
  const visible = showAll ? items : items.slice(0, GAPS_PREVIEW_COUNT);
  const remaining = items.length - visible.length;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      {!isOpen ? (
        <p className="text-sm text-ink-secondary">
          {unconfirmedCount} gap{unconfirmedCount === 1 ? "" : "s"} we&apos;ll leave off unless you tell us otherwise.{" "}
          <button
            type="button"
            className="font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink hover:underline"
            onClick={() => setIsOpen(true)}
          >
            View
          </button>
        </p>
      ) : (
        <>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Honest gaps</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Nothing in your profile backed these up yet. If you actually have experience with any of these,
              click &ldquo;I did this in a past role&rdquo; to attach it to your resume.
            </p>
          </div>
          <StaggerList className="flex flex-col gap-3">
            {visible.map((item) => (
              <StaggerItem key={item.id}>
                <GapCard item={item} bridgeId={bridgeId} roles={roles} onUpdate={onUpdate} />
              </StaggerItem>
            ))}
          </StaggerList>
          {remaining > 0 && (
            <button
              type="button"
              className="self-start text-sm font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink hover:underline"
              onClick={() => setShowAll(true)}
            >
              View {remaining} more
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function SkillsBridgeReview({
  bridge,
  initialItems,
  roles = [],
  jobTitle,
  companyName,
  jobDescription,
  isPaidPlan,
  remaining,
  limit,
  onBack,
}: {
  bridge: SkillsBridge;
  initialItems: SkillsBridgeItem[];
  roles?: Array<{ company: string; job_title: string }>;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  isPaidPlan: boolean;
  remaining: number | null;
  limit: number;
  onBack: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [initialGapIds] = useState(() => new Set(initialItems.filter((i) => i.state === "gap").map((i) => i.id)));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState<{ limit: number } | null>(null);
  const { currentStage, stageIndex, progressPct } = useProgressStage(GENERATION_STAGES, isGenerating, 3500);

  function updateItem(updated: SkillsBridgeItem) {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  const totalCount = items.length;
  const matchedCount = items.filter((item) => item.user_state === "confirmed").length;
  const matchPct = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;
  const gapItems = items.filter((item) => initialGapIds.has(item.id));

  async function handleBuildResume() {
    setError(null);
    setLimitReached(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, companyName, jobDescription, bridgeId: bridge.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.code === "FREE_LIMIT_REACHED") {
          setLimitReached({ limit: data.limit });
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push(`/resume/${data.resume.id}`);
    } catch {
      setError("Something went wrong, and the request may have timed out. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded border border-border bg-surface p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-h3 text-ink">Your skills bridge</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            {bridge.mode === "pivot"
              ? "This looks like a career pivot, so we've translated your experience into the target role's language."
              : "This looks like a step up in your current field, so we've elevated the scope and impact of your real work."}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-xs text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink"
        >
          ← Edit target role
        </button>
      </div>

      <div>
        <p className="text-base font-medium text-ink">
          You match{" "}
          <CountUp value={matchedCount} className="tabular-nums" /> of {totalCount} must-haves
        </p>
        <ProgressBar value={matchPct} className="mt-2" />
        <p className="mt-3 text-sm text-ink-secondary">
          Here&apos;s how your experience lines up with this job. We only add what&apos;s true, so confirm
          anything we&apos;re unsure about.
        </p>
      </div>

      {GROUP_ORDER.map((group) => {
        const groupItems = items.filter((item) => item.state === group.state && !initialGapIds.has(item.id));
        if (groupItems.length === 0) return null;

        return (
          <div key={group.state} className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{group.title}</p>
              <p className="text-xs text-ink-muted">{group.blurb}</p>
            </div>
            <StaggerList className="flex flex-col gap-3">
              {groupItems.map((item) => (
                <StaggerItem key={item.id}>
                  {item.state === "matched" ? (
                    <MatchedCard item={item} bridgeId={bridge.id} onUpdate={updateItem} />
                  ) : (
                    <ToConfirmCard item={item} bridgeId={bridge.id} onUpdate={updateItem} />
                  )}
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        );
      })}

      <GapsSection items={gapItems} bridgeId={bridge.id} roles={roles} onUpdate={updateItem} />

      {error && <p className="text-sm text-critical">{error}</p>}

      {limitReached && (
        <div className="flex flex-col gap-2 rounded border border-attention/30 bg-attention-soft p-4">
          <p className="text-sm text-attention">
            You&apos;ve used all {limitReached.limit} free resume generations. Upgrade for unlimited resumes, cover
            letters, and downloads.
          </p>
          <Button href="/upgrade" size="sm" className="self-start">
            Upgrade now
          </Button>
        </div>
      )}

      {isGenerating && (
        <div className="flex flex-col gap-3.5 rounded-lg border border-accent/30 bg-accent-soft/40 p-5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg className="h-5 w-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-semibold text-ink">{currentStage}</span>
            </div>
            <span className="text-xs font-semibold text-accent tabular-nums">{progressPct}%</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="grid gap-2 pt-1 text-xs sm:grid-cols-2">
            {GENERATION_STAGES.map((stage, idx) => (
              <div
                key={stage}
                className={`flex items-center gap-2 transition-colors ${
                  idx < stageIndex
                    ? "font-medium text-success"
                    : idx === stageIndex
                    ? "font-semibold text-accent"
                    : "text-ink-muted"
                }`}
              >
                <span className="text-sm leading-none">
                  {idx < stageIndex ? "✓" : idx === stageIndex ? "▸" : "○"}
                </span>
                <span className="truncate">{stage.replace(/…/g, "")}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-ink-muted border-t border-accent/20 pt-2">
            Tailoring directly against your confirmed skills bridge. Resume workspace opens automatically once ready (~30s).
          </p>
        </div>
      )}

      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          size="md"
          isLoading={isGenerating}
          disabled={!!limitReached || isGenerating}
          onClick={handleBuildResume}
          className="self-start px-6 py-3"
        >
          {isGenerating ? "Drafting resume…" : "Build my resume"}
        </Button>
        {!isGenerating && (
          <p className="text-xs text-ink-muted">
            ~30-40s{!isPaidPlan && remaining !== null ? ` · ${remaining} of ${limit} free generations left` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
