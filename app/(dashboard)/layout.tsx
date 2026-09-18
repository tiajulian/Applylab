import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { UnsavedChangesProvider } from "@/components/dashboard/UnsavedChangesProvider";
import { Logo } from "@/components/marketing/Logo";
import { ExtensionAuthBridge } from "@/components/extension/ExtensionAuthBridge";
import { NavigationProgressBar } from "@/components/ui/NavigationProgressBar";
import { TourProvider } from "@/components/tour/TourContext";
import { TourSpotlight } from "@/components/tour/TourSpotlight";
import { getPipelineCounts } from "@/lib/dashboard/pipeline";

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

  const supabase = createClient();
  const pipelineCounts = await getPipelineCounts(supabase, user.authUserId);

  return (
    <TourProvider>
      <UnsavedChangesProvider>
        <div className="flex min-h-screen flex-col bg-paper">
          <NavigationProgressBar />
          <ExtensionAuthBridge />
          <TourSpotlight />
          <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur-[10px] supports-[backdrop-filter]:bg-paper/85">
            <div className="flex items-center justify-between px-5 sm:px-8 py-3.5">
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
          <div className="flex w-full flex-1 px-5 sm:px-8">
            <DashboardSidebar pipelineCounts={pipelineCounts} isFreePlan={isFreePlan} />
            <main className="w-full min-w-0 flex-1 pl-0 md:pl-6 py-8">{children}</main>
          </div>
        </div>
      </UnsavedChangesProvider>
    </TourProvider>
  );
}
