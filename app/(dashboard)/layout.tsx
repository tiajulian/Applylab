import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

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
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="relative border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
            applylab
          </Link>
          <DashboardNav isFreePlan={plan === "free"} isAdmin={isAdmin} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
