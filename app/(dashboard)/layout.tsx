import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { LogoutButton } from "@/components/ui/LogoutButton";

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

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
            applylab
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/profile" className="text-gray-600 hover:text-gray-900">
              Profile
            </Link>
            {plan === "free" && (
              <Link
                href="/upgrade"
                className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700 hover:bg-brand-100"
              >
                Upgrade
              </Link>
            )}
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
