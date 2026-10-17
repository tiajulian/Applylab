import { createServiceRoleClient } from "@/lib/supabase/server";
import { getMatchesPage } from "@/lib/jobs/service";
import { daysSince, postedLabel } from "@/lib/jobs/format";
import type { HomeJob } from "@/components/dashboard/home/HomeSections";

const HOME_JOB_COUNT = 3;
/** "New" jobs: posted within the last fortnight. */
const HOME_JOB_MAX_AGE_DAYS = 14;

/**
 * The top Find jobs matches for the home page, read from the match cache Find jobs already keeps.
 * Read-only on purpose: building a profile or re-ranking costs an embedding call, so that stays on
 * the Find jobs page. No job profile or no cached matches yet means no section (never sample jobs).
 */
export async function getHomeJobs(userId: string): Promise<HomeJob[]> {
  try {
    // No job profile means no cached matches, so this simply comes back empty.
    const { matches } = await getMatchesPage(createServiceRoleClient(), userId, {
      page: 1,
      limit: HOME_JOB_COUNT,
      sort: "score",
      location: null,
      minSalary: null,
      contractTypes: [],
      maxAgeDays: HOME_JOB_MAX_AGE_DAYS,
    });
    const now = Date.now();
    return matches.map(({ job }) => {
      const days = daysSince(job.postedAt, now);
      const company = job.company?.trim() || "";
      return {
        id: job.id,
        title: job.title,
        initial: (company || job.title).charAt(0).toUpperCase(),
        meta: [company, job.location, days === null ? "" : postedLabel(days)].filter(Boolean).join(" · "),
      };
    });
  } catch (error) {
    console.error("home-jobs error", error);
    return [];
  }
}
