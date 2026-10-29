import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { CoverLettersView } from "@/components/documents/DocumentsView";
import type { CoverLetterListItem } from "@/components/coverLetter/CoverLetterHub";
import type { DocumentListResume } from "@/types";

export const metadata = { title: "Cover letters" };

export default async function CoverLettersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();

  const [{ data: resumeLetters }, { data: letters }] = await Promise.all([
    // Only resumes that carry a matching letter.
    supabase
      .from("resumes")
      .select("id, job_title, company_name, created_at, ats_score, review_overall_score, review_categories, cover_letter_content")
      .eq("user_id", user.authUserId)
      .not("cover_letter_content", "is", null)
      .neq("cover_letter_content", "")
      .order("created_at", { ascending: false }),
    supabase
      .from("cover_letters")
      .select("id, title, company, word_count, updated_at")
      .eq("user_id", user.authUserId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <CoverLettersView
      letters={(letters as CoverLetterListItem[]) ?? []}
      // The query drops null/empty; this also drops whitespace-only letters.
      resumeLetters={((resumeLetters as DocumentListResume[]) ?? []).filter((resume) =>
        Boolean(resume.cover_letter_content?.trim())
      )}
    />
  );
}
