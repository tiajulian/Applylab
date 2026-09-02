import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ResumeWorkspace } from "@/components/resume/ResumeWorkspace";
import { GenerationStepper } from "@/components/resume/GenerationStepper";
import { Button } from "@/components/ui/Button";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import type { ProjectEntry, Resume } from "@/types";

export default async function ResumeDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string; fromGeneration?: string; unlocked?: string };
}) {
  const user = await getCurrentUser();
  const supabase = createClient();

  const [{ data: resume }, { data: existingApplications }, { data: unlockRow }, { data: profileRow }] = await Promise.all([
    supabase.from("resumes").select("*").eq("id", params.id).single(),
    // limit(1) rather than maybeSingle(): a resume can have more than one linked application
    // (no unique constraint on resume_id), and maybeSingle() errors out on multiple rows.
    supabase.from("applications").select("id").eq("resume_id", params.id).limit(1),
    user?.appUser?.id
      ? supabase
          .from("resume_unlocks")
          .select("id")
          .eq("user_id", user.appUser.id)
          .eq("resume_id", params.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user?.authUserId
      ? supabase
          .from("user_profiles")
          .select("projects")
          .eq("user_id", user.authUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!resume) {
    notFound();
  }

  const plan = user?.appUser?.plan ?? "free";
  const isResumeUnlocked = plan !== "free" || Boolean(unlockRow);
  // resume_content is stored as jsonb, so a row from before a ResumeContent schema change simply
  // won't have the newer fields - normalize it here rather than let the editor/templates crash
  // on target_titles/tools/projects being undefined instead of an empty array.
  const resumeRow: Resume = {
    ...(resume as Resume),
    resume_content: resume.resume_content ? sanitizeResumeContent(resume.resume_content) : null,
  };

  return (
    <div className="flex flex-col gap-4">
      {searchParams?.fromGeneration === "1" && (
        <div className="flex flex-col gap-4">
          <GenerationStepper currentStep={3} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-4 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                Resume Generated Successfully
              </span>
              <p className="text-sm font-medium text-ink">
                Run the 5-pillar AI Resume Review to evaluate your ATS parseability, writing quality, and content impact.
              </p>
            </div>
            <Link href={`/resume/${resumeRow.id}/review`}>
              <Button type="button" size="sm">
                View AI Review →
              </Button>
            </Link>
          </div>
        </div>
      )}

      <ResumeWorkspace
        resume={resumeRow}
        profileProjects={(profileRow?.projects as any[]) ?? []}
        isPaidPlan={plan !== "free"}
        isResumeUnlocked={isResumeUnlocked}
        isInitiallyUnlockedNotification={searchParams?.unlocked === "1"}
        isTrackedInitially={(existingApplications?.length ?? 0) > 0}
        initialTab={searchParams?.tab === "cover-letter" ? "cover-letter" : "resume"}
      />
    </div>
  );
}

