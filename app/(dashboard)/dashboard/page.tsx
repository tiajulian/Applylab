import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QuotaIndicator } from "@/components/resume/QuotaIndicator";
import { CreateResumeCta } from "@/components/resume/CreateResumeCta";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { PipelineStrip } from "@/components/dashboard/PipelineStrip";
import { AttentionSection } from "@/components/dashboard/AttentionSection";
import { CareerProfileRailCard } from "@/components/dashboard/CareerProfileRailCard";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { FREE_RESUME_LIMIT } from "@/lib/requireUser";
import { isFirstRunUser } from "@/lib/routing";
import { getProfileCompleteness } from "@/lib/profile/completeness";
import { getPipelineCounts } from "@/lib/dashboard/pipeline";
import { getAttentionItems } from "@/lib/dashboard/attention";
import { formatInterviewDateTime } from "@/lib/dateUtils";
import { NAV_COPY } from "@/lib/copy";
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
  const remaining = Math.max(0, FREE_RESUME_LIMIT - resumesUsed);
  const limitReached = plan === "free" && resumesUsed >= FREE_RESUME_LIMIT;

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
  // STATE A — New User (<80% Profile, 0 Resumes, 0 Apps)
  // ==========================================
  if (isStateA) {
    return (
      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-accent">
            GETTING STARTED
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink">
            Welcome to ApplyLab, {firstName}.
          </h1>
          <p className="text-ink-secondary text-sm sm:text-base leading-relaxed">
            ApplyLab turns your real career facts into verified, ATS-ready Australian resumes and
            spoken interview preparation.
          </p>
        </div>

        {/* Hero Card */}
        <div className="rounded-xl border border-accent/30 bg-accent-soft/30 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-xl">
            <span className="text-xs font-bold text-accent uppercase tracking-wide">
              Step 1 of 3
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
              Build your verified Career Profile
            </h2>
            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
              Add your work history, confirmed duties, and key achievements once. We never invent or
              hallucinate claims you can&apos;t back.
            </p>
          </div>
          <Button href="/profile" size="lg" className="shrink-0">
            Build profile &rarr;
          </Button>
        </div>

        {/* 3 Step Workflow */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
              1
            </div>
            <h3 className="font-display text-base font-semibold text-ink">Career Profile</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Log your roles, duties, and wins. The bedrock for every tailored application.
            </p>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-deep text-sm font-bold text-ink-secondary">
              2
            </div>
            <h3 className="font-display text-base font-semibold text-ink">Tailored Resumes</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Paste any Australian job ad to generate an honest, ATS-scored resume.
            </p>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-deep text-sm font-bold text-ink-secondary">
              3
            </div>
            <h3 className="font-display text-base font-semibold text-ink">Mock Interviews</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Rehearse out loud with AI interviewer personas before your real rounds.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // ==========================================
  // STATE B — Profile Built, Ready for First Resume
  // ==========================================
  if (isStateB) {
    return (
      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-success">
            PROFILE COMPLETE ({completenessResult.percent}%)
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink">
            Your career profile is ready, {firstName}.
          </h1>
          <p className="text-ink-secondary text-sm sm:text-base leading-relaxed">
            Now let&apos;s target a real Australian role with your first tailored resume.
          </p>
        </div>

        {/* Hero Card */}
        <div className="rounded-xl border border-accent/40 bg-accent-soft/40 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-xl">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
              Generate your first tailored resume
            </h2>
            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
              Paste a job ad from SEEK, LinkedIn, or an employer portal. We&apos;ll match your
              verified experience and highlight honest strengths.
            </p>
          </div>
          <Button href="/resume/new" size="lg" className="shrink-0">
            Create resume &rarr;
          </Button>
        </div>

        {/* Action cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/matcher"
            className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6 transition-all hover:border-accent hover:shadow-sm"
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
            className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6 transition-all hover:border-accent hover:shadow-sm"
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
            <span className="mt-4 text-xs font-semibold text-accent">Install Extension &rarr;</span>
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // STATE C & D — Populated Dashboard
  // ==========================================
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink">
            {firstName ? `Welcome back, ${firstName}` : "Overview"}
          </h1>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Your Australian job search command centre.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button href="/resume/new" size="sm">
            {NAV_COPY.newResume}
          </Button>
          <QuotaIndicator isFreePlan={plan === "free"} remaining={remaining} limit={FREE_RESUME_LIMIT} />
        </div>
      </div>

      {/* Needs Attention Section (Zero DOM if 0 items) */}
      <AttentionSection items={attentionItems} />

      {/* Pipeline Strip (Zero DOM if 0 total count) */}
      <PipelineStrip counts={pipelineCounts} />

      {/* Main Grid: Content + Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left Column: Core Activities */}
        <div className="flex flex-col gap-6">
          {/* Next upcoming interview card if any */}
          {pipelineCounts.nextInterview && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-success/40 bg-success-soft/30 p-5 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/20 text-lg">
                  🎙️
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-success">
                    Upcoming interview
                  </span>
                  <h3 className="font-display text-base font-bold text-ink">
                    {pipelineCounts.nextInterview.jobTitle} at {pipelineCounts.nextInterview.companyName}
                  </h3>
                  <span className="text-xs text-ink-secondary">
                    {(() => {
                      const dt = formatInterviewDateTime(pipelineCounts.nextInterview.scheduledAt);
                      return `${dt.formattedDate} at ${dt.formattedTime} (${dt.relative})`;
                    })()} &bull;{" "}
                    {pipelineCounts.nextInterview.stageType.replace(/_/g, " ")} round
                  </span>
                </div>
              </div>

              <Link
                href={`/interview?application=${pipelineCounts.nextInterview.applicationId}&stage=${pipelineCounts.nextInterview.stageType}`}
                className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              >
                Rehearse round &rarr;
              </Link>
            </div>
          )}

          {/* Recent Tailored Resumes */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">
                  Recent documents
                </h2>
                <p className="text-xs text-ink-secondary">
                  Your tailored resumes and cover letters.
                </p>
              </div>
              <Link
                href="/documents"
                className="text-xs font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
              >
                View all ({resumeList.length}) &rarr;
              </Link>
            </div>

            {resumeList.length > 0 ? (
              <StaggerList className="grid gap-3 sm:grid-cols-2">
                {resumeList.slice(0, 4).map((resume) => (
                  <StaggerItem key={resume.id}>
                    <ResumeCard resume={resume} />
                  </StaggerItem>
                ))}
              </StaggerList>
            ) : (
              <div className="rounded border border-dashed border-border p-6 text-center text-xs text-ink-muted">
                No resumes created yet
              </div>
            )}
          </div>

          {/* Applications Tracker Summary */}
          {applicationList.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">
                    Active applications
                  </h2>
                  <p className="text-xs text-ink-secondary">
                    Applications currently tracked on your board.
                  </p>
                </div>
                <Link
                  href="/applications"
                  className="text-xs font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
                >
                  View tracker board &rarr;
                </Link>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {applicationList.slice(0, 4).map((app) => (
                  <Link
                    key={app.id}
                    href="/applications"
                    className="flex flex-col justify-between rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-border-strong hover:bg-paper"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold text-xs text-ink">{app.job_title}</span>
                      <span className="rounded bg-paper-deep px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary uppercase">
                        {app.status}
                      </span>
                    </div>
                    <span className="mt-1 text-xs text-ink-muted">{app.company_name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Side Rail */}
        <div className="flex flex-col gap-5">
          {/* Career Profile Rail Card (Hides at 100%) */}
          <CareerProfileRailCard completeness={completenessResult} />

          {/* Quick Tools */}
          <Card className="flex flex-col gap-3 p-4">
            <h3 className="font-display text-sm font-semibold text-ink">Quick tools</h3>
            <div className="flex flex-col gap-2 text-xs">
              <Link
                href="/resume/new"
                className="flex items-center gap-2 rounded p-2 text-ink transition-colors hover:bg-paper-deep"
              >
                <span>📄</span>
                <span className="font-medium">Tailor new resume</span>
              </Link>
              <Link
                href="/interview"
                className="flex items-center gap-2 rounded p-2 text-ink transition-colors hover:bg-paper-deep"
              >
                <span>🎙️</span>
                <span className="font-medium">AI Mock Interview</span>
              </Link>
              <Link
                href="/matcher"
                className="flex items-center gap-2 rounded p-2 text-ink transition-colors hover:bg-paper-deep"
              >
                <span>🎯</span>
                <span className="font-medium">Job Ad Matcher</span>
              </Link>
              <Link
                href="/extension"
                className="flex items-center gap-2 rounded p-2 text-ink transition-colors hover:bg-paper-deep"
              >
                <span>🧩</span>
                <span className="font-medium">Chrome Extension</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
