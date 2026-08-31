import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { AdminNavTabs } from "@/components/admin/AdminNavTabs";
import { AdminFeedbackList } from "@/components/admin/AdminFeedbackList";

export default async function AdminFeedbackPage() {
  const user = await getCurrentUser();

  if (!user || !user.appUser?.is_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-h2 text-ink">Feedback Inbox</h1>
            <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
              User Feedback
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-secondary">
            Bug reports, feature requests, and complaints submitted from inside the app.
          </p>
        </div>

        <AdminNavTabs />
      </div>

      <AdminFeedbackList />
    </div>
  );
}
