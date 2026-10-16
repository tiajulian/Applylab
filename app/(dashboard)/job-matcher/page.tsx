import { JobMatcher } from "@/components/jobMatcher/JobMatcher";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Find jobs" };

// Auth is enforced by the dashboard layout and middleware; all data loads client-side via /api.
export default function JobMatcherPage() {
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Find jobs"
        subtitle={
          <>
            Job ads from across Australia that fit your profile, updated every morning. Choose{" "}
            <strong className="font-semibold text-ink">Tailor resume &amp; apply</strong> to get a resume written for a
            job first, or <strong className="font-semibold text-ink">Apply now</strong> to go straight to the ad.
          </>
        }
      />
      <JobMatcher />
    </div>
  );
}
