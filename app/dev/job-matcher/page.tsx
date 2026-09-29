import { notFound } from "next/navigation";
import { JobMatcherDemo } from "@/components/jobMatcher/JobMatcherDemo";

/** Dev-only preview of Job Matcher on sample data. Not served in production. */
export default function JobMatcherPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <JobMatcherDemo />;
}
