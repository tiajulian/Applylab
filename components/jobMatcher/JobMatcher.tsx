"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { JobProfileForm } from "@/components/jobMatcher/JobProfileForm";
import { MatchesView } from "@/components/jobMatcher/MatchesView";
import { SavedJobsView } from "@/components/jobMatcher/SavedJobsView";
import { getJobProfile, type JobProfileInput } from "@/lib/jobs/client";
import { clsx } from "@/lib/utils";

type Tab = "matches" | "saved" | "profile";

const TABS: [Tab, string][] = [
  ["matches", "Matches"],
  ["saved", "Saved"],
  ["profile", "Profile"],
];

export function JobMatcher() {
  const [profile, setProfile] = useState<{ value: JobProfileInput; exists: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("matches");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getJobProfile().then(
      ({ profile: value, exists }) => !cancelled && setProfile({ value, exists }),
      (err: Error) => !cancelled && setError(err.message)
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center">
        <p className="text-sm text-ink-secondary">We couldn&apos;t load the Job Matcher. {error}</p>
        <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  if (!profile) return <Skeleton className="h-96 rounded-lg" />;

  const onSaved = () => {
    // Refetch so the form and matches reflect the saved profile, then show the new matches.
    setProfile(null);
    setReloadKey((k) => k + 1);
    setTab("matches");
  };

  // First visit: the profile form is the whole page until there is something to match against.
  if (!profile.exists) return <JobProfileForm initial={profile.value} onSaved={onSaved} />;

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
        {tab === "matches" && <MatchesView onEditProfile={() => setTab("profile")} />}
        {tab === "saved" && <SavedJobsView />}
        {tab === "profile" && <JobProfileForm initial={profile.value} onSaved={onSaved} onCancel={() => setTab("matches")} />}
      </div>
    </div>
  );
}
