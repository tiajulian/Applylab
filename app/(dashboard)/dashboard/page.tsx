import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { Button } from "@/components/ui/Button";
import { PipelineStrip } from "@/components/dashboard/PipelineStrip";
import { AttentionSection } from "@/components/dashboard/AttentionSection";
import { CareerProfileRailCard } from "@/components/dashboard/CareerProfileRailCard";
import { FREE_RESUME_LIMIT, FREE_TIER_FEATURE_LIMITS, type FreeTierLimitedFeature } from "@/lib/requireUser";
import { getProfileCompleteness } from "@/lib/profile/completeness";
import { computePipelineCountsFromData } from "@/lib/dashboard/pipeline";
import { evaluateAttentionItems, getAttentionClosesAtBounds } from "@/lib/dashboard/attention";
import { formatEnAuDate } from "@/lib/dateUtils";
import type { Resume, UserProfile, Application } from "@/types";

export const dynamic = "force-dynamic";

const FEATURE_USAGE_LABELS: Record<FreeTierLimitedFeature, string> = {
  "cover-letter": "Cover letters",
  "followup-draft": "Follow-up drafts",
  "extract-skills": "Skill extraction",
  "resume-review": "Resume reviews",
  "win-polish": "AI win polish",
  "win-starters": "Win starters",
  "role-duties-suggest": "Duty suggestions",
  "role-duties-bulletify": "Achievement upgrades",
  "project-enhance": "Project enhancements",
  "skills-bridge": "Skills bridges",
  copilot: "Co-pilot answers",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();

  const plan = user.appUser?.plan ?? "free";
  const resumesUsed = user.appUser?.resumes_used ?? 0;
  const isFreePlan = plan === "free";

  // Kept short and deliberately narrow (spec §10/§15: show usage without it feeling like a
  // surprise, but never turn the dashboard into a wall of a dozen progress bars) - just the
  // features that share the same "roughly one per application" mental model as resumes, all
  // capped at a low, easy-to-approach number. The higher-limit features (win-polish, role-duty
  // suggestions, co-pilot, etc.) rely on their own in-context limit-reached UI instead (see
  // LimitReachedModal/LimitReachedInline) rather than adding more rows here.
  const DASHBOARD_USAGE_FEATURES = ["cover-letter", "resume-review", "skills-bridge"] as const;

  const { minDate: closesAtMinDate, maxDate: closesAtMaxDate } = getAttentionClosesAtBounds();

  // Single shared fetch of resumes/applications/interviews, reused below for the resume list,
  // the pipeline counts, the attention items, and the first-run check - previously each of
  // those queried applications independently (and resumes/interviews twice each), plus a
  // separate first-run count query before this batch even started.
  const [
    { data: resumes },
    { data: applications },
    { data: interviews },
    { data: profile },
    { data: followups },
    { data: parsedJobAds },
    { data: featureUsageRows },
  ] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, job_title, company_name, created_at, ats_score")
      .eq("user_id", user.authUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("applications")
      .select("id, resume_id, status, company_name, job_title, applied_date")
      .eq("user_id", user.authUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("application_interviews")
      .select("id, application_id, stage_type, scheduled_at, outcome, applications!inner(user_id)")
      .eq("applications.user_id", user.authUserId)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.authUserId)
      .maybeSingle(),
    supabase
      .from("application_followups")
      .select("id, application_id, created_at, copied_at")
      .eq("user_id", user.authUserId),
    // NOTE: parsed_job_ads is a global shared cache - this surfaces closing dates for jobs
    // any user parsed, not just the current user's pipeline (see lib/dashboard/attention.ts).
    supabase
      .from("parsed_job_ads")
      .select("title, company, closes_at, closes_at_state")
      .not("closes_at", "is", null)
      .gte("closes_at", closesAtMinDate)
      .lte("closes_at", closesAtMaxDate),
    isFreePlan
      ? supabase
          .from("free_tier_feature_usage")
          .select("feature, count")
          .eq("user_id", user.authUserId)
          .in("feature", DASHBOARD_USAGE_FEATURES)
      : Promise.resolve({ data: null }),
  ]);

  if (resumesUsed === 0 && (applications ?? []).length === 0) {
    redirect("/resume/new?firstrun=1");
  }

  const pipelineCounts = computePipelineCountsFromData(
    resumes ?? [],
    applications ?? [],
    interviews ?? []
  );
  const attentionItems = evaluateAttentionItems(
    applications ?? [],
    interviews ?? [],
    followups ?? [],
    (parsedJobAds ?? []).map((ad) => ({
      job_title: ad.title,
      company_name: ad.company,
      closes_at: ad.closes_at,
    }))
  );

  const featureUsage = new Map<string, number>(
    (featureUsageRows ?? []).map((row) => [row.feature, row.count])
  );
  const dashboardUsageRows = DASHBOARD_USAGE_FEATURES.map((feature) => ({
    feature,
    label: FEATURE_USAGE_LABELS[feature],
    used: featureUsage.get(feature) ?? 0,
    limit: FREE_TIER_FEATURE_LIMITS[feature],
  }));

  const fullName = user.appUser?.full_name?.trim() || "";
  const firstName = fullName ? fullName.split(/\s+/)[0] : "there";

  const profileData = profile as UserProfile | null;
  const completenessResult = getProfileCompleteness({
    fullName,
    work_rights: profileData?.work_rights ?? null,
    phone: profileData?.phone ?? null,
    location: profileData?.location ?? null,
    linkedin_url: profileData?.linkedin_url ?? null,
    raw_linkedin_paste: profileData?.raw_linkedin_paste ?? null,
    skills: profileData?.skills ?? [],
    work_experience: profileData?.work_experience ?? [],
    education: profileData?.education ?? [],
    referees: profileData?.referees ?? [],
  });

  const resumeList = (resumes || []) as Pick<
    Resume,
    "id" | "job_title" | "company_name" | "created_at" | "ats_score"
  >[];
  const applicationList = (applications || []) as Pick<Application, "id" | "resume_id">[];

  // ==========================================
  // Populated Dashboard
  // ==========================================
  const linkedResumeIds = new Set(
    applicationList.map((a) => a.resume_id).filter((id): id is string => Boolean(id))
  );

  const statusLede =
    attentionItems.length > 0
      ? `${attentionItems.length} thing${attentionItems.length === 1 ? "" : "s"} need${
          attentionItems.length === 1 ? "s" : ""
        } you this week.`
      : pipelineCounts.total > 0
      ? "Your job search is active."
      : "Your job search command centre at a glance.";

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-3xl sm:text-[36px] sm:leading-[1.05] font-semibold text-ink">
            {firstName ? `Welcome back, ${firstName}` : "Overview"}
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-muted">{statusLede}</p>
        </div>

        <div className="ml-auto flex flex-col items-end">
          <Button href="/resume/new" size="md" className="font-semibold shadow-sm rounded-pill">
            Start a new application
          </Button>
          <span className="mt-1.5 text-[12.5px] text-ink-muted">
            Paste a job ad and we&apos;ll tailor from your profile
          </span>
        </div>
      </div>

      {/* Two Column Shell */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_356px] gap-7 items-start">
        {/* Left Column: 3 Content Sections */}
        <div className="flex flex-col gap-[26px] min-w-0">
          {/* Section 1: Pipeline Strip */}
          <PipelineStrip counts={pipelineCounts} />

          {/* Section 2: Needs you this week */}
          <AttentionSection items={attentionItems} />

          {/* Section 3: Recent Documents (List Format) */}
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[19px] font-semibold text-ink">
                Recent documents
              </h2>
              <Link
                href="/documents"
                className="text-xs font-semibold text-accent hover:underline"
              >
                View all &rarr;
              </Link>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm divide-y divide-border">
              {resumeList.slice(0, 3).map((resume) => {
                const isApplied = linkedResumeIds.has(resume.id);
                const roleTitle = resume.job_title || "Tailored Resume";
                const company = resume.company_name || "";
                const dateStr = formatEnAuDate(resume.created_at, { shortMonth: true });
                const atsScore = resume.ats_score;

                return (
                  <div
                    key={resume.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-paper/40"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* 36px ATS Score Chip */}
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded font-display text-xs font-bold ${
                          atsScore != null
                            ? "border border-success/30 bg-success-soft text-success"
                            : "border border-border bg-paper-deep text-ink-muted"
                        }`}
                      >
                        {atsScore != null ? atsScore : "-"}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-[14.5px] font-semibold text-ink truncate">
                          {roleTitle}
                        </span>
                        <span className="text-[12.5px] text-ink-muted truncate mt-0.5">
                          {company ? `${company} \u2022 ` : ""}v1 \u2022 {dateStr}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${
                          isApplied
                            ? "bg-success-soft text-success"
                            : "bg-paper-deep text-ink-muted"
                        }`}
                      >
                        {isApplied ? "Applied" : "Draft"}
                      </span>

                      <Link
                        href={`/resume/${resume.id}`}
                        className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-border-strong hover:bg-paper-deep transition-colors"
                      >
                        Edit &rarr;
                      </Link>
                    </div>
                  </div>
                );
              })}

              {resumeList.length === 0 && (
                <div className="p-8 text-center text-xs text-ink-muted">
                  No resumes created yet. Click &ldquo;Start a new application&rdquo; above.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Rail: Sticky Top */}
        <aside className="lg:sticky lg:top-[88px] flex flex-col gap-3.5">
          {/* Career Profile Card */}
          <CareerProfileRailCard completeness={completenessResult} />

          {/* Extension Card */}
          <div className="flex flex-col gap-2.5 rounded-lg border border-success/40 bg-success-soft p-5 shadow-sm">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-success">
              CHROME EXTENSION
            </span>
            <p className="text-[13px] text-ink-secondary leading-relaxed">
              1-click import from SEEK, LinkedIn &amp; employer portals directly into your pipeline.
            </p>
            <Link
              href="/extension"
              className="inline-flex items-center gap-1 text-xs font-bold text-success hover:underline mt-0.5"
            >
              Manage extension &rarr;
            </Link>
          </div>

          {/* Plan Card (Free Tier only) - spec §10/§15: show usage as it's consumed so the free
             limit never feels like a surprise, in plain feature terms, never raw "credits". */}
          {isFreePlan && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-sm">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                YOUR FREE AI
              </span>

              {[
                { label: "Resumes", used: resumesUsed, limit: FREE_RESUME_LIMIT },
                ...dashboardUsageRows,
              ].map((row) => (
                <div key={row.label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink">
                    <span>{row.label}</span>
                    <span>
                      {row.used} of {row.limit}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-fast"
                      style={{
                        width: `${Math.min(100, (row.used / row.limit) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}

              <p className="mt-1 text-[12.5px] text-ink-secondary leading-relaxed">
                Upgrade to Pro for unlimited resumes, cover letters, reviews, and AI spoken interview rehearsal.
              </p>
              <Button href="/upgrade" variant="outline" size="sm" className="w-full justify-center mt-1 rounded-pill">
                See Pro - $19/month &rarr;
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
