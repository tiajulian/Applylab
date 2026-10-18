import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { UnsavedChangesProvider } from "@/components/dashboard/UnsavedChangesProvider";
import { Logo } from "@/components/marketing/Logo";
import { ExtensionAuthBridge } from "@/components/extension/ExtensionAuthBridge";
import { NavigationProgressBar } from "@/components/ui/NavigationProgressBar";
import { TourProvider } from "@/components/tour/TourContext";
import { TourSpotlight } from "@/components/tour/TourSpotlight";
import { PaymentFailedBanner } from "@/components/dashboard/PaymentFailedBanner";
import { MobileTabBar } from "@/components/dashboard/MobileTabBar";
import { AccountGateProvider } from "@/components/auth/AccountGate";
import { getUserProfile } from "@/lib/profile/getUserProfile";
import { getProfileCompleteness, toScorableProfile } from "@/lib/profile/completeness";
import { dashboardFontVariables } from "@/lib/fonts/dashboardFonts";

export const metadata: Metadata = { title: { template: "%s | ApplyLab", default: "ApplyLab" } };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const plan = user.appUser?.plan ?? "free";
  const isAdmin = user.appUser?.is_admin ?? false;
  const isFreePlan = plan === "free";
  const showPaymentFailed = plan === "pro" && Boolean(user.appUser?.payment_failed);
  // If the profile can't be loaded, hide the sidebar % (100 = hidden) rather than show a wrong 0%.
  const profilePercent = await getUserProfile(user.authUserId)
    .then((profile) => getProfileCompleteness(toScorableProfile(profile, user.appUser?.full_name)).percent)
    .catch((error) => {
      console.error("sidebar profile completeness failed", error);
      return 100;
    });

  return (
    <TourProvider>
      <AccountGateProvider initialIsGuest={user.isAnonymous}>
        <UnsavedChangesProvider>
          <div className={`flex min-h-screen flex-col bg-paper ${dashboardFontVariables}`}>
            <NavigationProgressBar />
            <ExtensionAuthBridge />
            <TourSpotlight />
            <header className="sticky top-0 z-40 border-b border-dash-border bg-paper/90 backdrop-blur-[10px] supports-[backdrop-filter]:bg-paper/85">
              {/* Rendered height is 64px (63px row + 1px border), as in the dashboard reference; the
                  sidebar, ProfileForm, ResumeWorkspace and InterviewSetup all offset by that exact value. */}
              <div className="relative flex h-[63px] items-center justify-between px-4 sm:px-7">
                <Logo href="/dashboard" guarded />
                <DashboardNav
                  isFreePlan={isFreePlan}
                  isAdmin={isAdmin}
                  user={{
                    email: user.authEmail,
                    fullName: user.appUser?.full_name ?? undefined,
                    avatarUrl: user.avatarUrl,
                    plan,
                    isAdmin,
                  }}
                />
              </div>
            </header>
            <div className="flex w-full flex-1">
              <DashboardSidebar profilePercent={profilePercent} isFreePlan={isFreePlan} />
              <main className="w-full min-w-0 flex-1 px-4 pt-5 pb-8 sm:px-8 sm:pt-6 lg:pl-7 lg:pb-10">
                {showPaymentFailed && <PaymentFailedBanner />}
                {children}
              </main>
            </div>
            <MobileTabBar />
          </div>
        </UnsavedChangesProvider>
      </AccountGateProvider>
    </TourProvider>
  );
}
