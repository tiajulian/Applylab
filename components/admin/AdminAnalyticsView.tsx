"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AdminAnalyticsData } from "@/app/api/admin/analytics/route";
import { SparklesIcon, ClockIcon, CheckIcon } from "@/components/ui/icons/LucideIcons";

export function AdminAnalyticsView() {
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/analytics");
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load analytics");
      }
      const json = (await response.json()) as AdminAnalyticsData;
      setData(json);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applylab-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxSignupDaily = useMemo(() => {
    if (!data?.signupTrends) return 1;
    return Math.max(...data.signupTrends.map((t) => t.count), 1);
  }, [data]);

  const maxDailyCost = useMemo(() => {
    if (!data?.aiCostTrends) return 0.1;
    return Math.max(...data.aiCostTrends.map((t) => t.costUsd), 0.05);
  }, [data]);

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-border bg-surface p-5 animate-pulse skeleton-shimmer"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-critical/30 bg-critical-soft p-6 text-center space-y-3">
        <p className="text-sm font-semibold text-critical">{error || "Could not load analytics."}</p>
        <Button size="sm" onClick={fetchAnalytics} className="font-semibold text-xs">
          Try Again
        </Button>
      </div>
    );
  }

  const { overview, signupTrends, aiCostTrends, aiFeatureBreakdown, aiProviderBreakdown, activationFunnel, applicationPipeline, topAiUsers } = data;

  return (
    <div className="space-y-8">
      {/* Controls & Timestamp Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 text-xs shadow-sm">
        <div className="flex items-center gap-2 text-ink-secondary">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span>
            Live System Analytics &middot; Last updated {lastRefreshed.toLocaleTimeString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="text-xs font-semibold py-1 px-3"
          >
            {isLoading ? "Refreshing..." : "🔄 Refresh Data"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            className="text-xs font-semibold py-1 px-3"
          >
            📥 Export JSON
          </Button>
        </div>
      </div>

      {/* 1. Top KPI Summary Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Total Users & Growth */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Total Signups
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">
              +{overview.usersLast7Days} this week
            </span>
          </div>
          <div>
            <div className="font-display text-3xl sm:text-4xl text-ink font-bold">
              {overview.totalUsers.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              +{overview.usersLast30Days} new users in the last 30 days
            </p>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-ink-muted">
            <span>Free: <strong className="text-ink">{overview.planBreakdown.free}</strong></span>
            <span>Pro: <strong className="text-accent">{overview.planBreakdown.pro}</strong></span>
            <span>Lifetime: <strong className="text-ink">{overview.planBreakdown.lifetime}</strong></span>
          </div>
        </div>

        {/* Card 2: Estimated MRR & Revenue */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Estimated Run-Rate (MRR)
            </span>
            <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
              AUD ($19/mo)
            </span>
          </div>
          <div>
            <div className="font-display text-3xl sm:text-4xl text-ink font-bold">
              ${overview.estimatedMrrAud.toLocaleString()} <span className="text-lg font-normal text-ink-muted">AUD/mo</span>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              From {overview.planBreakdown.pro} active recurring Pro subscribers
            </p>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-ink-muted">
            <span>Paid Users: <strong className="text-ink">{overview.paidUsers}</strong></span>
            <span>Paid Ratio: <strong className="text-accent">{overview.paidConversionRate.toFixed(1)}%</strong></span>
          </div>
        </div>

        {/* Card 3: AI Spend & Cost Efficiency */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Total AI Spend
            </span>
            <span className="inline-flex items-center rounded-full bg-paper-deep px-2 py-0.5 text-[11px] font-bold text-ink">
              USD Token Cost
            </span>
          </div>
          <div>
            <div className="font-display text-3xl sm:text-4xl text-ink font-bold">
              ${overview.totalAiCostUsd.toFixed(2)} <span className="text-lg font-normal text-ink-muted">USD</span>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              ${overview.aiCostLast30DaysUsd.toFixed(2)} in the last 30 days
            </p>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-ink-muted">
            <span>Avg / User: <strong className="text-ink">${overview.avgAiCostPerUserUsd.toFixed(3)}</strong></span>
            <span>Unit Margin: <strong className="text-success">&gt;95%</strong></span>
          </div>
        </div>

        {/* Card 4: Resumes Generated */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Resumes Tailored
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
              <SparklesIcon className="h-3 w-3" />
              Core Product
            </span>
          </div>
          <div>
            <div className="font-display text-3xl sm:text-4xl text-ink font-bold">
              {overview.totalResumes.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              +{overview.resumesLast30Days} tailored in the last 30 days
            </p>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-ink-muted">
            <span>Avg ATS Score: <strong className="text-ink">{overview.avgAtsScore ?? "N/A"}%</strong></span>
            <span>Cover Letters: <strong className="text-ink">{overview.resumesWithCoverLetter}</strong></span>
          </div>
        </div>

        {/* Card 5: Applications Tracked */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Job Applications Tracked
            </span>
            <span className="inline-flex items-center rounded-full bg-paper-deep px-2 py-0.5 text-[11px] font-bold text-ink">
              Pipeline
            </span>
          </div>
          <div>
            <div className="font-display text-3xl sm:text-4xl text-ink font-bold">
              {overview.totalApplications.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              {applicationPipeline.interviewing} currently in interviewing stage
            </p>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-ink-muted">
            <span>Interviews: <strong className="text-ink">{applicationPipeline.interviewing}</strong></span>
            <span>Offers: <strong className="text-success">{applicationPipeline.offered}</strong></span>
          </div>
        </div>

        {/* Card 6: AI Mock Interview Sessions */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              AI Mock Interviews
            </span>
            <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
              Pro Feature
            </span>
          </div>
          <div>
            <div className="font-display text-3xl sm:text-4xl text-ink font-bold">
              {overview.totalInterviews.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              {overview.totalInterviewTurns} practice turns completed
            </p>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-ink-muted">
            <span>Avg Readiness: <strong className="text-ink">{overview.avgInterviewScore ?? "N/A"}/100</strong></span>
            <span>Skills Bridges: <strong className="text-ink">{overview.totalSkillsBridges}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Visual Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chart A: 30-Day Daily User Signups */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg text-ink font-bold">User Signups (Last 30 Days)</h3>
              <p className="text-xs text-ink-secondary">Daily registration trajectory</p>
            </div>
            <span className="text-xs font-bold text-accent rounded-md bg-accent-soft px-2.5 py-1">
              {signupTrends.reduce((sum, t) => sum + t.count, 0)} Total
            </span>
          </div>

          <div className="h-44 flex items-end gap-1.5 pt-6 pb-2 border-b border-border">
            {signupTrends.map((t, idx) => {
              const heightPercent = Math.max(Math.round((t.count / maxSignupDaily) * 100), 6);
              const isWeekend = new Date(t.date).getDay() === 0 || new Date(t.date).getDay() === 6;
              return (
                <div
                  key={t.date}
                  className="group relative flex-1 flex flex-col items-center h-full justify-end"
                >
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute -top-8 hidden group-hover:flex flex-col items-center z-20">
                    <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-paper whitespace-nowrap shadow-pop">
                      {t.date.slice(5)}: {t.count} signup{t.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-sm transition-all duration-fast group-hover:bg-accent ${
                      isWeekend ? "bg-border-strong" : "bg-accent/70"
                    }`}
                  />
                  {idx % 5 === 0 && (
                    <span className="absolute -bottom-5 text-[9px] text-ink-muted">
                      {t.date.slice(5)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-muted text-right pt-2">
            Hover over bars to inspect daily counts
          </p>
        </div>

        {/* Chart B: 30-Day Daily AI Token Cost */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg text-ink font-bold">Daily AI API Cost (USD)</h3>
              <p className="text-xs text-ink-secondary">Anthropic Claude + Gemini + OpenAI spend</p>
            </div>
            <span className="text-xs font-bold text-ink rounded-md bg-paper-deep px-2.5 py-1 border border-border">
              ${aiCostTrends.reduce((sum, t) => sum + t.costUsd, 0).toFixed(2)} 30d Total
            </span>
          </div>

          <div className="h-44 flex items-end gap-1.5 pt-6 pb-2 border-b border-border">
            {aiCostTrends.map((t, idx) => {
              const heightPercent = Math.max(Math.round((t.costUsd / maxDailyCost) * 100), 6);
              return (
                <div
                  key={t.date}
                  className="group relative flex-1 flex flex-col items-center h-full justify-end"
                >
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute -top-8 hidden group-hover:flex flex-col items-center z-20">
                    <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-paper whitespace-nowrap shadow-pop">
                      {t.date.slice(5)}: ${t.costUsd.toFixed(3)} ({t.calls} calls)
                    </span>
                  </div>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full rounded-t-sm bg-ink/70 transition-all duration-fast group-hover:bg-accent"
                  />
                  {idx % 5 === 0 && (
                    <span className="absolute -bottom-5 text-[9px] text-ink-muted">
                      {t.date.slice(5)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-muted text-right pt-2">
            Hover over bars to inspect daily token cost
          </p>
        </div>
      </div>

      {/* 3. Activation Funnel & AI Provider Mix */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel: User Activation Steps */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-display text-lg text-ink font-bold">User Activation Funnel</h3>
            <p className="text-xs text-ink-secondary">Progression from signup to core product usage</p>
          </div>

          <div className="space-y-3 pt-2">
            {[
              {
                label: "1. Registered Accounts",
                count: activationFunnel.registered,
                pct: 100,
                color: "bg-ink",
              },
              {
                label: "2. Completed Onboarding",
                count: activationFunnel.profileCreated,
                pct: activationFunnel.registered > 0 ? (activationFunnel.profileCreated / activationFunnel.registered) * 100 : 0,
                color: "bg-accent",
              },
              {
                label: "3. Profile Completeness ≥ 80%",
                count: activationFunnel.profileComplete80Plus,
                pct: activationFunnel.registered > 0 ? (activationFunnel.profileComplete80Plus / activationFunnel.registered) * 100 : 0,
                color: "bg-accent/80",
              },
              {
                label: "4. Tailored at Least 1 Resume",
                count: activationFunnel.resumesGenerated,
                pct: activationFunnel.registered > 0 ? (activationFunnel.resumesGenerated / activationFunnel.registered) * 100 : 0,
                color: "bg-success",
              },
              {
                label: "5. Tracked Job Applications",
                count: activationFunnel.applicationsTracked,
                pct: activationFunnel.registered > 0 ? (activationFunnel.applicationsTracked / activationFunnel.registered) * 100 : 0,
                color: "bg-attention",
              },
              {
                label: "6. AI Mock Interview Practiced",
                count: activationFunnel.interviewPracticed,
                pct: activationFunnel.registered > 0 ? (activationFunnel.interviewPracticed / activationFunnel.registered) * 100 : 0,
                color: "bg-accent",
              },
            ].map((step, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-ink">{step.label}</span>
                  <span className="text-ink-secondary">
                    {step.count.toLocaleString()} ({step.pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-paper-deep overflow-hidden">
                  <div
                    style={{ width: `${Math.min(Math.max(step.pct, 2), 100)}%` }}
                    className={`h-full rounded-full ${step.color} transition-all duration-slow`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Provider Mix & Unit Economics */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-lg text-ink font-bold">AI Provider &amp; Model Architecture</h3>
            <p className="text-xs text-ink-secondary">Cost distribution across AI vendors</p>

            <div className="space-y-4 pt-4">
              {aiProviderBreakdown.map((p) => {
                const badge =
                  p.provider === "gemini"
                    ? "Google Gemini 3.6 Flash"
                    : p.provider === "openai"
                    ? "OpenAI GPT-4o Mini / Luna"
                    : "Anthropic Claude 3.5 Sonnet / Haiku";
                return (
                  <div key={p.provider} className="rounded-xl border border-border bg-paper p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-ink capitalize">{p.provider}</span>
                        <span className="text-[11px] text-ink-muted ml-2">({badge})</span>
                      </div>
                      <span className="font-bold text-accent">${p.costUsd.toFixed(3)} USD ({p.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-paper-deep overflow-hidden">
                      <div
                        style={{ width: `${Math.max(p.percentage, 2)}%` }}
                        className="h-full rounded-full bg-accent"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-ink-muted">
                      <span>Total API Invocations: {p.calls.toLocaleString()}</span>
                      <span>Avg Cost / Call: ${(p.calls > 0 ? p.costUsd / p.calls : 0).toFixed(4)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-success/30 bg-success-soft p-4 text-xs text-ink leading-relaxed">
            <strong className="text-success block font-bold mb-1">💡 Unit Economics Health:</strong>
            At $19 AUD/month per Pro subscriber and an average AI cost of ~$0.08 USD per active user, ApplyLab maintains an outstanding <strong>&gt;95% gross margin</strong> on subscription revenue.
          </div>
        </div>
      </div>

      {/* 4. AI Feature Cost & Token Breakdown Table */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg text-ink font-bold">AI Spend Breakdown by Feature</h3>
            <p className="text-xs text-ink-secondary">Granular token consumption and cost telemetry</p>
          </div>
          <span className="text-xs text-ink-muted">
            {aiFeatureBreakdown.length} active AI capabilities
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-xs text-ink border-collapse">
            <thead className="border-b border-border bg-paper-deep font-bold text-ink">
              <tr>
                <th className="p-3">Feature Name</th>
                <th className="p-3 text-right">Invocations</th>
                <th className="p-3 text-right">Input Tokens</th>
                <th className="p-3 text-right">Output Tokens</th>
                <th className="p-3 text-right">Total Cost (USD)</th>
                <th className="p-3 text-right">Avg Cost / Call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {aiFeatureBreakdown.map((f) => (
                <tr key={f.feature} className="hover:bg-paper/80 transition-colors">
                  <td className="p-3 font-semibold text-ink">
                    <span className="rounded bg-paper-deep px-2 py-0.5 font-mono text-[11px] text-accent border border-border">
                      {f.feature}
                    </span>
                  </td>
                  <td className="p-3 text-right">{f.calls.toLocaleString()}</td>
                  <td className="p-3 text-right text-ink-secondary">
                    {f.inputTokens >= 1_000_000
                      ? `${(f.inputTokens / 1_000_000).toFixed(2)}M`
                      : `${(f.inputTokens / 1_000).toFixed(1)}k`}
                  </td>
                  <td className="p-3 text-right text-ink-secondary">
                    {f.outputTokens >= 1_000_000
                      ? `${(f.outputTokens / 1_000_000).toFixed(2)}M`
                      : `${(f.outputTokens / 1_000).toFixed(1)}k`}
                  </td>
                  <td className="p-3 text-right font-bold text-ink">
                    ${f.costUsd.toFixed(3)}
                  </td>
                  <td className="p-3 text-right text-ink-muted">
                    ${(f.calls > 0 ? f.costUsd / f.calls : 0).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Top 10 Active AI Users (Power Users & Abuse Monitoring) */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg text-ink font-bold">Top 10 AI Power Users</h3>
            <p className="text-xs text-ink-secondary">Highest-usage accounts across all AI endpoints</p>
          </div>
          <Link
            href="/admin/users"
            className="text-xs font-semibold text-accent hover:underline"
          >
            Manage all users &rarr;
          </Link>
        </div>

        {topAiUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-muted rounded-xl border border-dashed border-border">
            No user AI cost data recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-xs text-ink border-collapse">
              <thead className="border-b border-border bg-paper-deep font-bold text-ink">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3 text-right">Resumes Used</th>
                  <th className="p-3 text-right">Total AI Calls</th>
                  <th className="p-3 text-right">Total Spend (USD)</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {topAiUsers.map((u) => (
                  <tr key={u.userId} className="hover:bg-paper/80 transition-colors">
                    <td className="p-3">
                      <p className="font-bold text-ink">{u.fullName || "User"}</p>
                      <p className="text-[11px] text-ink-muted">{u.email}</p>
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          u.plan === "pro"
                            ? "bg-accent-soft text-accent border border-accent/20"
                            : u.plan === "lifetime"
                            ? "bg-accent text-on-accent"
                            : "bg-paper-deep text-ink-secondary border border-border"
                        }`}
                      >
                        {u.plan}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-ink">{u.resumesUsed}</td>
                    <td className="p-3 text-right text-ink-secondary">{u.totalCalls.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-accent">
                      ${u.totalCostUsd.toFixed(3)}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/admin/users?q=${encodeURIComponent(u.email)}`}
                        className="rounded bg-paper-deep px-2 py-1 text-[11px] font-bold text-ink hover:bg-border transition-colors border border-border inline-block"
                      >
                        View Account
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
