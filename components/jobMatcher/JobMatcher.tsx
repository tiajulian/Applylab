"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { JobProfileForm } from "@/components/jobMatcher/JobProfileForm";
import { MatchesView } from "@/components/jobMatcher/MatchesView";
import { SavedJobsView } from "@/components/jobMatcher/SavedJobsView";
import { getJobProfile, type JobProfileInput } from "@/lib/jobs/client";
import { clsx } from "@/lib/utils";

type Tab = "matches" | "saved";

const TABS: [Tab, string][] = [
  ["matches", "Matches"],
  ["saved", "Saved"],
];

/** Matches show straight away (the profile is built from the user's own data); "Adjust" opens the form. */
export function JobMatcher() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("matches");
  // null = not adjusting; "loading" while the current profile is fetched for the form.
  const [adjusting, setAdjusting] = useState<JobProfileInput | "loading" | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);

  async function startAdjusting() {
    setAdjusting("loading");
    try {
      setAdjusting((await getJobProfile()).profile);
    } catch {
      setAdjusting(null);
      showToast("Couldn't load your preferences. Try again.", "critical");
    }
  }

  function onSaved() {
    setAdjusting(null);
    setTab("matches");
    setProfileVersion((v) => v + 1);
  }

  if (adjusting === "loading") return <Skeleton className="h-96 rounded-lg" />;
  if (adjusting) return <JobProfileForm initial={adjusting} onSaved={onSaved} onCancel={() => setAdjusting(null)} />;

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Job Matcher" className="flex gap-1 self-start rounded-pill bg-paper-deep p-1">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={clsx(
              "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === id ? "bg-surface text-ink shadow-sm" : "text-ink-secondary hover:text-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "matches" ? <MatchesView onAdjust={startAdjusting} profileVersion={profileVersion} /> : <SavedJobsView />}
      </div>
    </div>
  );
}
