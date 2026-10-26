import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/marketing/Logo";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { AccountGateProvider } from "@/components/auth/AccountGate";
import { Reveal } from "@/components/ui/Reveal";
import type { UserProfile } from "@/types";
import { BRAND } from "@/lib/marketing/copy";

export const metadata = { title: "Build your profile" };

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
    <main className="min-h-screen bg-paper px-4 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        {/* A way home, and to sign in for someone who already has an account. */}
        <header className="flex items-center justify-between">
          <Logo href="/" />
          {(!user || user.isAnonymous) && (
            <Link href="/login" className="text-sm font-medium text-ink-secondary hover:text-ink">
              Already have an account? Log in
            </Link>
          )}
        </header>
        <Reveal className="text-center">
          <h1 className="font-display text-display text-ink">Let&apos;s build your profile</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {BRAND.oneLiner}
          </p>
        </Reveal>
        <AccountGateProvider initialIsGuest={Boolean(user?.isAnonymous)}>
          <OnboardingWizard
            initialFullName={user?.appUser?.full_name ?? ""}
            initialProfile={profile as UserProfile | null}
          />
        </AccountGateProvider>
      </div>
    </main>
  );
}
