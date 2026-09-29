"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { JobCard } from "@/components/jobMatcher/JobCard";
import { ProfileSummaryBar } from "@/components/jobMatcher/ProfileSummaryBar";
import { QuickStart } from "@/components/jobMatcher/QuickStart";
import {
  addInteraction,
  getMatches,
  removeInteraction,
  resetJobProfile,
  type MatchesResponse,
  type MatchFilters,
  type MatchItem,
  type ProfileSummary,
} from "@/lib/jobs/client";
import type { ContractType } from "@/lib/jobs/profile";

const PAGE_SIZE = 20;
const UNDO_MS = 6000;

const DEFAULT_FILTERS: MatchFilters = { sort: "score", location: null, minSalary: null, contractTypes: [], maxAgeDays: null };

const SALARY_OPTIONS = [60_000, 80_000, 100_000, 120_000, 150_000];
const AGE_OPTIONS = [1, 3, 7, 14, 30];
const WORK_TYPES: [ContractType, string][] = [
  ["full_time", "Full-time"],
  ["part_time", "Part-time"],
  ["permanent", "Permanent"],
  ["contract", "Contract"],
];

interface Dismissed {
  item: MatchItem;
  index: number;
  /** Resolves true once the server has recorded the dismissal, false if it failed. */
  request: Promise<boolean>;
  undone: boolean;
}

interface MatchesViewProps {
  onAdjust: () => void;
  /** Bumped by the parent after the profile changes, to refetch. */
  profileVersion?: number;
}

export function MatchesView({ onAdjust, profileVersion = 0 }: MatchesViewProps) {
  const { showToast } = useToast();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [locationDraft, setLocationDraft] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MatchesResponse | null>(null);
  // Kept across reloads so the "Matching you for" bar doesn't flicker when filters change.
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The latest dismissal lives in a ref (its request/undone flags are read after awaits); the state
  // only drives whether the Undo bar shows.
  const lastDismissed = useRef<Dismissed | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    getMatches(page, PAGE_SIZE, filters).then(
      (response) => {
        if (cancelled) return;
        setData(response);
        setProfile(response.profile);
      },
      (err: Error) => !cancelled && setError(err.message)
    );
    return () => {
      cancelled = true;
    };
  }, [page, filters, reloadKey, profileVersion]);

  const reload = () => setReloadKey((k) => k + 1);

  async function useMyProfile() {
    try {
      await resetJobProfile();
      setPage(1);
      reload();
    } catch {
      showToast("Couldn't switch back to your profile. Try again.", "critical");
    }
  }

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const updateFilters = (patch: Partial<MatchFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const updateMatches = useCallback((update: (matches: MatchItem[]) => MatchItem[], totalDelta = 0) => {
    setData((current) => current && { ...current, matches: update(current.matches), total: current.total + totalDelta });
  }, []);

  async function toggleSave(item: MatchItem) {
    const flip = (saved: boolean) => updateMatches((ms) => ms.map((m) => (m.job.id === item.job.id ? { ...m, saved } : m)));
    flip(!item.saved);
    try {
      await (item.saved ? removeInteraction(item.job.id, "saved") : addInteraction(item.job.id, "saved"));
    } catch {
      flip(item.saved);
      showToast("Couldn't update saved jobs. Try again.", "critical");
    }
  }

  function hideUndo() {
    clearTimeout(undoTimer.current);
    setShowUndo(false);
  }

  /** Puts a dismissed card back exactly once, whether via Undo or a failed dismiss request. */
  function restore(entry: Dismissed) {
    if (entry.undone) return;
    entry.undone = true;
    if (lastDismissed.current === entry) hideUndo();
    updateMatches((ms) => [...ms.slice(0, entry.index), entry.item, ...ms.slice(entry.index)], 1);
  }

  async function dismiss(item: MatchItem, index: number) {
    updateMatches((ms) => ms.filter((m) => m.job.id !== item.job.id), -1);
    const entry: Dismissed = {
      item,
      index,
      request: addInteraction(item.job.id, "dismissed").then(() => true, () => false),
      undone: false,
    };
    lastDismissed.current = entry;
    clearTimeout(undoTimer.current);
    setShowUndo(true);
    undoTimer.current = setTimeout(() => setShowUndo(false), UNDO_MS);

    if (!(await entry.request) && !entry.undone) {
      restore(entry);
      showToast("Couldn't dismiss that job. Try again.", "critical");
    }
  }

  async function undoDismiss() {
    const entry = lastDismissed.current;
    if (!entry || entry.undone) return;
    restore(entry);
    // Only undo on the server once the dismissal has actually been recorded there.
    if (!(await entry.request)) return;
    try {
      await removeInteraction(entry.item.job.id, "dismissed");
    } catch {
      reload();
      showToast("Couldn't undo. Try again.", "critical");
    }
  }

  function commitLocation() {
    const location = locationDraft.trim() || null;
    if (location !== filters.location) updateFilters({ location });
  }

  if (data && !data.hasProfile) return <QuickStart onDone={reload} onMoreOptions={onAdjust} />;

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-5">
      {profile && <ProfileSummaryBar profile={profile} onAdjust={onAdjust} onUseMyProfile={useMyProfile} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5" role="group" aria-label="Filter matches">
        <form
          className="col-span-2 md:col-span-1"
          onSubmit={(e) => {
            e.preventDefault();
            commitLocation();
          }}
        >
          <label htmlFor="match-location" className="mb-1.5 block text-sm font-medium text-ink-secondary">
            Location
          </label>
          <input
            id="match-location"
            value={locationDraft}
            onChange={(e) => setLocationDraft(e.target.value)}
            onBlur={commitLocation}
            placeholder="Any"
            className="w-full rounded border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </form>
        <Select
          id="match-salary"
          label="Min salary"
          value={filters.minSalary ?? ""}
          onChange={(e) => updateFilters({ minSalary: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Any</option>
          {SALARY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              ${s / 1000}k+
            </option>
          ))}
        </Select>
        <Select
          id="match-work-type"
          label="Work type"
          value={filters.contractTypes[0] ?? ""}
          onChange={(e) => updateFilters({ contractTypes: e.target.value ? [e.target.value as ContractType] : [] })}
        >
          <option value="">Any</option>
          {WORK_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          id="match-age"
          label="Posted"
          value={filters.maxAgeDays ?? ""}
          onChange={(e) => updateFilters({ maxAgeDays: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Any time</option>
          {AGE_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d === 1 ? "Last 24 hours" : `Last ${d} days`}
            </option>
          ))}
        </Select>
        <Select
          id="match-sort"
          label="Sort by"
          value={filters.sort}
          onChange={(e) => updateFilters({ sort: e.target.value as MatchFilters["sort"] })}
        >
          <option value="score">Best match</option>
          <option value="newest">Newest</option>
        </Select>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-ink-secondary">We couldn&apos;t load your matches. {error}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Finding jobs that match your profile">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : data.matches.length === 0 && data.total > 0 ? (
        // Everything on this page was dismissed; more matches remain on other pages.
        <div className="flex justify-center py-8">
          <Button
            variant="secondary"
            onClick={() => (page > pageCount ? setPage(pageCount) : reload())}
          >
            Show more matches
          </Button>
        </div>
      ) : data.matches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
          <h2 className="text-h3 font-semibold text-ink">{hasFilters ? "No matches for these filters" : "No matches yet"}</h2>
          <p className="max-w-md text-sm text-ink-secondary">
            {hasFilters
              ? "Try clearing a filter to see more jobs."
              : "Try widening your search: add locations, allow remote work, or lower your minimum salary. New jobs arrive every morning."}
          </p>
          {hasFilters ? (
            <Button
              variant="secondary"
              onClick={() => {
                setLocationDraft("");
                updateFilters(DEFAULT_FILTERS);
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Button variant="secondary" onClick={onAdjust}>
              Adjust search
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-meta text-ink-muted">
            {data.total} {data.total === 1 ? "match" : "matches"}
          </p>
          <ul className="flex flex-col gap-3">
            {data.matches.map((item, index) => (
              <li key={item.job.id}>
                <JobCard
                  job={item.job}
                  score={item.score}
                  reasons={item.reasons}
                  saved={item.saved}
                  onToggleSave={() => toggleSave(item)}
                  onDismiss={() => dismiss(item, index)}
                  onApply={() => void addInteraction(item.job.id, "applied_click").catch(() => {})}
                />
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-ink-secondary">
                Page {page} of {pageCount}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </nav>
          )}
        </>
      )}

      {showUndo && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-pill bg-ink px-4 py-2 text-sm text-paper shadow-pop"
        >
          Job dismissed
          <button
            type="button"
            onClick={undoDismiss}
            className="rounded-pill px-2 py-0.5 font-semibold text-accent-soft underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
