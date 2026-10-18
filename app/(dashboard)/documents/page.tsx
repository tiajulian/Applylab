import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { DocumentsView } from "@/components/documents/DocumentsView";
import type { CoverLetterListItem } from "@/components/coverLetter/CoverLetterHub";
import { FREE_RESUME_LIMIT } from "@/lib/requireUser";
import type { DocumentListResume } from "@/types";

export const metadata = { title: "Resumes & letters" };

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

  const [{ data: resumes }, { data: letters }] = await Promise.all([
    supabase
      .from("resumes")
      .select(
        "id, job_title, company_name, created_at, ats_score, review_overall_score, cover_letter_content"
      )
      .eq("user_id", user.authUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("cover_letters")
      .select("id, title, company, word_count, updated_at")
      .eq("user_id", user.authUserId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
  ]);

  const plan = user.appUser?.plan ?? "free";
  const resumesUsed = user.appUser?.resumes_used ?? 0;
  const remaining = Math.max(0, FREE_RESUME_LIMIT - resumesUsed);
  const limitReached = plan === "free" && resumesUsed >= FREE_RESUME_LIMIT;

  return (
    <DocumentsView
      resumes={(resumes as DocumentListResume[]) ?? []}
      letters={(letters as CoverLetterListItem[]) ?? []}
      plan={plan}
      remaining={remaining}
      freeLimit={FREE_RESUME_LIMIT}
      limitReached={limitReached}
      initialView={searchParams?.view === "cover-letters" ? "cover-letters" : "resumes"}
    />
  );
}
