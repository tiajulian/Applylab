import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { Button } from "@/components/ui/Button";
import { PipelineStrip } from "@/components/dashboard/PipelineStrip";
import { AttentionSection } from "@/components/dashboard/AttentionSection";
import { CareerProfileRailCard } from "@/components/dashboard/CareerProfileRailCard";
import { FREE_RESUME_LIMIT } from "@/lib/requireUser";
import { isFirstRunUser } from "@/lib/routing";
import { getProfileCompleteness } from "@/lib/profile/completeness";
import { getPipelineCounts } from "@/lib/dashboard/pipeline";
import { getAttentionItems } from "@/lib/dashboard/attention";
import { formatEnAuDate } from "@/lib/dateUtils";
import type { Resume, UserProfile, Application } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();

  if (await isFirstRunUser(supabase, user.authUserId, user.appUser?.resumes_used ?? 0)) {
    redirect("/resume/new?firstrun=1");
  }

  const [
    { data: resumes },
    { data: applications },
    { data: profile },
    pipelineCounts,
    attentionItems,
  ] = await Promise.all([
    supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user.authUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.authUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.authUserId)
      .maybeSingle(),
    getPipelineCounts(supabase, user.authUserId),
    getAttentionItems(supabase, user.authUserId),
  ]);

  const fullName = user.appUser?.full_name?.trim() || "";
  const firstName = fullName ? fullName.split(/\s+/)[0] : "there";

  const plan = user.appUser?.plan ?? "free";
  const resumesUsed = user.appUser?.resumes_used ?? 0;
  const isFreePlan = plan === "free";

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

  const resumeList = (resumes || []) as Resume[];
  const applicationList = (applications || []) as Application[];

  const isStateA =
    resumeList.length === 0 && applicationList.length === 0 && completenessResult.percent < 80;
  const isStateB =
    resumeList.length === 0 && applicationList.length === 0 && completenessResult.percent >= 80;

  // ==========================================
  // STATE A - New User (<80% Profile, 0 Resumes, 0 Apps)
  // ==========================================
  if (isStateA) {
    return (
      <div className="flex flex-col gap-8 max-w-4xl mx-auto py-2">
        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
            GETTING STARTED
          </span>
          <h1 className="font-display text-3xl sm:text-[36px] sm:leading-[1.05] font-semibold text-ink">
            Welcome to ApplyLab, {firstName}.
          </h1>
          <p className="text-[15px] text-ink-secondary leading-relaxed">
            ApplyLab turns your real career facts into verified, ATS-ready Australian resumes and
            spoken interview preparation.
          </p>
        </div>

        {/* Hero Card */}
        <div className="rounded-lg border border-accent/30 bg-accent-soft/30 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
          <div className="flex flex-col gap-2 max-w-xl">
            <span className="text-[10.5px] font-bold text-accent uppercase tracking-[0.12em]">
              Step 1 of 3
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
              Build your verified Career Profile
            </h2>
            <p className="text-[13px] text-ink-secondary leading-relaxed">
              Add your work history, confirmed duties, and key achievements once. We never invent or
              hallucinate claims you can&apos;t back.
            </p>
          </div>
          <Button href="/profile" size="lg" className="shrink-0 rounded-pill">
            Build profile &rarr;
          </Button>
        </div>

        {/* 3 Step Workflow */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
              1
            </div>
            <h3 className="font-display text-base font-semibold text-ink">Career Profile</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Log your roles, duties, and wins. The bedrock for every tailored application.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-deep text-sm font-bold text-ink-secondary">
              2
            </div>
            <h3 className="font-display text-base font-semibold text-ink">Tailored Resumes</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Paste any Australian job ad to generate an honest, ATS-scored resume.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-deep text-sm font-bold text-ink-secondary">
              3
            </div>
            <h3 className="font-display text-base font-semibold text-ink">Mock Interviews</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Rehearse out loud with AI interviewer personas before your real rounds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // STATE B - Profile Built, Ready for First Resume
  // ==========================================
  if (isStateB) {
    return (
      <div className="flex flex-col gap-8 max-w-4xl mx-auto py-2">
        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-success">
            PROFILE COMPLETE ({completenessResult.percent}%)
          </span>
          <h1 className="font-display text-3xl sm:text-[36px] sm:leading-[1.05] font-semibold text-ink">
            Your career profile is ready, {firstName}.
          </h1>
          <p className="text-[15px] text-ink-secondary leading-relaxed">
            Now let&apos;s target a real Australian role with your first tailored resume.
          </p>
        </div>

        {/* Hero Card */}
        <div className="rounded-lg border border-accent/40 bg-accent-soft/40 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
          <div className="flex flex-col gap-2 max-w-xl">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
              Generate your first tailored resume
            </h2>
            <p className="text-[13px] text-ink-secondary leading-relaxed">
              Paste a job ad from SEEK, LinkedIn, or an employer portal. We&apos;ll match your
              verified experience and highlight honest strengths.
            </p>
          </div>
          <Button href="/matcher" size="lg" className="shrink-0 rounded-pill">
            Start application &rarr;
          </Button>
        </div>

        {/* Action cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/matcher"
            className="flex flex-col justify-between rounded-lg border border-border bg-surface p-5 shadow-sm transition-all hover:border-accent hover:shadow-pop"
          >
            <div>
              <span className="text-2xl">🎯</span>
              <h3 className="mt-3 font-display text-base font-semibold text-ink">
                Job Ad Matcher
              </h3>
              <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
                Check your ATS score and skill gaps against any job ad before applying.
              </p>
            </div>
            <span className="mt-4 text-xs font-semibold text-accent">Open Matcher &rarr;</span>
          </Link>

          <Link
            href="/extension"
            className="flex flex-col justify-between rounded-lg border border-border bg-surface p-5 shadow-sm transition-all hover:border-accent hover:shadow-pop"
          >
            <div>
              <span className="text-2xl">🧩</span>
              <h3 className="mt-3 font-display text-base font-semibold text-ink">
                Chrome Extension
              </h3>
              <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
                Extract job ads from SEEK and LinkedIn in 1 click right from your browser.
              </p>
            </div>
            <span className="mt-4 text-xs font-semibold text-accent">Manage Extension &rarr;</span>
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // STATE C & D - Populated Dashboard
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
          <Button href="/matcher" size="md" className="font-semibold shadow-sm rounded-pill">
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

          {/* Plan Card (Free Tier only) */}
          {isFreePlan && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-sm">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                FREE PLAN
              </span>
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <span>Applications used</span>
                <span>
                  {resumesUsed} of {FREE_RESUME_LIMIT}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-fast"
                  style={{
                    width: `${Math.min(100, (resumesUsed / FREE_RESUME_LIMIT) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[12.5px] text-ink-secondary leading-relaxed">
                Upgrade to Pro for unlimited tailored resumes, ATS scores, and AI spoken interview rehearsal.
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
