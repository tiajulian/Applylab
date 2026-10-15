import { JobMatcher } from "@/components/jobMatcher/JobMatcher";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Find jobs" };

// Auth is enforced by the dashboard layout and middleware; all data loads client-side via /api.
export default function JobMatcherPage() {
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Find jobs"
        subtitle="Job ads from across Australia that fit your profile. New ones are added every morning."
      />
      <JobMatcher />
    </div>
  );
}
