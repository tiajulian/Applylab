import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/ui/Reveal";
import { JobMatcher } from "@/components/jobMatcher/JobMatcher";

export const metadata = { title: "Job Matcher" };

// Auth is enforced by the dashboard layout and middleware; all data loads client-side via /api.
export default function JobMatcherPage() {
  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <PageHeader title="Job Matcher" subtitle="Fresh Australian jobs matched to your profile, updated every morning." />
      </Reveal>
      <JobMatcher />
    </div>
  );
}
