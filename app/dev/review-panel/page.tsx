import { notFound } from "next/navigation";
import { ReviewPanelDemo } from "@/components/resume/reviewpanel/ReviewPanelDemo";

/** Dev-only preview of the review chip and panel on sample data. Not served in production. */
export default function ReviewPanelPreviewPage({ searchParams }: { searchParams: { pro?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <ReviewPanelDemo isPaidPlan={searchParams.pro === "1"} />;
}
