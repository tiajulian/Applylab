"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountUp } from "@/components/ui/CountUp";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { ChevronDownIcon, AlertTriangleIcon } from "@/components/ui/icons/LucideIcons";
import { useProgressStage } from "@/lib/hooks/useProgressMessages";
import { useSaveAction } from "@/lib/hooks/useSaveAction";
import { createClient } from "@/lib/supabase/client";
import { SignupAtGenerateModal } from "@/components/auth/SignupAtGenerateModal";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import type { CanonicalTemplate, SkillsBridge, SkillsBridgeItem } from "@/types";


const GENERATION_STAGES = [
  "Applying your confirmed skills bridge…",
  "Tailoring career impact bullets to target role…",
  "Optimizing layout density & ATS keyword match…",
  "Finalizing SEEK-ready resume formatting…",
];

const GAPS_PREVIEW_COUNT = 3;
const REWARD_BEAT_MS = 1500;

function CheckBadge({ size = 16 }: { size?: number }) {
  const iconSize = Math.round(size * 0.55);
  return (
    <motion.span
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-pill bg-success text-on-accent"
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 12 12" fill="none" aria-hidden="true">
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

function AccordionHeader({
  pip,
  title,
  blurb,
  isOpen,
  onClick,
}: {
  pip: ReactNode;
  title: string;
  blurb: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 text-left transition-colors duration-fast ease-editorial hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {pip}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[17px] text-ink">{title}</span>
        <span className="block text-xs text-ink-muted">{blurb}</span>
      </span>
      <ChevronDownIcon
        className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-fast ease-editorial ${
          isOpen ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

function CoveredRow({
  item,
  bridgeId,
  onUpdate,
}: {
  item: SkillsBridgeItem;
  bridgeId: string;
  onUpdate: (item: SkillsBridgeItem) => void;
}) {
  const [note, setNote] = useState(item.user_note ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { isSaving, error: saveError, run } = useSaveAction<SkillsBridgeItem>();
  const rejected = item.user_state === "rejected";

  async function save(patch: { user_state?: "confirmed" | "rejected"; user_note?: string | null }) {
    const updated = await run(() => patchItem(bridgeId, item.id, patch));
    if (updated) onUpdate(updated);
  }

  if (rejected) {
    return (
      <div className="flex items-center gap-2.5 border-b border-border py-3 opacity-60 last:border-b-0">
        <span className="h-[18px] w-[18px] shrink-0 rounded-pill bg-paper-deep" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">{item.competency}</p>
          <p className="mt-0.5 text-xs text-ink-muted">Left off your resume.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-start gap-2.5 rounded px-0 py-3 text-left transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CheckBadge size={18} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ink">{item.competency}</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            Covers <span className="font-medium text-ink">{item.target_requirement}</span>
          </span>
        </span>
        <ChevronDownIcon
          className={`mt-0.5 h-4 w-4 shrink-0 text-ink-muted transition-transform duration-fast ease-editorial ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-3 py-3.5 pl-[42px] pr-1">
          {item.source_snippet && (
            <p className="border-l-2 border-success/40 pl-3 text-xs italic leading-relaxed text-ink-muted">
              &ldquo;{item.source_snippet}&rdquo;
            </p>
          )}
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                rows={1}
                placeholder="Add a note or correction (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-xs"
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isLoading={isSaving}
                  onClick={() => save({ user_note: note || null }).then(() => setIsEditing(false))}
                >
                  Save note
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
              {saveError && <p className="text-xs text-critical">{saveError}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {item.user_note && <p className="text-xs italic text-ink-muted">&ldquo;{item.user_note}&rdquo;</p>}
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                  {item.user_note ? "Edit note" : "Add a note"}
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
      )}
    </div>
  );
}

function CoveredSection({
  items,
  bridgeId,
  onUpdate,
}: {
  items: SkillsBridgeItem[];
  bridgeId: string;
  onUpdate: (item: SkillsBridgeItem) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <AccordionHeader
        pip={<CheckBadge size={26} />}
        title={`Already covered · ${items.length}`}
        blurb="Going on your resume. Nothing for you to do."
        isOpen={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen && (
        <div className="rounded-lg border border-border bg-surface px-4">
          <StaggerList className="flex flex-col">
            {items.map((item) => (
              <StaggerItem key={item.id}>
                <CoveredRow item={item} bridgeId={bridgeId} onUpdate={onUpdate} />
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}
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
        className="border-b border-border py-3 transition-colors duration-slow ease-editorial last:border-b-0"
      >
        <p className="flex items-start gap-2 text-sm text-ink">
          <CheckBadge size={18} />
          <span>
            <span className="font-medium">{item.competency}</span>
            {item.source_job_title && (
              <>
                <span className="text-ink-secondary"> at </span>
                <span className="font-medium">{item.source_job_title}</span>
                <span className="text-ink-secondary">, {item.source_company}</span>
              </>
            )}
            <span className="text-ink-secondary"> · added to your resume</span>
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

  if (isClaiming) {
    return (
      <div className="border-b border-border py-3 last:border-b-0">
        <p className="text-sm font-medium text-ink">{item.competency}</p>
        <p className="mt-1 text-xs text-ink-muted">Wanted for: {item.target_requirement}</p>
        <div className="mt-3 flex flex-col gap-3 rounded border border-border bg-paper-deep/40 p-3">
          <div>
            <label className="block text-xs font-medium text-ink">Which role did you do this in?</label>
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
            <Button type="button" size="sm" isLoading={isBusy} disabled={roles.length === 0} onClick={handleClaim}>
              Add to my experience
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => setIsClaiming(false)}>
              Cancel
            </Button>
          </div>
          {actionError && <p className="text-xs text-critical">{actionError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink">{item.competency}</p>
          <p className="mt-0.5 text-xs text-ink-muted">Wanted for: {item.target_requirement}</p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
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
      </div>

      {showPrepNote && (
        <div className="mt-3 flex flex-col gap-2 rounded border border-border/50 bg-paper-deep/40 p-3">
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
    <div className="flex flex-col gap-2.5">
      <AccordionHeader
        pip={
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-pill bg-paper-deep text-ink-muted">
            <AlertTriangleIcon className="h-3.5 w-3.5" />
          </span>
        }
        title={`Not enough evidence yet · ${unconfirmedCount}`}
        blurb="Left off your resume so every line holds up."
        isOpen={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-ink-secondary">
            The ad asks for these and there&apos;s nothing in your profile to back them up, so we won&apos;t write
            them in. Done one somewhere? Tell us and we&apos;ll trace it properly.
          </p>
          <StaggerList className="flex flex-col">
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
        </div>
      )}
    </div>
  );
}

function RewardBeatPanel({ requirement }: { requirement: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-4 rounded-lg border border-success/30 bg-success-soft p-5 sm:p-7"
    >
      <CheckBadge size={34} />
      <div className="flex flex-col gap-0.5">
        <p className="font-display text-lg text-ink">That covers one more requirement</p>
        <p className="text-sm text-success">{requirement}</p>
      </div>
    </div>
  );
}

function DonePanel({
  delta,
  onChangeAnswer,
  isResetting,
}: {
  delta: number;
  onChangeAnswer: () => void;
  isResetting: boolean;
}) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-success/30 bg-success-soft p-5 sm:p-7">
      <CheckBadge size={34} />
      <div className="flex flex-col gap-0.5">
        <p className="font-display text-lg text-ink">All done, your bridge is ready</p>
        <p className="text-sm text-success">
          {delta > 0
            ? `${delta} more requirement${delta > 1 ? "s" : ""} covered, all traced to your real work.`
            : "We'll build from what your profile already backs up."}
        </p>
      </div>
      <button
        type="button"
        disabled={isResetting}
        onClick={onChangeAnswer}
        className="ml-auto shrink-0 self-start text-xs font-medium text-success transition-colors duration-fast ease-editorial hover:text-ink hover:underline disabled:opacity-60"
      >
        {isResetting ? "Reopening…" : "Change an answer"}
      </button>
    </div>
  );
}

function ActiveQuestionCard({
  item,
  askedLabel,
  dots,
  onYes,
  onNo,
}: {
  item: SkillsBridgeItem;
  askedLabel: string;
  dots: ReactNode;
  onYes: (item: SkillsBridgeItem, note: string) => void;
  onNo: (item: SkillsBridgeItem) => void;
}) {
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  function handleYesClick() {
    if (isBusy) return;
    setIsBusy(true);
    onYes(item, note);
  }

  function handleNoClick() {
    if (isBusy) return;
    setIsBusy(true);
    onNo(item);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">{askedLabel}</span>
        {dots}
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-accent/30 bg-accent-soft p-5 sm:p-7">
        <p className="max-w-[34ch] font-display text-[22px] leading-snug text-ink">{item.competency}</p>
        <div className="flex flex-col items-stretch gap-3.5 sm:flex-row sm:items-center sm:gap-6">
          <Button
            type="button"
            size="lg"
            isLoading={isBusy}
            disabled={isBusy}
            onClick={handleYesClick}
            className="justify-center px-8 py-3.5 text-[16.5px] shadow-[0_3px_12px_-3px_rgba(198,113,57,0.55)] sm:w-auto"
          >
            Yes, I did this
          </Button>
          <button
            type="button"
            disabled={isBusy}
            onClick={handleNoClick}
            className="text-[15px] font-medium text-ink-secondary underline underline-offset-[3px] decoration-1 transition-colors duration-fast ease-editorial hover:text-ink disabled:opacity-60"
          >
            No, I didn&apos;t
          </button>
        </div>
        {!noteOpen ? (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="self-start text-xs text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink hover:underline"
          >
            Add context (optional)
          </button>
        ) : (
          <Textarea
            rows={1}
            autoFocus
            placeholder="What did that look like, in your words?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-sm"
          />
        )}
      </div>
    </motion.div>
  );
}

function QuestionQueue({
  items,
  bridgeId,
  initialMatchedCount,
  matchedCount,
  onUpdate,
}: {
  items: SkillsBridgeItem[];
  bridgeId: string;
  initialMatchedCount: number;
  matchedCount: number;
  onUpdate: (item: SkillsBridgeItem) => void;
}) {
  const [beatItem, setBeatItem] = useState<SkillsBridgeItem | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const toConfirmItems = items.filter((item) => item.state === "to_confirm");
  const pending = toConfirmItems.filter((item) => item.user_state === "pending");
  const delta = matchedCount - initialMatchedCount;

  // Optimistic, same shape as the old ToConfirmCard.handleUndo: the score/beat show before the
  // PATCH settles so the reward reads instantly, and a failure rolls back to the exact prior item
  // (clearing the beat immediately rather than waiting out the full 1.5s) instead of leaving the
  // user looking at a false reward for something that never actually saved.
  async function handleYes(item: SkillsBridgeItem, note: string) {
    setQueueError(null);
    onUpdate({ ...item, user_state: "confirmed", user_note: note || item.user_note });
    setBeatItem(item);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setBeatItem(null), REWARD_BEAT_MS);

    const updated = await patchItem(bridgeId, item.id, {
      user_state: "confirmed",
      user_note: note || undefined,
    });
    if (updated) {
      onUpdate(updated);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setBeatItem(null);
      onUpdate(item);
      setQueueError("Couldn't save that answer. Please try again.");
    }
  }

  async function handleNo(item: SkillsBridgeItem) {
    setQueueError(null);
    onUpdate({ ...item, user_state: "rejected" });
    const updated = await patchItem(bridgeId, item.id, { user_state: "rejected" });
    if (updated) {
      onUpdate(updated);
    } else {
      onUpdate(item);
      setQueueError("Couldn't save that answer. Please try again.");
    }
  }

  async function handleChangeAnswer() {
    setIsResetting(true);
    setQueueError(null);
    const answered = toConfirmItems.filter((item) => item.user_state !== "pending");
    answered.forEach((item) => onUpdate({ ...item, user_state: "pending" }));
    const results = await Promise.all(
      answered.map((item) => patchItem(bridgeId, item.id, { user_state: "pending" }))
    );
    results.forEach((updated) => {
      if (updated) onUpdate(updated);
    });
    if (results.some((r) => !r)) {
      setQueueError("Some answers couldn't be reopened. Please try again.");
    }
    setIsResetting(false);
  }

  if (toConfirmItems.length === 0) return null;

  const current = pending[0];
  const answeredCount = toConfirmItems.length - pending.length;
  const askedLabel = pending.length === 1 ? "Last question" : `Question ${answeredCount + 1} of ${toConfirmItems.length}`;

  const dots = (
    <div aria-hidden="true" className="ml-auto flex gap-1.5">
      {toConfirmItems.map((q) => {
        const done = q.user_state !== "pending";
        const isCurrent = current?.id === q.id;
        return (
          <span
            key={q.id}
            className={`h-2 w-2 rounded-pill transition-transform duration-fast ease-editorial ${
              done ? "bg-success" : isCurrent ? "scale-125 bg-accent" : "bg-accent/25"
            }`}
          />
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {beatItem ? (
        <RewardBeatPanel requirement={beatItem.target_requirement} />
      ) : current ? (
        <ActiveQuestionCard
          key={current.id}
          item={current}
          askedLabel={askedLabel}
          dots={dots}
          onYes={handleYes}
          onNo={handleNo}
        />
      ) : (
        <DonePanel delta={delta} onChangeAnswer={handleChangeAnswer} isResetting={isResetting} />
      )}
      {queueError && <p className="text-sm text-critical">{queueError}</p>}
    </div>
  );
}

function ScoreRail({
  matchedCount,
  totalCount,
  initialMatchedCount,
}: {
  matchedCount: number;
  totalCount: number;
  initialMatchedCount: number;
}) {
  const pct = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;
  const delta = matchedCount - initialMatchedCount;

  return (
    <aside className="flex flex-col gap-4 min-[1040px]:sticky min-[1040px]:top-24">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6 shadow-pop">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted">Your match</span>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-1">
            <CountUp
              value={matchedCount}
              className="font-display text-[46px] leading-none tracking-tight text-accent tabular-nums sm:text-[56px]"
            />
            <span className="font-display text-[22px] leading-none tracking-tight text-ink-muted sm:text-[26px]">
              /{totalCount}
            </span>
          </div>
          <span className="text-sm font-semibold text-ink">must-haves matched</span>
        </div>
        <ProgressBar value={pct} barClassName="bg-success" />
        <p className="text-sm text-ink-secondary">
          {delta > 0 ? `Up ${delta} since you started.` : "This climbs as you answer."}
        </p>
      </div>
    </aside>
  );
}

export function SkillsBridgeReview({
  bridge,
  initialItems,
  roles = [],
  jobTitle,
  companyName,
  jobDescription,
  template = "clean",
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
  template?: CanonicalTemplate;
  isPaidPlan: boolean;
  remaining: number | null;
  limit: number;
  onBack: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [initialGapIds] = useState(() => new Set(initialItems.filter((i) => i.state === "gap").map((i) => i.id)));
  const [initialMatchedCount] = useState(
    () => initialItems.filter((i) => i.user_state === "confirmed").length
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState<{ limit: number } | null>(null);
  const [stillWorking, setStillWorking] = useState(false);
  const { currentStage, stageIndex } = useProgressStage(GENERATION_STAGES, isGenerating, 3500);

  const [showSignupModal, setShowSignupModal] = useState(false);
  const [candidateFullName, setCandidateFullName] = useState("");

  // A build past this point is unusually slow (real ones finish in ~30-40s) - say so rather than
  // let the same stage text sit unexplained, which reads as stuck.
  useEffect(() => {
    if (!isGenerating) {
      setStillWorking(false);
      return;
    }
    const timer = setTimeout(() => setStillWorking(true), 60_000);
    return () => clearTimeout(timer);
  }, [isGenerating]);

  function updateItem(updated: SkillsBridgeItem) {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  const totalCount = items.length;
  const matchedCount = items.filter((item) => item.user_state === "confirmed").length;
  const gapItems = items.filter((item) => initialGapIds.has(item.id));
  const nonGapItems = items.filter((item) => !initialGapIds.has(item.id));
  const coveredItems = nonGapItems.filter(
    (item) => item.user_state === "confirmed" || (item.state === "matched" && item.user_state === "rejected")
  );
  const pendingCount = nonGapItems.filter(
    (item) => item.state === "to_confirm" && item.user_state === "pending"
  ).length;

  async function executeGenerateResume() {
    setError(null);
    setLimitReached(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          companyName,
          jobDescription,
          template,
          bridgeId: bridge.id,
        }),
      });

      const data = await response.json();


      if (!response.ok) {
        if (response.status === 403 && data.code === "FREE_LIMIT_REACHED") {
          setLimitReached({ limit: data.limit });
          setIsGenerating(false);
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        setIsGenerating(false);
        return;
      }

      // Leave isGenerating true here: router.push navigation isn't instant, and
      // clearing it now would drop the loading UI while the new page is still loading.
      router.push(`/resume/${data.resume.id}?fromGeneration=1`);
    } catch {
      setError("Something went wrong, and the request may have timed out. Please try again.");
      setIsGenerating(false);
    }
  }

  // A free user who has already spent their resume-generation quota can only ever dead-end at the
  // same FREE_LIMIT_REACHED response /api/generate-resume would return, so this is checked
  // up front rather than left to executeGenerateResume's own reactive 403 handling.
  const resumeQuotaExhausted = !isPaidPlan && remaining !== null && remaining <= 0;

  async function handleBuildResume() {
    if (resumeQuotaExhausted) {
      setLimitReached({ limit });
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.is_anonymous) {
      setCandidateFullName(user.user_metadata?.full_name ?? "");
      setShowSignupModal(true);
      return;
    }

    await executeGenerateResume();
  }

  const ctaLabel = isGenerating
    ? "Drafting resume…"
    : pendingCount > 0
    ? `Answer ${pendingCount} question${pendingCount === 1 ? "" : "s"} to continue`
    : error
    ? "Try again"
    : "Build my resume";

  return (
    <div className="flex flex-col gap-6">
      <SignupAtGenerateModal
        isOpen={showSignupModal}
        defaultFullName={candidateFullName}
        onClose={() => setShowSignupModal(false)}
        onSuccess={() => {
          setShowSignupModal(false);
          executeGenerateResume();
        }}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-3.5 flex-wrap">
          <h2 className="font-display text-h3 text-ink">Your skills bridge</h2>
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 text-xs text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink hover:underline"
          >
            Edit target role
          </button>
        </div>
        <p className="max-w-[58ch] text-[15.5px] leading-relaxed text-ink-secondary">
          {bridge.mode === "pivot"
            ? "This looks like a career change, so we've matched your real experience to the words this job uses. Answer a few questions and we'll build from what you've actually done."
            : "This looks like a step up in your field, so we've framed your real experience at the scope this job wants. Answer a few questions and we'll build from what you've actually done."}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 min-[1040px]:grid-cols-[minmax(0,1fr)_300px] min-[1040px]:gap-[30px]">
        <div className="flex flex-col gap-6">
          <QuestionQueue
            items={nonGapItems}
            bridgeId={bridge.id}
            initialMatchedCount={initialMatchedCount}
            matchedCount={matchedCount}
            onUpdate={updateItem}
          />

          <div className="flex flex-col gap-3">
            <CoveredSection items={coveredItems} bridgeId={bridge.id} onUpdate={updateItem} />
            <GapsSection items={gapItems} bridgeId={bridge.id} roles={roles} onUpdate={updateItem} />
          </div>

          {error && <p className="text-sm text-critical">{error}</p>}

          <LimitReachedModal
            isOpen={!!limitReached}
            onClose={() => setLimitReached(null)}
            title="You've used your free resumes"
            message={`You've used all ${limitReached?.limit ?? 2} of your free resume generations. Upgrade for unlimited resumes, cover letters, and downloads.`}
          />

          {isGenerating && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-3.5 rounded-lg border border-accent/30 bg-accent-soft/40 p-5 transition-all duration-300"
            >
              <div className="flex items-center gap-2.5">
                <svg className="h-5 w-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-semibold text-ink">{currentStage}</span>
              </div>

              <div className="relative h-2 w-full overflow-hidden rounded-full bg-paper-deep">
                <div className="indeterminate-bar" />
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

              {stillWorking && (
                <p className="text-xs font-medium text-accent">
                  Still working, this one&apos;s taking longer than usual. No need to refresh, it&apos;ll open here
                  once it&apos;s ready.
                </p>
              )}

              <p className="text-[11px] text-ink-muted border-t border-accent/20 pt-2">
                Tailoring directly against your confirmed skills bridge. Resume workspace opens automatically once ready (~30s).
              </p>
            </div>
          )}

          <div className="flex flex-col items-start gap-2 pt-1">
            <Button
              type="button"
              size="md"
              isLoading={isGenerating}
              // Stays clickable (not natively `disabled`) when only the resume quota is
              // exhausted, so the tap still reaches handleBuildResume's short-circuit above and
              // pops the limitReached modal, instead of a disabled button silently eating the tap.
              disabled={resumeQuotaExhausted ? false : !!limitReached || isGenerating || pendingCount > 0}
              onClick={handleBuildResume}
              className={`self-start px-6 py-3 ${resumeQuotaExhausted ? "opacity-50 hover:-translate-y-0 active:translate-y-0" : ""}`}
            >
              {ctaLabel}
            </Button>
            {!isGenerating && (
              <>
                {resumeQuotaExhausted ? (
                  <p className="text-xs text-ink-muted">
                    You&apos;ve used all {limit} of your free resume generations.{" "}
                    <Link href="/upgrade" className="font-medium text-accent hover:underline">
                      Upgrade
                    </Link>{" "}
                    for unlimited resumes, cover letters, and downloads.
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted">
                    ~30-40s{!isPaidPlan && remaining !== null ? ` · ${remaining} of ${limit} free generations left` : ""}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <ScoreRail matchedCount={matchedCount} totalCount={totalCount} initialMatchedCount={initialMatchedCount} />
      </div>
    </div>
  );
}
