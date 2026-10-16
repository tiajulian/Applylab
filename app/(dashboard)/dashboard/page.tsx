import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { AttentionSection } from "@/components/dashboard/AttentionSection";
import { GettingStarted, type SetupStep } from "@/components/dashboard/GettingStarted";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { FREE_RESUME_LIMIT, FREE_TIER_FEATURE_LIMITS } from "@/lib/requireUser";
import { getProfileCompleteness, meetsMVP, toScorableProfile } from "@/lib/profile/completeness";
import { CTA, FEATURE_LABELS } from "@/lib/marketing/copy";
import { PLANS } from "@/lib/marketing/plans";
import { computePipelineCountsFromData } from "@/lib/dashboard/pipeline";
import { evaluateAttentionItems, getClosingSoonAds } from "@/lib/dashboard/attention";
import { diffCalendarDaysMelbourne, formatEnAuDate } from "@/lib/dateUtils";
import type { Resume, UserProfile, Application } from "@/types";

export const dynamic = "force-dynamic";

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

  // Single shared fetch of resumes/applications/interviews, reused below for the resume list,
  // the pipeline counts, the attention items, and the first-run check - previously each of
  // those queried applications independently (and resumes/interviews twice each), plus a
  // separate first-run count query before this batch even started. parsed_job_ads is fetched
  // via getClosingSoonAds(), a short-TTL unstable_cache wrapper - see its comment in
  // lib/dashboard/attention.ts for why that query (unlike the rest here) is safe to share
  // across every user's request instead of re-querying it per dashboard load.
  const [
    { data: resumes },
    { data: applications },
    { data: interviews },
    { data: profile },
    { data: followups },
    mappedAds,
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
    getClosingSoonAds(),
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
    mappedAds
  );

  const featureUsage = new Map<string, number>(
    (featureUsageRows ?? []).map((row) => [row.feature, row.count])
  );
  const dashboardUsageRows = DASHBOARD_USAGE_FEATURES.map((feature) => ({
    feature,
    label: FEATURE_LABELS[feature].plural,
    used: featureUsage.get(feature) ?? 0,
    limit: FREE_TIER_FEATURE_LIMITS[feature],
  }));

  const fullName = user.appUser?.full_name?.trim() || "";
  const firstName = fullName ? fullName.split(/\s+/)[0] : "";

  const scorableProfile = toScorableProfile(profile as UserProfile | null, fullName);
  const completenessResult = getProfileCompleteness(scorableProfile);
  const resumesLeft = Math.max(0, FREE_RESUME_LIMIT - resumesUsed);

  const resumeList = (resumes || []) as Pick<
    Resume,
    "id" | "job_title" | "company_name" | "created_at" | "ats_score"
  >[];
  const applicationList = (applications || []) as Pick<
    Application,
    "id" | "resume_id" | "status" | "company_name" | "job_title"
  >[];

  const linkedResumeIds = new Set(
    applicationList.map((a) => a.resume_id).filter((id): id is string => Boolean(id))
  );

  const freeResumeUsed = isFreePlan && resumesLeft === 0;
  const tailorHref = freeResumeUsed ? "/upgrade" : "/resume/new";
  const tailorLabel = freeResumeUsed ? `${CTA.goPro} to tailor more` : "Tailor a resume";

  // The steps to a first application, as a checklist that steps aside once they're all done.
  // (Interview practice comes after applying, so it lives in the shortcuts instead.)
  const setupSteps: SetupStep[] = [
    {
      title: "Add your experience",
      hint: "Your jobs, duties and skills, added once. Every resume is written from this.",
      done: meetsMVP(scorableProfile),
      href: "/profile",
      action: "Open profile",
      tag: `${completenessResult.percent}% done`,
    },
    {
      title: "Make a tailored resume",
      hint: "Paste a job ad and get a 1-page resume written for that job.",
      done: resumeList.length > 0,
      href: tailorHref,
      action: tailorLabel,
      doneHref: "/documents",
    },
    {
      title: "Track where you applied",
      hint: "Add each job you send a resume to, so you can follow up.",
      done: applicationList.length > 0,
      href: "/applications?add=1",
      action: "Add a job",
      doneHref: "/applications",
    },
  ];
  const setupComplete = setupSteps.every((step) => step.done);

  // e.g. "Phone screen tomorrow", "Interview on Thursday 23 October", "Interview on 4 Nov".
  const nextInterview = pipelineCounts.nextInterview;
  let nextInterviewLabel: string | null = null;
  if (nextInterview) {
    const kind = nextInterview.stageType === "phone_screen" ? "Phone screen" : "Interview";
    const days = diffCalendarDaysMelbourne(nextInterview.scheduledAt);
    nextInterviewLabel =
      days === 0
        ? `${kind} today`
        : days === 1
        ? `${kind} tomorrow`
        : `${kind} on ${formatEnAuDate(nextInterview.scheduledAt, days > 1 && days <= 6 ? {} : { shortMonth: true })}`;
  }

  const stageRows = [
    { label: "Not sent yet", count: pipelineCounts.drafted, href: "/documents" },
    { label: "Applied", count: pipelineCounts.applied, href: "/applications?stage=applied" },
    { label: "Interviewing", count: pipelineCounts.screening + pipelineCounts.interview, href: "/applications?stage=interviewing" },
    { label: "Offer", count: pipelineCounts.offer, href: "/applications?stage=offer" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5">
      <header>
        <div>
          <h1 className="font-display text-[22px] font-semibold leading-tight text-ink sm:text-[26px]">
            {firstName ? `Hi ${firstName}` : "Welcome"}
          </h1>
          <p className="mt-0.5 text-[14px] text-ink-secondary">
            {setupComplete
              ? "Everything for your job hunt, in one place."
              : "Three steps to your first application. Start with the highlighted one."}
          </p>
        </div>
      </header>

      {setupComplete ? (
        <QuickActions
          isFreePlan={isFreePlan}
          tailor={{ href: tailorHref, hint: freeResumeUsed ? "Free resume used" : "Paste a job ad" }}
        />
      ) : (
        <GettingStarted steps={setupSteps} />
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <AttentionSection items={attentionItems} />

          <section className="flex flex-col gap-2" aria-labelledby="recent-resumes">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="recent-resumes" className="text-[15px] font-semibold text-ink">
                Recent resumes
              </h2>
              {resumeList.length > 0 && (
                <Link href="/documents" className="text-[13px] font-semibold text-accent-hover hover:underline">
                  See all
                </Link>
              )}
            </div>
            {resumeList.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-strong px-4 py-5 text-center text-[13.5px] text-ink-secondary">
                No resumes yet. Your tailored resumes will show up here.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                {resumeList.slice(0, 4).map((resume) => {
                  const isApplied = linkedResumeIds.has(resume.id);
                  return (
                    <li key={resume.id}>
                      <Link
                        href={`/resume/${resume.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-fast hover:bg-paper-deep/50"
                      >
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="truncate text-[14px] font-semibold text-ink">
                            {resume.job_title || "General resume"}
                          </span>
                          <span className="hidden truncate text-[12.5px] text-ink-muted sm:inline">
                            {[resume.company_name, formatEnAuDate(resume.created_at, { shortMonth: true })]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${
                            isApplied ? "bg-success-soft text-success" : "bg-paper-deep text-ink-secondary"
                          }`}
                        >
                          {isApplied ? "Sent" : "Not sent yet"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[93px]">
          <section aria-labelledby="applications-summary" className="rounded-lg border border-border bg-surface shadow-sm">
            <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3">
              <h2 id="applications-summary" className="text-[15px] font-semibold text-ink">
                Your applications
              </h2>
              <Link href="/applications" className="text-[13px] font-semibold text-accent-hover hover:underline">
                Open
              </Link>
            </div>
            <ul className="px-2 pb-2">
              {stageRows.map((row) => (
                <li key={row.label}>
                  <Link
                    href={row.href}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13.5px] transition-colors hover:bg-paper-deep"
                  >
                    <span className="text-ink-secondary">{row.label}</span>
                    <span className={`font-semibold tabular-nums ${row.count > 0 ? "text-ink" : "text-ink-muted/60"}`}>
                      {row.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {nextInterviewLabel && (
              <p className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[12.5px]">
                <span className="font-medium text-success">{nextInterviewLabel}</span>
                <Link
                  href={isFreePlan ? "/upgrade" : "/interview"}
                  className="font-semibold text-accent-hover hover:underline"
                >
                  Practise
                </Link>
              </p>
            )}
          </section>

          {/* Once the checklist's profile step is ticked, finishing the profile still helps: keep the
              next couple of things to add in view until it's complete. */}
          {setupSteps[0].done && completenessResult.percent < 100 && (
            <section aria-labelledby="profile-nudge" className="rounded-lg border border-border bg-surface px-4 py-3 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="profile-nudge" className="text-[15px] font-semibold text-ink">
                  Your profile is {completenessResult.percent}% done
                </h2>
                <Link href="/profile" className="text-[13px] font-semibold text-accent-hover hover:underline">
                  Open
                </Link>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1">
                {completenessResult.nextTasks.slice(0, 2).map((task) => (
                  <li key={task.id}>
                    <Link href={task.href} className="text-[13px] text-ink-secondary hover:text-ink hover:underline">
                      {task.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isFreePlan && (
            <section aria-labelledby="free-plan" className="rounded-lg border border-border bg-surface px-4 py-3 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="free-plan" className="text-[15px] font-semibold text-ink">
                  Free plan
                </h2>
                <Link href="/upgrade" className="text-[13px] font-semibold text-accent-hover hover:underline">
                  {CTA.goPro} · {PLANS.pro.prices.month.buttonLabel}
                </Link>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1">
                {[{ label: "Tailored resumes", used: resumesUsed, limit: FREE_RESUME_LIMIT }, ...dashboardUsageRows].map(
                  (row) => {
                    const left = Math.max(0, row.limit - row.used);
                    return (
                      <li key={row.label} className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="text-ink-secondary">{row.label}</span>
                        <span className={`tabular-nums ${left === 0 ? "font-semibold text-ink" : "text-ink-muted"}`}>
                          {left} of {row.limit} left
                        </span>
                      </li>
                    );
                  }
                )}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
