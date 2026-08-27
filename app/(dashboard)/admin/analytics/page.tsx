import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { AdminNavTabs } from "@/components/admin/AdminNavTabs";
import { AdminAnalyticsView } from "@/components/admin/AdminAnalyticsView";

export default async function AdminAnalyticsPage() {
  const user = await getCurrentUser();

  if (!user || !user.appUser?.is_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-h2 text-ink">Executive Analytics</h1>
            <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
              Founder Dashboard
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-secondary">
            Live business growth, MRR metrics, activation funnel, and AI provider unit economics.
          </p>
        </div>

        <AdminNavTabs />
      </div>

      <AdminAnalyticsView />
    </div>
  );
}
