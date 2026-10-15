import { redirect } from "next/navigation";

// Cover letters now live with resumes on one page (Resumes & letters), so old links land there.
export default function CoverLettersPage() {
  redirect("/documents?view=cover-letters");
}
