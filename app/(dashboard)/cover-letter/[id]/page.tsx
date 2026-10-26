import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/jobs/api";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { CoverLetterEditor } from "@/components/coverLetter/CoverLetterEditor";
import { parseContent } from "@/lib/coverLetter/content";
import { canUseFeature } from "@/lib/coverLetter/entitlements";
import { canExportResume } from "@/lib/requireUser";

export const metadata = { title: "Cover letter" };

export const dynamic = "force-dynamic";

export default async function CoverLetterPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isUuid(params.id)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  const { data: letter } = await supabase
    .from("cover_letters")
    .select("id, title, company, content, updated_at, resume_id")
    .eq("id", params.id)
    .eq("user_id", user.authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!letter) notFound();

  const content = parseContent(letter.content);
  // A cover letter made from a resume is downloadable whenever that resume is (pricing brief 6.3).
  const canExport =
    canUseFeature(user.appUser?.plan ?? "free", "coverLetter.export") ||
    Boolean(letter.resume_id && user.appUser && (await canExportResume(supabase, user.appUser, letter.resume_id).catch(() => false)));

  return (
    <CoverLetterEditor
      id={letter.id}
      initialTitle={letter.title}
      initialBody={content.body}
      initialUpdatedAt={letter.updated_at}
      contact={content.contact}
      company={letter.company}
      canExport={canExport}
    />
  );
}
