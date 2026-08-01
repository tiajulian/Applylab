import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { Button } from "@/components/ui/Button";
import { CompletenessMeter } from "@/components/profile/CompletenessMeter";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import type { Resume } from "@/types";

const FREE_RESUME_LIMIT = 2;

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
    .order("created_at", { ascending: false });

  const plan = user?.appUser?.plan ?? "free";
  const resumesUsed = user?.appUser?.resumes_used ?? 0;
  const remaining = Math.max(0, FREE_RESUME_LIMIT - resumesUsed);
  const limitReached = plan === "free" && resumesUsed >= FREE_RESUME_LIMIT;

  return (
    <div className="flex flex-col gap-8">
      {searchParams.onboarded === "1" && (
        <Reveal>
          <div className="rounded border border-success/20 bg-success-soft px-4 py-3 text-sm text-success">
            Your profile is complete, and you&apos;re ready to generate your first tailored resume.
          </div>
        </Reveal>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 text-ink">Your resumes</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {plan === "free"
              ? `${remaining} of ${FREE_RESUME_LIMIT} free resumes remaining`
              : "Unlimited resumes on your plan"}
          </p>
        </div>
        {limitReached ? (
          <Link href="/upgrade">
            <Button>Upgrade to continue</Button>
          </Link>
        ) : (
          <Link href="/resume/new">
            <Button>New resume</Button>
          </Link>
        )}
      </div>

      {(user?.appUser?.profile_completeness ?? 0) < 100 && (
        <CompletenessMeter completeness={user?.appUser?.profile_completeness ?? 0} />
      )}

      {(!resumes || resumes.length === 0) && (
        <Reveal>
          <div className="rounded border border-dashed border-border-strong bg-surface p-12 text-center">
            <h2 className="font-display text-h3 text-ink">No resumes yet</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Paste a job description and we&apos;ll build you a SEEK-ready resume.
            </p>
            <Link href="/resume/new" className="mt-4 inline-block">
              <Button>Create your first resume</Button>
            </Link>
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
  );
}
