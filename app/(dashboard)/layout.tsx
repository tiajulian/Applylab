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

  return (
    <TourProvider>
      <UnsavedChangesProvider>
        <div className="flex min-h-screen flex-col bg-paper">
          <NavigationProgressBar />
          <ExtensionAuthBridge />
          <TourSpotlight />
          <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur-[10px] supports-[backdrop-filter]:bg-paper/85">
            {/* Rendered height is 69px (py-3.5 + 40px avatar + 1px border); the sidebar, dashboard rail,
                ResumeWorkspace and InterviewSetup all offset by that exact value. */}
            <div className="relative flex items-center justify-between px-4 sm:px-8 py-3.5">
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
          <div className="flex w-full flex-1 px-4 sm:px-8">
            <DashboardSidebar isFreePlan={isFreePlan} />
            <main className="w-full min-w-0 flex-1 pl-0 lg:pl-8 pt-6 sm:pt-8 pb-8 lg:pb-12">
              {showPaymentFailed && <PaymentFailedBanner />}
              {children}
            </main>
          </div>
          <MobileTabBar />
        </div>
      </UnsavedChangesProvider>
    </TourProvider>
  );
}
