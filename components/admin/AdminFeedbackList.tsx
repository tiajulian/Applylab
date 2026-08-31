"use client";

import { useEffect, useState } from "react";
import type { FeedbackStatus, FeedbackType, Plan } from "@/types";

interface FeedbackRow {
  id: string;
  user_id: string;
  type: FeedbackType;
  message: string;
  page_url: string | null;
  status: FeedbackStatus;
  created_at: string;
  users: { email: string; full_name: string | null; plan: Plan } | null;
}

const STATUS_OPTIONS: FeedbackStatus[] = ["new", "reviewing", "planned", "done", "declined"];
const TYPE_FILTERS: Array<{ value: FeedbackType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "bug", label: "Bugs" },
  { value: "feature", label: "Features" },
  { value: "complaint", label: "Complaints" },
  { value: "other", label: "Other" },
];

const TYPE_BADGE_STYLES: Record<FeedbackType, string> = {
  bug: "border-critical/30 bg-critical-soft text-critical",
  feature: "border-accent/30 bg-accent-soft text-accent",
  complaint: "border-border-strong bg-paper-deep text-ink-secondary",
  other: "border-border bg-paper text-ink-secondary",
};

const STATUS_BADGE_STYLES: Record<FeedbackStatus, string> = {
  new: "border-accent/30 bg-accent-soft text-accent",
  reviewing: "border-border-strong bg-paper-deep text-ink-secondary",
  planned: "border-border-strong bg-paper-deep text-ink-secondary",
  done: "border-success/30 bg-success-soft text-success",
  declined: "border-border bg-paper text-ink-muted",
};

export function AdminFeedbackList() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    void loadFeedback();
  }, []);

  async function loadFeedback() {
    setIsLoading(true);
    setError(null);
    const response = await fetch("/api/admin/feedback");
    const data = await response.json().catch(() => ({}));
    setIsLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Failed to load feedback");
      return;
    }
    setFeedback(data.feedback ?? []);
  }

  async function handleStatusChange(id: string, status: FeedbackStatus) {
    setUpdatingId(id);
    const response = await fetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json().catch(() => ({}));
    setUpdatingId(null);
    if (!response.ok) {
      setError(data.error ?? "Failed to update status");
      return;
    }
    setFeedback((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  const visibleFeedback = feedback.filter((item) => typeFilter === "all" || item.type === typeFilter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setTypeFilter(filter.value)}
            className={`rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors duration-fast ${
              typeFilter === filter.value
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-ink-secondary hover:bg-paper-deep"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-paper-deep/50 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
            Submissions ({visibleFeedback.length})
          </span>
          {isLoading && <span className="text-xs text-ink-muted">Loading…</span>}
        </div>

        <div className="max-h-[720px] divide-y divide-border overflow-y-auto">
          {!isLoading && visibleFeedback.length === 0 && (
            <div className="p-8 text-center text-sm text-ink-muted">No feedback yet.</div>
          )}

          {visibleFeedback.map((item) => (
            <div key={item.id} className="flex flex-col gap-2.5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold capitalize ${TYPE_BADGE_STYLES[item.type]}`}
                  >
                    {item.type}
                  </span>
                  <span className="text-xs text-ink-secondary">
                    {item.users?.full_name || item.users?.email || "Unknown user"}
                  </span>
                  {item.users?.plan && item.users.plan !== "free" && (
                    <span className="rounded border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent uppercase">
                      {item.users.plan}
                    </span>
                  )}
                  <span className="text-xs text-ink-muted">
                    {new Date(item.created_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <select
                  value={item.status}
                  disabled={updatingId === item.id}
                  onChange={(event) => void handleStatusChange(item.id, event.target.value as FeedbackStatus)}
                  className={`rounded border px-2 py-1 text-[11px] font-semibold capitalize ${STATUS_BADGE_STYLES[item.status]}`}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <p className="whitespace-pre-wrap text-sm text-ink">{item.message}</p>

              {item.page_url && <p className="text-xs text-ink-muted">From: {item.page_url}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
