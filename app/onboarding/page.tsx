import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Reveal } from "@/components/ui/Reveal";
import type { UserProfile } from "@/types";

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (user && !user.isAnonymous && user.appUser?.onboarded) {
    redirect("/dashboard");
  }

  const supabase = createClient();
  const profile = user
    ? (
        await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", user.authUserId)
          .maybeSingle()
      ).data
    : null;

  return (
    <main className="min-h-screen bg-paper px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <Reveal className="text-center">
          <h1 className="font-display text-display text-ink">Let&apos;s build your profile</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            This takes about 2 minutes and powers every resume we generate for you.
          </p>
        </Reveal>
        <OnboardingWizard
          initialFullName={user?.appUser?.full_name ?? ""}
          initialProfile={profile as UserProfile | null}
        />
      </div>
    </main>
  );
}
