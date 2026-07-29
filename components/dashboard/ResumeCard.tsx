import Link from "next/link";
import type { Resume } from "@/types";

export function ResumeCard({ resume }: { resume: Resume }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
      <Link href={`/resume/${resume.id}`} className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-900">
          {resume.job_title || "Untitled role"}
        </span>
        <span className="text-sm text-gray-500">{resume.company_name || "—"}</span>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
          <span>{new Date(resume.created_at).toLocaleDateString("en-AU")}</span>
          <div className="flex gap-1.5">
            {resume.ats_score !== null && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                ATS {resume.ats_score}
              </span>
            )}
            {resume.content_score !== null && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                Content {resume.content_score}
              </span>
            )}
          </div>
        </div>
      </Link>
      <Link
        href={`/resume/${resume.id}/duplicate`}
        className="self-start text-xs font-medium text-brand-600 hover:underline"
      >
        Duplicate &amp; tailor
      </Link>
    </div>
  );
}
