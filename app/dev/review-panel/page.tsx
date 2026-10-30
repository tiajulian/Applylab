import { notFound } from "next/navigation";
import { ReviewPanelDemo } from "@/components/resume/reviewpanel/ReviewPanelDemo";

/** Dev-only preview of the review chip and panel on sample data. Not served in production. */
export default async function ReviewPanelPreviewPage({ searchParams }: { searchParams: Promise<{ guided?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <ReviewPanelDemo guided={(await searchParams).guided === "1"} />;
}
