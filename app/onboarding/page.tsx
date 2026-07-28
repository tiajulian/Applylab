import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import type { UserProfile } from "@/types";

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.appUser?.onboarded) {
    redirect("/dashboard");
  }

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.authUserId)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Let&apos;s build your profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            This takes about 2 minutes and powers every resume we generate for you.
          </p>
        </div>
        <OnboardingWizard
          initialFullName={user.appUser?.full_name ?? ""}
          initialProfile={profile as UserProfile | null}
        />
      </div>
    </main>
  );
}
