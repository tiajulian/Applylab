"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { Plan } from "@/types";

interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  plan: Plan;
  resumes_used: number;
  is_admin: boolean;
  created_at: string;
}

interface AdminUserDetail {
  user: AdminUserRow & { stripe_customer_id: string | null };
  resumes: Array<{
    id: string;
    job_title: string | null;
    company_name: string | null;
    assist_calls_used: number;
    content_score_count: number;
    created_at: string;
  }>;
  usage: {
    totalCostUsd: number;
    costByFeature: Record<string, { calls: number; costUsd: number }>;
    truncated: boolean;
  };
}

const PLAN_OPTIONS: Plan[] = ["free", "pro", "lifetime"];

function getInitials(name?: string | null, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}

function PlanBadge({ plan, isAdmin }: { plan: Plan; isAdmin?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {plan === "pro" && (
        <span className="rounded border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
          Pro
        </span>
      )}
      {plan === "lifetime" && (
        <span className="rounded bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">
          Lifetime
        </span>
      )}
      {plan === "free" && (
        <span className="rounded border border-border bg-paper-deep px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
          Free
        </span>
      )}
      {isAdmin && (
        <span className="rounded bg-paper-deep px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted border border-border">
          Admin
        </span>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isComping, setIsComping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setIsLoadingDetail(true);
    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`/api/admin/users/${id}`);
    const data = await response.json().catch(() => ({}));
    setIsLoadingDetail(false);
    if (!response.ok) {
      setError(data.error ?? "Failed to load user detail");
      return;
    }
    setDetail(data);
  }, []);

  const loadUsers = useCallback(async (q: string, autoSelectFirst = false) => {
    setIsLoadingUsers(true);
    setError(null);
    const response = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const data = await response.json().catch(() => ({}));
    setIsLoadingUsers(false);
    if (!response.ok) {
      setError(data.error ?? "Failed to load users");
      return;
    }
    const userList = data.users ?? [];
    setUsers(userList);
    if (userList.length > 0 && autoSelectFirst) {
      void loadDetail(userList[0].id);
    }
  }, [loadDetail]);

  useEffect(() => {
    void loadUsers(initialQuery, true);
  }, [loadUsers, initialQuery]);

  async function handleComp(plan: Plan) {
    if (!selectedId) return;
    setIsComping(true);
    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`/api/admin/users/${selectedId}/comp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await response.json().catch(() => ({}));
    setIsComping(false);
    if (!response.ok) {
      setError(data.error ?? "Failed to update plan");
      return;
    }
    setSuccessMessage(`Account plan successfully updated to ${plan.toUpperCase()}`);
    setUsers((prev) => prev.map((u) => (u.id === selectedId ? { ...u, plan } : u)));
    setDetail((prev) => (prev ? { ...prev, user: { ...prev.user, plan } } : prev));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left Column: Search & User Directory */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadUsers(query);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by email or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-border bg-surface px-3 py-2 pl-9 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <Button type="submit" size="sm" isLoading={isLoadingUsers}>
            Search
          </Button>
        </form>

        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-paper-deep/50 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Users ({users.length})
            </span>
            {isLoadingUsers && (
              <span className="text-xs text-ink-muted">Refreshing…</span>
            )}
          </div>

          <div className="max-h-[560px] divide-y divide-border overflow-y-auto">
            {users.map((u) => {
              const isSelected = selectedId === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => void loadDetail(u.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-fast ease-editorial ${
                    isSelected
                      ? "bg-accent/10 border-l-4 border-l-accent"
                      : "hover:bg-paper-deep"
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-deep text-xs font-bold text-ink">
                    {getInitials(u.full_name, u.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">
                        {u.full_name || u.email}
                      </p>
                      <PlanBadge plan={u.plan} isAdmin={u.is_admin} />
                    </div>
                    <p className="truncate text-xs text-ink-secondary">{u.email}</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {u.resumes_used} resumes generated
                    </p>
                  </div>
                </button>
              );
            })}

            {!isLoadingUsers && users.length === 0 && (
              <div className="p-8 text-center text-sm text-ink-muted">
                No users found matching &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: User Details & Actions */}
      <div className="lg:col-span-7">
        <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
          {error && (
            <div className="rounded border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="rounded border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
              {successMessage}
            </div>
          )}

          {!selectedId && (
            <div className="py-16 text-center text-sm text-ink-muted">
              Select a user from the directory to inspect account details and token usage.
            </div>
          )}

          {selectedId && isLoadingDetail && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-sm text-ink-secondary">
              <svg className="h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Loading user analytics…</span>
            </div>
          )}

          {detail && !isLoadingDetail && (
            <div className="flex flex-col gap-6">
              {/* User Overview Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold text-on-accent shadow-sm">
                    {getInitials(detail.user.full_name, detail.user.email)}
                  </div>
                  <div>
                    <h2 className="font-display text-h3 text-ink">
                      {detail.user.full_name || detail.user.email}
                    </h2>
                    <p className="text-xs text-ink-secondary">{detail.user.email}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Joined {new Date(detail.user.created_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {detail.user.stripe_customer_id && ` · Stripe ID: ${detail.user.stripe_customer_id}`}
                    </p>
                  </div>
                </div>

                <PlanBadge plan={detail.user.plan} isAdmin={detail.user.is_admin} />
              </div>

              {/* Plan Management Controls */}
              <div className="rounded-lg border border-border bg-paper-deep/40 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                  Plan & Subscription Management
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  Override or comp this account directly:
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {PLAN_OPTIONS.map((plan) => (
                    <Button
                      key={plan}
                      type="button"
                      variant={detail.user.plan === plan ? "primary" : "secondary"}
                      size="sm"
                      disabled={detail.user.plan === plan || isComping}
                      isLoading={isComping}
                      onClick={() => void handleComp(plan)}
                    >
                      {detail.user.plan === plan ? `✓ Current: ${plan.toUpperCase()}` : `Set ${plan.toUpperCase()}`}
                    </Button>
                  ))}
                </div>
              </div>

              {/* API Token & Cost Usage */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                    LLM Cost & Feature Breakdown
                  </h3>
                  <span className="text-xs font-medium text-ink">
                    ${(detail.usage.totalCostUsd * 1.54).toFixed(4)} AUD estimated
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-paper p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-ink-secondary">
                    <span>Total Resumes: <strong className="text-ink">{detail.resumes.length}</strong></span>
                    <span>Generations Used: <strong className="text-ink">{detail.user.resumes_used}</strong></span>
                  </div>

                  {Object.keys(detail.usage.costByFeature).length > 0 ? (
                    <div className="space-y-2 border-t border-border pt-3">
                      {Object.entries(detail.usage.costByFeature).map(([feature, stats]) => {
                        const pct = detail.usage.totalCostUsd > 0
                          ? Math.min(100, Math.round((stats.costUsd / detail.usage.totalCostUsd) * 100))
                          : 0;
                        return (
                          <div key={feature} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-ink capitalize">
                                {feature.replace(/_/g, " ")}
                              </span>
                              <span className="text-ink-secondary tabular-nums">
                                {stats.calls} calls · ${(stats.costUsd * 1.54).toFixed(4)} AUD ({pct}%)
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
                              <div
                                className="h-full bg-accent transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted">No LLM API calls recorded for this user yet.</p>
                  )}
                </div>
              </div>

              {/* User Resumes List */}
              {detail.resumes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                    Tailored Resumes ({detail.resumes.length})
                  </h3>
                  <div className="divide-y divide-border rounded-lg border border-border bg-paper text-xs">
                    {detail.resumes.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-3">
                        <div>
                          <p className="font-semibold text-ink">
                            {r.job_title || "Untitled Resume"}
                          </p>
                          <p className="text-ink-secondary">{r.company_name || "Unknown Company"}</p>
                        </div>
                        <div className="text-right text-ink-muted">
                          <p>{new Date(r.created_at).toLocaleDateString("en-AU")}</p>
                          <p>{r.assist_calls_used} assist calls</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
