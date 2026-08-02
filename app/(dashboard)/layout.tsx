import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { Logo } from "@/components/marketing/Logo";

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
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="relative border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <DashboardNav isFreePlan={plan === "free"} isAdmin={isAdmin} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
