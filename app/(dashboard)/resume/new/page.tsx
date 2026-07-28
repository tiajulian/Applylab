import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ResumeGate } from "@/components/resume/ResumeGate";
import type { UserProfile } from "@/types";

export default async function NewResumePage() {
  const user = await getCurrentUser();
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user!.authUserId)
    .maybeSingle();

  const profileData = profile as UserProfile | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">New resume</h1>
        <p className="mt-1 text-sm text-gray-500">
          Paste the job ad and we&apos;ll tailor an ATS-safe, SEEK-ready resume from your profile.
        </p>
      </div>
      <ResumeGate
        initial={{
          fullName: user?.appUser?.full_name ?? "",
          work_rights: profileData?.work_rights,
          phone: profileData?.phone,
          location: profileData?.location,
          linkedin_url: profileData?.linkedin_url,
          skills: profileData?.skills,
          work_experience: profileData?.work_experience,
          education: profileData?.education,
          referees: profileData?.referees,
          raw_linkedin_paste: profileData?.raw_linkedin_paste,
        }}
      />
    </div>
  );
}
