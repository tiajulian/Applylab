import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { CompletenessMeter } from "@/components/profile/CompletenessMeter";
import type { UserProfile } from "@/types";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user!.authUserId)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Your profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          This information is reused every time we generate a resume, so the more complete it
          is, the better your results.
        </p>
      </div>
      <CompletenessMeter completeness={user?.appUser?.profile_completeness ?? 0} />
      <ProfileForm
        initialFullName={user?.appUser?.full_name ?? ""}
        initialProfile={profile as UserProfile | null}
      />
    </div>
  );
}
