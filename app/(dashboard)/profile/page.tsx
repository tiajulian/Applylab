import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { CompletenessMeter } from "@/components/profile/CompletenessMeter";
import { AccountDangerZone } from "@/components/profile/AccountDangerZone";
import { Reveal } from "@/components/ui/Reveal";
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
      <Reveal>
        <h1 className="font-display text-display text-ink">Your profile</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          This information is reused every time we generate a resume, so the more complete it
          is, the better your results.
        </p>
      </Reveal>
      <Reveal delay={0.06}>
        <CompletenessMeter completeness={user?.appUser?.profile_completeness ?? 0} />
      </Reveal>
      <Reveal delay={0.1}>
        <ProfileForm
          initialFullName={user?.appUser?.full_name ?? ""}
          initialProfile={profile as UserProfile | null}
        />
      </Reveal>
      <Reveal delay={0.14}>
        <AccountDangerZone />
      </Reveal>
    </div>
  );
}
