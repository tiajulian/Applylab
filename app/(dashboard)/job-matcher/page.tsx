import { Reveal } from "@/components/ui/Reveal";
import { JobMatcher } from "@/components/jobMatcher/JobMatcher";

export const metadata = { title: "Job Matcher" };

// Auth is enforced by the dashboard layout and middleware; all data loads client-side via /api.
export default function JobMatcherPage() {
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Reveal>
        <h1 className="font-display text-h2 text-ink">Job Matcher</h1>
        <p className="mt-2 text-[15px] text-ink-secondary">Find roles that match your experience and preferences.</p>
        <p className="mt-1 text-xs text-ink-muted">Fresh Australian jobs, added every morning</p>
      </Reveal>
      <JobMatcher />
    </div>
  );
}
