"use client";

import { useEffect, useRef, useState } from "react";
import type { RoleDutyItem, RoleDutySuggestion } from "@/types";

export type RoleDutiesStatus = "hidden" | "idle" | "loading" | "ready" | "error" | "dismissed";

async function fetchSuggestions(
  jobTitle: string,
  company: string,
  location: string,
  regenerate: boolean
): Promise<{ suggestion: RoleDutySuggestion; items: RoleDutyItem[] } | { error: string }> {
  const response = await fetch("/api/role-duties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobTitle, company, location, regenerate }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { error: data.error ?? "Something went wrong. Please try again." };
  return { suggestion: data.suggestion, items: data.items ?? [] };
}

export async function patchDutyItem(
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
 * Shared duty-suggestion state, extracted from RoleDutiesReview.tsx so the same items array backs
 * both the unified "what you did here" list (confirmed duties only, see RoleContentList.tsx) and
 * the collapsed "Ideas from this role" disclosure (pending/rejected duties, see
 * RoleDutiesReview.tsx) without either one drifting out of sync with the other. Ownership rule
 * carried over unchanged from the pre-redesign component: on mount, does a zero-cost lookup for
 * duties already saved against this job title (so a returning candidate never has to re-click
 * "Suggest duties"), and only offers the suggest flow when the role looks thin.
 */
export function useRoleDuties({
  jobTitle,
  isThin,
}: {
  jobTitle: string;
  isThin: boolean;
}) {
  // "hidden" covers both "nothing to check yet" (no job title) and "checked, nothing found, and
  // the role isn't thin" - both render nothing, so there's no reason to track them separately.
  const [status, setStatus] = useState<RoleDutiesStatus>("hidden");
  const [suggestion, setSuggestion] = useState<RoleDutySuggestion | null>(null);
  const [items, setItems] = useState<RoleDutyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const checkedRef = useRef(false);

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

  /** `regenerate` asks for an additional batch beyond whatever's already attached to this job
   * title's suggestion (see "Get more suggestions" in SuggestTasksBuilder.tsx) instead of just
   * reusing/returning the existing one. */
  async function handleSuggest(company: string, location: string, regenerate = false) {
    setStatus("loading");
    setError(null);
    const result = await fetchSuggestions(jobTitle, company, location, regenerate);
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

  async function respond(itemId: string, userState: "confirmed" | "rejected") {
    if (!suggestion) return null;
    const updated = await patchDutyItem(suggestion.id, itemId, { user_state: userState });
    if (updated) updateItem(updated);
    return updated;
  }

  function dismiss() {
    setStatus("dismissed");
  }

  return { status, suggestion, items, error, handleSuggest, updateItem, respond, dismiss };
}

export type UseRoleDutiesResult = ReturnType<typeof useRoleDuties>;
