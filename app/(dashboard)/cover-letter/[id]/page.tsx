import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { CoverLetterEditor } from "@/components/coverLetter/CoverLetterEditor";
import { COVER_LETTER_V1_ENABLED } from "@/lib/coverLetter/config";
import { parseContent } from "@/lib/coverLetter/content";

export const dynamic = "force-dynamic";

export default async function CoverLetterPage({ params }: { params: { id: string } }) {
  if (!COVER_LETTER_V1_ENABLED) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data: letter } = await createClient()
    .from("cover_letters")
    .select("id, title, company, content, updated_at")
    .eq("id", params.id)
    .eq("user_id", user.authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!letter) notFound();

  const content = parseContent(letter.content);

  return (
    <CoverLetterEditor
      id={letter.id}
      initialTitle={letter.title}
      initialBody={content.body}
      initialUpdatedAt={letter.updated_at}
      contact={content.contact}
      company={letter.company}
    />
  );
}
