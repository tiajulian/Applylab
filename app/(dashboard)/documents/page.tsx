import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { DocumentsView } from "@/components/documents/DocumentsView";
import type { Resume } from "@/types";

const FREE_RESUME_LIMIT = 2;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: { view?: "resumes" | "cover-letters" };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();

  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.authUserId)
    .order("created_at", { ascending: false });

  const plan = user.appUser?.plan ?? "free";
  const resumesUsed = user.appUser?.resumes_used ?? 0;
  const remaining = Math.max(0, FREE_RESUME_LIMIT - resumesUsed);
  const limitReached = plan === "free" && resumesUsed >= FREE_RESUME_LIMIT;

  return (
    <DocumentsView
      resumes={(resumes as Resume[]) ?? []}
      plan={plan}
      remaining={remaining}
      freeLimit={FREE_RESUME_LIMIT}
      limitReached={limitReached}
      initialView={searchParams?.view === "cover-letters" ? "cover-letters" : "resumes"}
    />
  );
}
