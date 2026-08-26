import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { Button } from "@/components/ui/Button";
import { ProfileCompleteness } from "@/components/profile/ProfileCompleteness";
import { QuotaIndicator } from "@/components/resume/QuotaIndicator";
import { CreateResumeCta } from "@/components/resume/CreateResumeCta";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { FREE_RESUME_LIMIT } from "@/lib/requireUser";
import { isFirstRunUser } from "@/lib/routing";
import { getImprovementSuggestions, joinSuggestions } from "@/lib/profile/completeness";
import { NAV_COPY } from "@/lib/copy";
import type { Resume, UserProfile } from "@/types";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = createClient();

  if (user && (await isFirstRunUser(supabase, user.authUserId, user.appUser?.resumes_used ?? 0))) {
    redirect("/resume/new?firstrun=1");
  }

  const [{ data: resumes }, { data: profile }] = await Promise.all([
    supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user!.authUserId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase.from("user_profiles").select("*").eq("user_id", user!.authUserId).maybeSingle(),
  ]);

  const fullName = user?.appUser?.full_name?.trim();
  const firstName = fullName ? fullName.split(/\s+/)[0] : null;

  const plan = user?.appUser?.plan ?? "free";
  const resumesUsed = user?.appUser?.resumes_used ?? 0;
  const remaining = Math.max(0, FREE_RESUME_LIMIT - resumesUsed);
  const limitReached = plan === "free" && resumesUsed >= FREE_RESUME_LIMIT;
  const hasResumes = !!resumes && resumes.length > 0;

  const completeness = user?.appUser?.profile_completeness ?? 0;
  const profileData = profile as UserProfile | null;
  const suggestions = getImprovementSuggestions({
    fullName: fullName ?? "",
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
  const suggestionText = suggestions.length > 0 ? joinSuggestions(suggestions) : "";

  return (
    <div className="flex flex-col gap-8">
      {/* Overview Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 text-ink">
            {firstName ? `Welcome back, ${firstName}` : "Overview"}
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Your job search command centre at a glance.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-3">
            <Button href="/documents" variant="outline">
              {NAV_COPY.documents}
            </Button>
            <CreateResumeCta limitReached={limitReached} variant={hasResumes ? "primary" : "outline"} />
          </div>
          <QuotaIndicator isFreePlan={plan === "free"} remaining={remaining} limit={FREE_RESUME_LIMIT} />
        </div>
      </div>

      {/* Profile Completeness Alert */}
      <ProfileCompleteness completeness={completeness} suggestionText={suggestionText} context="dashboard" />

      {/* Snapshot Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Applications */}
        <Reveal delay={0.05}>
          <div className="flex h-full flex-col justify-between rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Applications</h2>
              <p className="mt-1 text-xs text-ink-secondary">
                Track every role you&apos;ve applied to, from first submission through to offer.
              </p>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <Link
                href="/applications"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
              >
                Open Applications Board &rarr;
              </Link>
            </div>
          </div>
        </Reveal>

        {/* Quick Actions Hub */}
        <Reveal delay={0.1}>
          <div className="flex h-full flex-col justify-between rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Quick Actions</h2>
              <p className="mt-1 text-xs text-ink-secondary">
                Jump directly to core tools and workflows.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <Link
                  href="/resume/new"
                  className="flex items-center gap-2.5 rounded-md border border-border bg-paper p-3 font-medium text-ink transition-colors hover:border-accent hover:bg-paper-deep"
                >
                  <span className="text-base">📄</span>
                  <span>{NAV_COPY.newResume}</span>
                </Link>
                <Link
                  href="/documents"
                  className="flex items-center gap-2.5 rounded-md border border-border bg-paper p-3 font-medium text-ink transition-colors hover:border-accent hover:bg-paper-deep"
                >
                  <span className="text-base">📁</span>
                  <span>{NAV_COPY.documents}</span>
                </Link>
                <Link
                  href="/interview"
                  className="flex items-center gap-2.5 rounded-md border border-border bg-paper p-3 font-medium text-ink transition-colors hover:border-accent hover:bg-paper-deep"
                >
                  <span className="text-base">🎙️</span>
                  <span>{NAV_COPY.interview}</span>
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 rounded-md border border-border bg-paper p-3 font-medium text-ink transition-colors hover:border-accent hover:bg-paper-deep"
                >
                  <span className="text-base">👤</span>
                  <span>{NAV_COPY.careerProfile}</span>
                </Link>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <Link
                href="/extension"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary transition-colors hover:text-ink hover:underline"
              >
                🧩 Chrome Extension setup &rarr;
              </Link>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Recent Documents */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-h3 text-ink">Recent documents</h2>
            <p className="text-xs text-ink-secondary">Your latest tailored resumes and cover letters.</p>
          </div>
          <Link
            href="/documents"
            className="text-xs font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
          >
            {NAV_COPY.viewAllDocuments} &rarr;
          </Link>
        </div>

        {(!resumes || resumes.length === 0) && (
          <Reveal>
            <div className="rounded border border-dashed border-border-strong bg-surface p-8 text-center">
              <h3 className="font-display text-base font-semibold text-ink">No resumes yet</h3>
              <p className="mt-1 text-xs text-ink-secondary">
                Paste a job description and we&apos;ll build you a SEEK-ready resume.
              </p>
              <div className="mt-4 inline-block">
                <CreateResumeCta limitReached={limitReached} size="sm" />
              </div>
            </div>
          </Reveal>
        )}

        {resumes && resumes.length > 0 && (
          <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(resumes as Resume[]).map((resume) => (
              <StaggerItem key={resume.id}>
                <ResumeCard resume={resume} />
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  );
}
