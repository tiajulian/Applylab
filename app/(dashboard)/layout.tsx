import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { Logo } from "@/components/marketing/Logo";
import { ExtensionAuthBridge } from "@/components/extension/ExtensionAuthBridge";
import { NavigationProgressBar } from "@/components/ui/NavigationProgressBar";
import { TourProvider } from "@/components/tour/TourContext";
import { TourSpotlight } from "@/components/tour/TourSpotlight";

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

  return (
    <TourProvider>
      <div className="flex min-h-screen flex-col bg-paper">
        <NavigationProgressBar />
        <ExtensionAuthBridge />
        <TourSpotlight />
        <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur-[10px] supports-[backdrop-filter]:bg-paper/85">
          <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 sm:px-8 py-3.5">
            <Logo />
            <DashboardNav
              isFreePlan={plan === "free"}
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
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 sm:px-8 py-8">{children}</main>
      </div>
    </TourProvider>
  );
}
