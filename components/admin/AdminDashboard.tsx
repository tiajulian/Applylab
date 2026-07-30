"use client";

import { useEffect, useState } from "react";
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

export function AdminDashboard() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isComping, setIsComping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers(q: string) {
    setIsLoadingUsers(true);
    setError(null);
    const response = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const data = await response.json().catch(() => ({}));
    setIsLoadingUsers(false);
    if (!response.ok) {
      setError(data.error ?? "Failed to load users");
      return;
    }
    setUsers(data.users ?? []);
  }

  useEffect(() => {
    void loadUsers("");
  }, []);

  async function loadDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setIsLoadingDetail(true);
    setError(null);
    const response = await fetch(`/api/admin/users/${id}`);
    const data = await response.json().catch(() => ({}));
    setIsLoadingDetail(false);
    if (!response.ok) {
      setError(data.error ?? "Failed to load user detail");
      return;
    }
    setDetail(data);
  }

  async function handleComp(plan: Plan) {
    if (!selectedId) return;
    setIsComping(true);
    setError(null);
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
    setUsers((prev) => prev.map((u) => (u.id === selectedId ? { ...u, plan } : u)));
    setDetail((prev) => (prev ? { ...prev, user: { ...prev.user, plan } } : prev));
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadUsers(query);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Search by email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <Button type="submit" size="sm" isLoading={isLoadingUsers}>
            Search
          </Button>
        </form>

        <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => void loadDetail(u.id)}
              className={`flex flex-col gap-0.5 px-4 py-3 text-left text-sm hover:bg-gray-50 ${
                selectedId === u.id ? "bg-brand-50" : ""
              }`}
            >
              <span className="font-medium text-gray-900">{u.email}</span>
              <span className="text-xs text-gray-500">
                {u.plan} · {u.resumes_used} resumes{u.is_admin ? " · admin" : ""}
              </span>
            </button>
          ))}
          {!isLoadingUsers && users.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No users found.</p>
          )}
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-gray-200 bg-white p-5">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {!selectedId && <p className="text-sm text-gray-400">Select a user to view details.</p>}
        {selectedId && isLoadingDetail && <p className="text-sm text-gray-400">Loading…</p>}
        {detail && !isLoadingDetail && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{detail.user.email}</h2>
              <p className="text-xs text-gray-500">{detail.user.full_name || "No name set"}</p>
              <p className="mt-1 text-xs text-gray-500">
                Joined {new Date(detail.user.created_at).toLocaleDateString("en-AU")} · Plan:{" "}
                <span className="font-medium">{detail.user.plan}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PLAN_OPTIONS.map((plan) => (
                <Button
                  key={plan}
                  type="button"
                  variant={detail.user.plan === plan ? "primary" : "outline"}
                  size="sm"
                  disabled={detail.user.plan === plan || isComping}
                  isLoading={isComping}
                  onClick={() => void handleComp(plan)}
                >
                  Set {plan}
                </Button>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Usage</p>
              <p className="mt-1 text-sm text-gray-700">
                {detail.resumes.length} resumes · $
                {detail.usage.totalCostUsd.toFixed(4)} estimated Claude cost
                {detail.usage.truncated && " (last 500 calls)"}
              </p>
            </div>

            {Object.keys(detail.usage.costByFeature).length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cost by feature</p>
                {Object.entries(detail.usage.costByFeature).map(([feature, stats]) => (
                  <div key={feature} className="flex items-center justify-between text-sm text-gray-700">
                    <span>{feature}</span>
                    <span className="text-gray-500">
                      {stats.calls} calls · ${stats.costUsd.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
