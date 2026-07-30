import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

// This gate is UX convenience only — every /api/admin/* route independently re-verifies
// is_admin server-side via requireAdmin() before doing anything, so this redirect is not the
// actual security boundary.
export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user || !user.appUser?.is_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
        <p className="mt-1 text-sm text-gray-500">
          Comp accounts and review usage/cost.
        </p>
      </div>
      <AdminDashboard />
    </div>
  );
}
