import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getUserProfile } from "@/lib/profile/getUserProfile";
import { TodoCountLine, TodoProvider, TodoSection } from "@/components/dashboard/home/HomeTodo";
import { WelcomeBanner } from "@/components/dashboard/home/WelcomeBanner";
import {
  ApplicationsSummary,
  JobMatchesSection,
  NewUserSteps,
  type SetupStep,
  type StageRow,
} from "@/components/dashboard/home/HomeSections";
import { btnPrimary, sectionLink, sectionTitle, textLink } from "@/components/dashboard/home/homeStyles";
import { FREE_RESUME_LIMIT, FREE_TIER_FEATURE_LIMITS } from "@/lib/requireUser";
import { toScorableProfile } from "@/lib/profile/completeness";
import { CTA, FEATURE_LABELS } from "@/lib/marketing/copy";
import { PLANS } from "@/lib/marketing/plans";
import { computePipelineCountsFromData } from "@/lib/dashboard/pipeline";
import { evaluateAttentionItems, getClosingSoonAds } from "@/lib/dashboard/attention";
import { getHomeJobs } from "@/lib/dashboard/homeJobs";

export const dynamic = "force-dynamic";

// Kept short and deliberately narrow (spec §10/§15: show usage without it feeling like a surprise,
// never a wall of progress bars) - just the features that share the "roughly one per application"
// mental model as resumes. Higher-limit features rely on their own in-context limit-reached UI.
const DASHBOARD_USAGE_FEATURES = ["cover-letter", "resume-review", "skills-bridge"] as const;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();

  const plan = user.appUser?.plan ?? "free";
  const resumesUsed = user.appUser?.resumes_used ?? 0;
  const isFreePlan = plan === "free";

  // One shared fetch of resumes/applications/interviews, reused for the pipeline counts, the to-do
  // items and the new-user check. The profile comes from the same per-request cache the sidebar's
  // completion % uses. parsed_job_ads comes from getClosingSoonAds()'s short-TTL cache (see
  // lib/dashboard/attention.ts).
  const [
    { data: resumes },
    { data: applications },
    { data: interviews },
    profile,
    { data: followups },
    mappedAds,
    { data: featureUsageRows },
    jobs,
  ] = await Promise.all([
    supabase.from("resumes").select("id").eq("user_id", user.authUserId),
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
    getUserProfile(user.authUserId),
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
    getHomeJobs(user.authUserId),
  ]);

  const resumeList = resumes ?? [];
  const applicationList = applications ?? [];

  const fullName = user.appUser?.full_name?.trim() || "";
  const firstName = fullName ? fullName.split(/\s+/)[0] : "";

  const resumesLeft = Math.max(0, FREE_RESUME_LIMIT - resumesUsed);
  const freeResumeUsed = isFreePlan && resumesLeft === 0;
  const tailorHref = freeResumeUsed ? "/upgrade" : "/resume/new";

  const hasExperience = toScorableProfile(profile, fullName).work_experience.length > 0;

  // New user (no experience and no resumes): the page is just the three steps to a first resume.
  if (resumeList.length === 0 && !hasExperience) {
    const steps: SetupStep[] = [
      {
        title: "Add your experience",
        sub: "Import from LinkedIn or upload your resume",
        done: hasExperience,
        current: !hasExperience,
        action: hasExperience ? undefined : { label: "Start", href: "/profile" },
      },
      {
        title: "Tailor a resume to a job ad",
        sub: isFreePlan && resumesLeft > 0 ? "Your first one is free" : undefined,
        done: false,
        current: hasExperience,
        action: hasExperience ? { label: freeResumeUsed ? `${CTA.goPro} to tailor more` : "Start", href: tailorHref } : undefined,
      },
      {
        title: "Add the Chrome extension",
        sub: "Optional. Fills in SEEK forms for you",
        done: false,
        current: false,
        action: { label: "Add", href: "/extension" },
      },
    ];
    return (
      <HomeShell>
        <WelcomeBanner
          heading={firstName ? `Welcome, ${firstName}` : "Welcome"}
          sub="Get your first tailored resume in 3 steps."
        />
        <NewUserSteps steps={steps} />
      </HomeShell>
    );
  }

  const pipelineCounts = computePipelineCountsFromData(resumeList, applicationList, interviews ?? []);
  const attentionItems = evaluateAttentionItems(applicationList, interviews ?? [], followups ?? [], mappedAds);

  // Waiting + Interviewing + Offer are the three open application statuses, so together they count
  // every non-closed application exactly once. "Ready to send" is tailored resumes not yet linked
  // to an application.
  // TODO(phase 2): there's no "not sent yet" application status, so Ready to send links to the
  // resumes page rather than a filtered Applications view.
  const stages: StageRow[] = [
    { label: "Ready to send", count: pipelineCounts.drafted, href: "/documents", color: "#60A5FA" },
    { label: "Waiting to hear back", count: pipelineCounts.applied, href: "/applications?stage=applied", color: "#A8A29E" },
    {
      label: "Interviewing",
      count: pipelineCounts.screening + pipelineCounts.interview,
      href: "/applications?stage=interviewing",
      color: "#EA580C",
    },
    { label: "Offer", count: pipelineCounts.offer, href: "/applications?stage=offer", color: "#15803D" },
  ];

  const featureUsage = new Map<string, number>((featureUsageRows ?? []).map((r) => [r.feature, r.count]));
  const usageRows = [
    { label: "Tailored resumes", used: resumesUsed, limit: FREE_RESUME_LIMIT },
    ...DASHBOARD_USAGE_FEATURES.map((feature) => ({
      label: FEATURE_LABELS[feature].plural,
      used: featureUsage.get(feature) ?? 0,
      limit: FREE_TIER_FEATURE_LIMITS[feature],
    })),
  ];

  return (
    <HomeShell>
      <TodoProvider total={attentionItems.length}>
        <WelcomeBanner
          heading={firstName ? `Hi ${firstName}` : "Hi there"}
          sub={<TodoCountLine />}
          showArt
          actions={
            <>
              <Link className={btnPrimary} href={tailorHref}>
                Tailor a resume to a job ad
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link className={textLink} href="/cover-letter">
                Write a cover letter
              </Link>
            </>
          }
        />

        <div className="mt-10 flex flex-col items-start gap-8 min-[1025px]:flex-row">
          <div className="flex w-full min-w-0 flex-1 flex-col gap-10">
            <TodoSection items={attentionItems} />
            <JobMatchesSection jobs={jobs} />
          </div>

          <aside className="flex w-full flex-none flex-col gap-4 min-[1025px]:w-[300px]">
            <ApplicationsSummary stages={stages} />

            {isFreePlan && (
              <section aria-labelledby="free-plan" className="rounded-2xl border border-dash-border bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="free-plan" className={sectionTitle}>
                    Free plan
                  </h2>
                  <Link href="/upgrade" className={sectionLink}>
                    {CTA.goPro} · {PLANS.pro.prices.month.buttonLabel}
                  </Link>
                </div>
                <ul className="mt-3">
                  {usageRows.map((usage) => {
                    const left = Math.max(0, usage.limit - usage.used);
                    return (
                      <li
                        key={usage.label}
                        className="flex min-h-[36px] items-center justify-between gap-3 border-t border-dash-divider text-[14px]"
                      >
                        <span className="text-dash-text-2">{usage.label}</span>
                        <span className={left === 0 ? "font-semibold text-dash-text" : "text-dash-muted"}>
                          {left} of {usage.limit} left
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </TodoProvider>
    </HomeShell>
  );
}

/**
 * The reference's .main/.main-inner: Geist type, 1000px column. The extra padding tops the shared
 * layout's <main> padding up to the reference's 40px 48px 64px (24px 16px 48px below 768px).
 */
function HomeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-4 pt-1 font-dash leading-normal text-dash-text sm:pt-0 sm:max-md:-mx-4 md:px-4 md:pb-8 md:pt-4 lg:pb-6 lg:pl-5 lg:pr-4 [&_:focus-visible]:outline-dash-orange-ink">
      <div className="mx-auto max-w-[1000px]">{children}</div>
    </div>
  );
}
