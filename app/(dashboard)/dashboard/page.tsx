import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { Button } from "@/components/ui/Button";
import { PipelineStrip } from "@/components/dashboard/PipelineStrip";
import { AttentionSection } from "@/components/dashboard/AttentionSection";
import { CareerProfileRailCard } from "@/components/dashboard/CareerProfileRailCard";
import { NextStepCard, type NextStep } from "@/components/dashboard/NextStepCard";
import { ArrowRightIcon } from "@/components/ui/icons/LucideIcons";
import { FREE_RESUME_LIMIT, FREE_TIER_FEATURE_LIMITS } from "@/lib/requireUser";
import { getProfileCompleteness, meetsMVP, toScorableProfile } from "@/lib/profile/completeness";
import { CTA, FEATURE_LABELS } from "@/lib/marketing/copy";
import { PLANS } from "@/lib/marketing/plans";
import { computePipelineCountsFromData } from "@/lib/dashboard/pipeline";
import { evaluateAttentionItems, getClosingSoonAds } from "@/lib/dashboard/attention";
import { formatEnAuDate } from "@/lib/dateUtils";
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

  // Where the user is in the four-step job hunt, and the single thing to do next.
  const profileReady = meetsMVP(scorableProfile);
  const interviewing = applicationList.find((a) => a.status === "interviewing");
  const stepsDone: [boolean, boolean, boolean, boolean] = [
    profileReady,
    resumeList.length > 0,
    applicationList.length > 0,
    false,
  ];
  const tailorCta =
    isFreePlan && resumesLeft === 0
      ? { href: "/upgrade", label: `${CTA.goPro} to tailor more` }
      : { href: "/resume/new", label: "Tailor a resume" };

  let next: NextStep;
  if (!profileReady) {
    next = {
      step: 1,
      title: "Finish your profile",
      body: "Add your jobs, duties and skills once. Every resume ApplyLab writes comes from this, so nothing is made up.",
      cta: { href: "/profile", label: "Add your experience" },
    };
  } else if (resumeList.length === 0) {
    next = {
      step: 2,
      title: "Make your first tailored resume",
      body: "Paste a job ad from SEEK or LinkedIn. ApplyLab writes a 1-page resume for that job, using only your profile.",
      cta: tailorCta,
    };
  } else if (applicationList.length === 0) {
    const latest = resumeList[0];
    next = {
      step: 3,
      title: "Applied? Add it to your list",
      body: latest.job_title
        ? `Once you've sent your ${latest.job_title} resume, add the job here so you can keep track of replies and interviews.`
        : "Once you've sent your resume, add the job here so you can keep track of replies and interviews.",
      cta: { href: "/applications", label: "Go to applications" },
      secondary: { href: `/resume/${latest.id}`, label: "Open your latest resume" },
    };
  } else if (interviewing) {
    next = {
      step: 4,
      title: `Get ready for ${interviewing.company_name}`,
      body: `Practise answering questions for the ${interviewing.job_title} interview, out loud or by typing, and get feedback on each answer.`,
      cta: isFreePlan
        ? { href: "/upgrade", label: `${CTA.goPro} to practise` }
        : { href: "/interview", label: "Start practising" },
    };
  } else {
    next = {
      step: 2,
      title: "Tailor a resume for your next job",
      body: "Found another job ad? Paste it in and get a resume written for that job.",
      cta: tailorCta,
      secondary: { href: "/applications", label: "See your applications" },
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
      <header>
        <h1 className="font-display text-[30px] font-semibold leading-[1.1] text-ink sm:text-[36px]">
          {firstName ? `Hi ${firstName}` : "Welcome"}
        </h1>
        <p className="mt-1.5 text-[15.5px] text-ink-secondary">
          {attentionItems.length > 0
            ? `Here's your next step, and ${attentionItems.length} thing${attentionItems.length === 1 ? "" : "s"} to check this week.`
            : "Here's your next step."}
        </p>
      </header>

      <NextStepCard next={next} done={stepsDone} />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          <AttentionSection items={attentionItems} />

          <PipelineStrip counts={pipelineCounts} />

          {resumeList.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="recent-resumes">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="recent-resumes" className="text-[17px] font-semibold text-ink">
                  Your recent resumes
                </h2>
                <Link href="/documents" className="text-[13.5px] font-semibold text-accent-hover hover:underline">
                  See all
                </Link>
              </div>

              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                {resumeList.slice(0, 3).map((resume) => {
                  const isApplied = linkedResumeIds.has(resume.id);
                  return (
                    <li key={resume.id}>
                      <Link
                        href={`/resume/${resume.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors duration-fast hover:bg-paper-deep/50 sm:px-5"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[15px] font-semibold text-ink">
                            {resume.job_title || "General resume"}
                          </span>
                          <span className="mt-0.5 truncate text-[13px] text-ink-muted">
                            {[resume.company_name, formatEnAuDate(resume.created_at, { shortMonth: true })]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2.5">
                          <span
                            className={`rounded-pill px-2.5 py-1 text-[12px] font-semibold ${
                              isApplied ? "bg-success-soft text-success" : "bg-paper-deep text-ink-secondary"
                            }`}
                          >
                            {isApplied ? "Sent" : "Not sent yet"}
                          </span>
                          <ArrowRightIcon className="h-4 w-4 text-ink-muted" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {/* 69px header + 24px breathing room. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[93px]">
          {completenessResult.percent < 100 && <CareerProfileRailCard completeness={completenessResult} />}

          {isFreePlan && (
            <section
              aria-labelledby="free-plan"
              className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-5 shadow-sm"
            >
              <div>
                <h2 id="free-plan" className="text-[15px] font-semibold text-ink">
                  You&apos;re on the free plan
                </h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">
                  Here&apos;s what you have left. {CTA.goPro} for unlimited resumes, cover letters and interview
                  practice.
                </p>
              </div>

              <ul className="flex flex-col gap-2.5">
                {[{ label: "Tailored resumes", used: resumesUsed, limit: FREE_RESUME_LIMIT }, ...dashboardUsageRows].map(
                  (row) => {
                    const left = Math.max(0, row.limit - row.used);
                    return (
                      <li key={row.label} className="flex flex-col gap-1.5">
                        <span className="flex items-center justify-between gap-3 text-[13px]">
                          <span className="text-ink">{row.label}</span>
                          <span className={`tabular-nums ${left === 0 ? "font-semibold text-ink-secondary" : "text-ink-muted"}`}>
                            {left} of {row.limit} left
                          </span>
                        </span>
                        <span className="h-1.5 w-full overflow-hidden rounded-full bg-paper-deep" aria-hidden="true">
                          <span
                            className="block h-full rounded-full bg-ink-muted/50"
                            style={{ width: `${Math.min(100, (left / row.limit) * 100)}%` }}
                          />
                        </span>
                      </li>
                    );
                  }
                )}
              </ul>

              <Button href="/upgrade" variant="outline" size="sm" className="mt-1 w-full justify-center rounded-pill">
                {CTA.goPro} · {PLANS.pro.prices.month.buttonLabel}
              </Button>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
