import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { Button } from "@/components/ui/Button";
import { CompletenessMeter } from "@/components/profile/CompletenessMeter";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { FREE_RESUME_LIMIT } from "@/lib/requireUser";
import type { Resume } from "@/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { onboarded?: string };
}) {
  const user = await getCurrentUser();
  const supabase = createClient();

  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user!.authUserId)
    .order("created_at", { ascending: false })
    .limit(3);

  const fullName = user?.appUser?.full_name?.trim();
  const firstName = fullName ? fullName.split(/\s+/)[0] : null;

  const plan = user?.appUser?.plan ?? "free";
  const resumesUsed = user?.appUser?.resumes_used ?? 0;
  const limitReached = plan === "free" && resumesUsed >= FREE_RESUME_LIMIT;

  const completeness = user?.appUser?.profile_completeness ?? 0;

  return (
    <div className="flex flex-col gap-8">
      {searchParams.onboarded === "1" && (
        <Reveal>
          <div className="rounded border border-success/20 bg-success-soft px-4 py-3 text-sm text-success">
            Your profile is complete, and you&apos;re ready to generate your first tailored resume.
          </div>
        </Reveal>
      )}

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
        <div className="flex items-center gap-3">
          <Button href="/documents" variant="outline">
            View documents
          </Button>
          {limitReached ? (
            <Button href="/upgrade">Upgrade to continue</Button>
          ) : (
            <Button href="/resume/new">New resume</Button>
          )}
        </div>
      </div>

      {/* Profile Completeness Alert */}
      {completeness < 100 && (
        <Reveal>
          <CompletenessMeter completeness={completeness} />
        </Reveal>
      )}

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
                  <span>Tailor New Resume</span>
                </Link>
                <Link
                  href="/documents"
                  className="flex items-center gap-2.5 rounded-md border border-border bg-paper p-3 font-medium text-ink transition-colors hover:border-accent hover:bg-paper-deep"
                >
                  <span className="text-base">📁</span>
                  <span>All Documents</span>
                </Link>
                <Link
                  href="/interview"
                  className="flex items-center gap-2.5 rounded-md border border-border bg-paper p-3 font-medium text-ink transition-colors hover:border-accent hover:bg-paper-deep"
                >
                  <span className="text-base">🎙️</span>
                  <span>Interview Prep</span>
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 rounded-md border border-border bg-paper p-3 font-medium text-ink transition-colors hover:border-accent hover:bg-paper-deep"
                >
                  <span className="text-base">👤</span>
                  <span>Career Profile</span>
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
            View all documents &rarr;
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
                <Button href="/resume/new" size="sm">Create your first resume</Button>
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
