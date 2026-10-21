import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ResumesView } from "@/components/documents/DocumentsView";
import { FREE_RESUME_LIMIT } from "@/lib/requireUser";
import type { DocumentListResume } from "@/types";

export const metadata = { title: "Resumes" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: { view?: string; new?: string };
}) {
  // Cover letters used to be a tab here; old links and bookmarks land on their own page.
  if (searchParams?.view === "cover-letters") {
    redirect(searchParams.new === "1" ? "/cover-letter?new=1" : "/cover-letter");
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();

  const { data: resumes } = await supabase
    .from("resumes")
    .select("id, job_title, company_name, created_at, ats_score, review_overall_score, cover_letter_content")
    .eq("user_id", user.authUserId)
    .order("created_at", { ascending: false });

  const plan = user.appUser?.plan ?? "free";
  const resumesUsed = user.appUser?.resumes_used ?? 0;
  const remaining = Math.max(0, FREE_RESUME_LIMIT - resumesUsed);
  const limitReached = plan === "free" && resumesUsed >= FREE_RESUME_LIMIT;

  return (
    <ResumesView
      resumes={(resumes as DocumentListResume[]) ?? []}
      plan={plan}
      remaining={remaining}
      freeLimit={FREE_RESUME_LIMIT}
      limitReached={limitReached}
    />
  );
}
