"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useProgressMessages } from "@/lib/hooks/useProgressMessages";
import type { BridgeItemState, SkillsBridge, SkillsBridgeItem } from "@/types";

const GENERATION_MESSAGES = [
  "Reading the job description…",
  "Applying your confirmed bridge…",
  "Writing your resume…",
  "Almost done…",
];

const GROUP_ORDER: Array<{ state: BridgeItemState; title: string; blurb: string }> = [
  { state: "matched", title: "You've got these", blurb: "Backed by what's already in your profile." },
  { state: "to_confirm", title: "Worth confirming", blurb: "Likely, but only counts once you say so." },
];

const GAPS_PREVIEW_COUNT = 3;

async function patchItem(
  bridgeId: string,
  itemId: string,
  body: { user_state?: "confirmed" | "rejected"; user_note?: string | null }
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
  const [isSaving, setIsSaving] = useState(false);
  const rejected = item.user_state === "rejected";

  async function save(patch: { user_state?: "confirmed" | "rejected"; user_note?: string | null }) {
    setIsSaving(true);
    const updated = await patchItem(bridgeId, item.id, patch);
    setIsSaving(false);
    if (updated) onUpdate(updated);
  }

  return (
    <div className={`rounded-xl p-4 ${rejected ? "bg-gray-50 opacity-60" : "bg-green-50"}`}>
      <p className="text-sm text-gray-800">
        <span className="font-medium">{item.competency}</span>
        <span className="text-gray-500"> at </span>
        <span className="font-medium">{item.source_job_title}</span>
        <span className="text-gray-500">, {item.source_company}</span>
        <span className="text-gray-500"> → helps meet: </span>
        <span className="font-medium">{item.target_requirement}</span>
      </p>
      {item.source_snippet && <p className="mt-1 text-xs italic text-gray-500">&ldquo;{item.source_snippet}&rdquo;</p>}
      {rejected ? (
        <p className="mt-2 text-xs text-gray-500">Left off your resume.</p>
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
              className="text-gray-500 hover:bg-gray-100"
              isLoading={isSaving}
              onClick={() => save({ user_state: "rejected" })}
            >
              Leave this off
            </Button>
          </div>
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
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function respond(confirmed: boolean) {
    setIsSaving(true);
    const updated = await patchItem(bridgeId, item.id, {
      user_state: confirmed ? "confirmed" : "rejected",
      user_note: confirmed && note ? note : undefined,
    });
    setIsSaving(false);
    if (updated) onUpdate(updated);
  }

  if (item.user_state !== "pending") {
    const confirmed = item.user_state === "confirmed";
    return (
      <div className={`rounded-xl p-4 ${confirmed ? "bg-green-50" : "bg-gray-50 opacity-60"}`}>
        <p className="text-sm text-gray-800">{item.competency}</p>
        <p className="mt-1 text-xs text-gray-500">{confirmed ? "Confirmed and included." : "Left off your resume."}</p>
        {confirmed && item.user_note && <p className="mt-1 text-xs italic text-gray-500">&ldquo;{item.user_note}&rdquo;</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-amber-50 p-4">
      <p className="text-sm text-amber-900">{item.competency}</p>
      <p className="mt-1 text-xs text-amber-700">
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
        <Button type="button" size="sm" isLoading={isSaving} onClick={() => respond(true)}>
          Yes, I did this
        </Button>
        <Button type="button" variant="outline" size="sm" isLoading={isSaving} onClick={() => respond(false)}>
          Not really
        </Button>
      </div>
    </div>
  );
}

type GapAction = "proxy" | "course" | "leave";

function GapCard({ item, bridgeId, onUpdate }: { item: SkillsBridgeItem; bridgeId: string; onUpdate: (item: SkillsBridgeItem) => void }) {
  const [note, setNote] = useState(item.user_note ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastAction, setLastAction] = useState<GapAction | null>(null);

  async function saveNote(nextNote: string, action: GapAction) {
    setIsSaving(true);
    const updated = await patchItem(bridgeId, item.id, { user_note: nextNote || null });
    setIsSaving(false);
    if (updated) {
      onUpdate(updated);
      setLastAction(action);
    }
  }

  function handleLeaveOff() {
    // The honest default: there is no "acted on this gap" state to persist, so this is
    // deliberately local-only (no request) rather than faking a save for doing nothing.
    setNote("");
    setLastAction("leave");
  }

  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-sm text-gray-800">{item.competency}</p>
      <p className="mt-1 text-xs text-gray-500">Wanted for: {item.target_requirement}</p>
      <label className="mt-3 block text-xs font-medium text-gray-500">
        Private note for interview prep, never shown on your resume
      </label>
      <Textarea
        rows={1}
        placeholder="Optional"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-1 text-xs"
      />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isLoading={isSaving}
          onClick={() => saveNote(note || "Closest experience: ", "proxy")}
        >
          Use my closest experience instead
          <span className="block text-[11px] font-normal text-gray-400">
            Saves a private note framing your closest real experience
          </span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isLoading={isSaving}
          onClick={() => saveNote(note || "Currently completing: ", "course")}
        >
          Show I&apos;m learning it
          <span className="block text-[11px] font-normal text-gray-400">
            Saves a private note. Only if it&apos;s true
          </span>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleLeaveOff}>
          Leave it off
          <span className="block text-[11px] font-normal text-gray-400">
            The honest default. Nothing added to your resume
          </span>
        </Button>
      </div>
      {lastAction && (
        <p className="mt-2 text-xs text-gray-500">
          {lastAction === "leave" ? "Left off." : "Saved as a private note."}
        </p>
      )}
    </div>
  );
}

function GapsSection({ items, bridgeId, onUpdate }: { items: SkillsBridgeItem[]; bridgeId: string; onUpdate: (item: SkillsBridgeItem) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (items.length === 0) return null;

  const visible = showAll ? items : items.slice(0, GAPS_PREVIEW_COUNT);
  const remaining = items.length - visible.length;

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 pt-5">
      {!isOpen ? (
        <p className="text-sm text-gray-500">
          {items.length} gap{items.length === 1 ? "" : "s"} we&apos;ll leave off rather than fake.{" "}
          <button type="button" className="font-medium text-gray-600 hover:underline" onClick={() => setIsOpen(true)}>
            View
          </button>
        </p>
      ) : (
        <>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Honest gaps</p>
            <p className="mt-1 text-sm text-gray-500">
              Nothing in your history backs these up yet. You don&apos;t have to act on any of them. If you
              want, here&apos;s how to handle one honestly.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {visible.map((item) => (
              <GapCard key={item.id} item={item} bridgeId={bridgeId} onUpdate={onUpdate} />
            ))}
          </div>
          {remaining > 0 && (
            <button
              type="button"
              className="self-start text-sm font-medium text-gray-500 hover:underline"
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState<{ limit: number } | null>(null);
  const progressMessage = useProgressMessages(GENERATION_MESSAGES, isGenerating);

  function updateItem(updated: SkillsBridgeItem) {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  const totalCount = items.length;
  const matchedCount = items.filter((item) => item.state !== "gap" && item.user_state !== "rejected").length;
  const matchPct = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;
  const gapItems = items.filter((item) => item.state === "gap");

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
    <div className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Your skills bridge</h2>
          <p className="mt-1 text-sm text-gray-500">
            {bridge.mode === "pivot"
              ? "This looks like a career pivot, so we've translated your experience into the target role's language."
              : "This looks like a step up in your current field, so we've elevated the scope and impact of your real work."}
          </p>
        </div>
        <button type="button" onClick={onBack} className="shrink-0 text-xs text-gray-400 hover:text-gray-700">
          ← Edit target role
        </button>
      </div>

      <div>
        <p className="text-base font-medium text-gray-900">
          You match {matchedCount} of {totalCount} must-haves
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${matchPct}%` }} />
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Here&apos;s how your experience lines up with this job. We only add what&apos;s true, so confirm
          anything we&apos;re unsure about.
        </p>
      </div>

      {GROUP_ORDER.map((group) => {
        const groupItems = items.filter((item) => item.state === group.state);
        if (groupItems.length === 0) return null;

        return (
          <div key={group.state} className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{group.title}</p>
              <p className="text-xs text-gray-400">{group.blurb}</p>
            </div>
            <div className="flex flex-col gap-3">
              {groupItems.map((item) =>
                item.state === "matched" ? (
                  <MatchedCard key={item.id} item={item} bridgeId={bridge.id} onUpdate={updateItem} />
                ) : (
                  <ToConfirmCard key={item.id} item={item} bridgeId={bridge.id} onUpdate={updateItem} />
                )
              )}
            </div>
          </div>
        );
      })}

      <GapsSection items={gapItems} bridgeId={bridge.id} onUpdate={updateItem} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {limitReached && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            You&apos;ve used all {limitReached.limit} free resume generations. Upgrade for unlimited resumes, cover
            letters, and downloads.
          </p>
          <Link href="/upgrade" className="self-start">
            <Button type="button" size="sm">
              Upgrade now
            </Button>
          </Link>
        </div>
      )}

      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          size="md"
          isLoading={isGenerating}
          disabled={!!limitReached}
          onClick={handleBuildResume}
          className="self-start px-6 py-3"
        >
          Build my resume
        </Button>
        {isGenerating && <p className="text-sm text-gray-500">{progressMessage}</p>}
        {!isGenerating && (
          <p className="text-xs text-gray-400">
            ~30-40s{!isPaidPlan && remaining !== null ? ` · ${remaining} of ${limit} free generations left` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
