import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { CoverLetterHub, type CoverLetterListItem } from "@/components/coverLetter/CoverLetterHub";
import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/ui/Reveal";

export const dynamic = "force-dynamic";

export default async function CoverLettersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data } = await createClient()
    .from("cover_letters")
    .select("id, title, company, created_via, word_count, updated_at")
    .eq("user_id", user.authUserId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <PageHeader title="Cover letters" subtitle="Write, edit and keep a cover letter for every role." />
      </Reveal>
      <CoverLetterHub letters={(data as CoverLetterListItem[]) ?? []} />
    </div>
  );
}
