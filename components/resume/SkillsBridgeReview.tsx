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
  { state: "matched", title: "Matched", blurb: "Backed by what's already in your profile." },
  { state: "to_confirm", title: "Worth confirming", blurb: "Likely, but only counts once you say so." },
  { state: "gap", title: "Honest gaps", blurb: "The role wants this and there's nothing to back it yet - never used to write your resume." },
];

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
    <div className={`rounded-lg border p-4 ${rejected ? "border-gray-100 bg-gray-50 opacity-60" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-800">
          <span className="font-medium">{item.competency}</span>
          <span className="text-gray-400"> at </span>
          <span className="font-medium">{item.source_job_title}</span>
          <span className="text-gray-400">, {item.source_company}</span>
          <span className="text-gray-400"> → proves you can meet: </span>
          <span className="font-medium">{item.target_requirement}</span>
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
            rejected ? "bg-gray-200 text-gray-500" : "bg-green-100 text-green-700"
          }`}
        >
          {rejected ? "Rejected" : "Confirmed"}
        </span>
      </div>
      {item.source_snippet && <p className="mt-1 text-xs italic text-gray-500">&ldquo;{item.source_snippet}&rdquo;</p>}
      {!rejected && (
        <div className="mt-3 flex flex-col gap-2">
          <Textarea
            rows={1}
            placeholder="Add a note or correction (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-xs"
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" isLoading={isSaving} onClick={() => save({ user_note: note || null })}>
              Save note
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              isLoading={isSaving}
              onClick={() => save({ user_state: "rejected" })}
            >
              Reject
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
      <div className={`rounded-lg border p-4 ${confirmed ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-gray-800">{item.competency}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
              confirmed ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
            }`}
          >
            {confirmed ? "Confirmed" : "Not used"}
          </span>
        </div>
        {confirmed && item.user_note && <p className="mt-1 text-xs italic text-gray-500">&ldquo;{item.user_note}&rdquo;</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
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
      <div className="mt-2 flex gap-2">
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

function GapCard({ item, bridgeId, onUpdate }: { item: SkillsBridgeItem; bridgeId: string; onUpdate: (item: SkillsBridgeItem) => void }) {
  const [note, setNote] = useState(item.user_note ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function saveNote() {
    setIsSaving(true);
    const updated = await patchItem(bridgeId, item.id, { user_note: note || null });
    setIsSaving(false);
    if (updated) onUpdate(updated);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-800">{item.competency}</p>
      <p className="mt-1 text-xs text-gray-500">Wanted for: {item.target_requirement}</p>
      <Textarea
        rows={1}
        placeholder="Note it for yourself, not used on the resume"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-3 text-xs"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setNote((n) => n || "Closest experience: ")}>
          Position closest experience as a proxy
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setNote((n) => n || "Currently completing: ")}>
          Add a course in progress
        </Button>
        <Button type="button" variant="ghost" size="sm" isLoading={isSaving} onClick={saveNote}>
          Save note
        </Button>
      </div>
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

  const confirmedCount = items.filter((item) => item.user_state === "confirmed").length;

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
    <div className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-6">
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

      {GROUP_ORDER.map((group) => {
        const groupItems = items.filter((item) => item.state === group.state);
        if (groupItems.length === 0) return null;

        return (
          <div key={group.state} className="flex flex-col gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{group.title}</p>
              <p className="text-xs text-gray-400">{group.blurb}</p>
            </div>
            <div className="flex flex-col gap-2">
              {groupItems.map((item) =>
                item.state === "matched" ? (
                  <MatchedCard key={item.id} item={item} bridgeId={bridge.id} onUpdate={updateItem} />
                ) : item.state === "to_confirm" ? (
                  <ToConfirmCard key={item.id} item={item} bridgeId={bridge.id} onUpdate={updateItem} />
                ) : (
                  <GapCard key={item.id} item={item} bridgeId={bridge.id} onUpdate={updateItem} />
                )
              )}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-gray-400">
        Only the {confirmedCount} confirmed item{confirmedCount === 1 ? "" : "s"} above will be used to write your resume.
      </p>

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
        <Button type="button" isLoading={isGenerating} disabled={!!limitReached} onClick={handleBuildResume} className="self-start">
          Build resume from this bridge
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
