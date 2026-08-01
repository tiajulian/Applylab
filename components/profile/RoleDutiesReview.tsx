"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { RoleDutyItem, RoleDutySuggestion } from "@/types";

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
  userState: "confirmed" | "rejected"
): Promise<RoleDutyItem | null> {
  const response = await fetch(`/api/role-duties/${suggestionId}/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_state: userState }),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  return data?.item ?? null;
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
  const [isSaving, setIsSaving] = useState(false);

  async function respond(userState: "confirmed" | "rejected") {
    setIsSaving(true);
    const updated = await patchItem(suggestionId, item.id, userState);
    setIsSaving(false);
    if (updated) onUpdate(updated);
  }

  if (item.user_state !== "pending") {
    const confirmed = item.user_state === "confirmed";
    return (
      <div className={`rounded-xl p-3 text-sm ${confirmed ? "bg-green-50 text-green-900" : "bg-gray-50 text-gray-400 line-through"}`}>
        {item.duty_text}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-amber-50 p-3">
      <p className="text-sm text-amber-900">{item.duty_text}</p>
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
      <div className="flex items-start justify-between gap-3 rounded-lg bg-blue-50 p-3">
        <div>
          <p className="text-sm text-blue-900">
            This role looks thin. See typical duties for &ldquo;{jobTitle || "this role"}&rdquo; and tick the ones
            you actually did.
          </p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" disabled={!jobTitle.trim()} onClick={handleSuggest}>
            Suggest duties
          </Button>
          <button
            type="button"
            className="text-xs text-blue-400 hover:text-blue-700"
            onClick={() => setStatus("dismissed")}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="rounded-lg bg-blue-50 p-3">
        <p className="text-sm text-blue-900">Looking up typical duties for &ldquo;{jobTitle}&rdquo;…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Tasks people in this role usually do
      </p>
      <p className="text-xs text-gray-400">
        These are general to the job title, not claims about you. Only what you tick gets used.
      </p>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <DutyCard key={item.id} item={item} suggestionId={suggestion!.id} onUpdate={updateItem} />
        ))}
        {items.length === 0 && <p className="text-sm text-gray-500">No suggestions found for this title.</p>}
      </div>
    </div>
  );
}
