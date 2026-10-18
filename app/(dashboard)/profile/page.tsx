import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { CompletenessMeter } from "@/components/profile/CompletenessMeter";
import { AccountDangerZone } from "@/components/profile/AccountDangerZone";
import { BillingSection } from "@/components/profile/BillingSection";
import { PageHeader } from "@/components/ui/PageHeader";
import { getProfileCompleteness, meetsMVP, toScorableProfile } from "@/lib/profile/completeness";
import type { UserProfile } from "@/types";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const supabase = createClient();

  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user!.authUserId)
    .maybeSingle();
  const profile = data as UserProfile | null;
  const fullName = user?.appUser?.full_name ?? "";

  // Worked out live (same formula the dashboard uses) rather than read from the stored
  // users.profile_completeness, which only refreshes on save and so can disagree with the dashboard.
  const scorable = toScorableProfile(profile, fullName);
  const completeness = getProfileCompleteness(scorable);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
      <PageHeader
        step={1}
        title="My profile"
        subtitle="Add your experience once. Every resume and cover letter ApplyLab writes comes from what's here, so nothing is made up."
      />
      <CompletenessMeter completeness={completeness} />
      <ProfileForm initialFullName={fullName} initialProfile={profile} initialMeetsMvp={meetsMVP(scorable)} />
      {user?.appUser?.stripe_customer_id && <BillingSection />}
      <AccountDangerZone />
    </div>
  );
}
