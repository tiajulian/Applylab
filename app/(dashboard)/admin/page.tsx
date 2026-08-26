import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user || !user.appUser?.is_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-h2 text-ink">Admin Workspace</h1>
            <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
              Internal Tool
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-secondary">
            Manage user accounts, comp plans, and monitor Anthropic / Gemini API token usage & costs.
          </p>
        </div>
      </div>
      <AdminDashboard />
    </div>
  );
}
