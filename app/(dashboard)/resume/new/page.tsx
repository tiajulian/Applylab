import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ResumeGate } from "@/components/resume/ResumeGate";
import { FirstRunBanner } from "@/components/resume/FirstRunBanner";
import { FREE_RESUME_LIMIT } from "@/lib/requireUser";
import { getListingForResume } from "@/lib/jobs/listingForResume";
import { PageHeader } from "@/components/ui/PageHeader";
import type { UserProfile } from "@/types";

export default async function NewResumePage({
  searchParams,
}: {
  searchParams: { firstrun?: string; job?: string };
}) {
  const user = await getCurrentUser();
  const supabase = createClient();

  // ?job=<id>: "Tailor resume & apply" from Find jobs - the listing pre-fills the form.
  const [{ data: profile }, listing] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", user!.authUserId).maybeSingle(),
    getListingForResume(searchParams.job),
  ]);

  const profileData = profile as UserProfile | null;
  const isPaidPlan = (user?.appUser?.plan ?? "free") !== "free";
  const remaining = isPaidPlan
    ? null
    : Math.max(0, FREE_RESUME_LIMIT - (user?.appUser?.resumes_used ?? 0));
  const firstRun = searchParams.firstrun === "1";

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">
      <PageHeader
        step={2}
        title="New resume"
        subtitle={
          listing
            ? "Paste the job ad, check your fit, and ApplyLab writes a 1-page resume for this job from your profile."
            : "ApplyLab writes a 1-page resume from your profile. Pick how you want to start."
        }
      />
      {firstRun && <FirstRunBanner />}
      <ResumeGate
        initial={{
          // Everything the gate's gap-fill save posts back to /api/profile must be seeded here,
          // or that save overwrites the omitted fields with empty values.
          career_goal: profileData?.career_goal,
          target_role: profileData?.target_role,
          job_hunt_pain: profileData?.job_hunt_pain,
          fullName: user?.appUser?.full_name ?? "",
          work_rights: profileData?.work_rights,
          phone: profileData?.phone,
          location: profileData?.location,
          linkedin_url: profileData?.linkedin_url,
          skills: profileData?.skills,
          tools: profileData?.tools,
          stakeholders: profileData?.stakeholders,
          work_experience: profileData?.work_experience,
          projects: profileData?.projects,
          education: profileData?.education,
          referees: profileData?.referees,
          raw_linkedin_paste: profileData?.raw_linkedin_paste,
        }}
        isPaidPlan={isPaidPlan}
        remaining={remaining}
        limit={FREE_RESUME_LIMIT}
        firstRun={firstRun}
        listing={listing}
      />
    </div>
  );
}
