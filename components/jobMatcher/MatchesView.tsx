"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon } from "@/components/ui/icons/LucideIcons";
import { AdzunaAttribution } from "@/components/jobMatcher/AdzunaAttribution";
import { clsx } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useSuggestions } from "@/components/ui/useSuggestions";
import { AU_LOCATIONS, CITY_STATES } from "@/lib/jobs/locations";
import { PLACES_CREDIT, usePlaceSearch } from "@/lib/places/usePlaceSearch";
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

const FILTER_CONTROL =
  "h-8 rounded-pill border border-border bg-surface text-meta text-ink transition-[border-color,background-color] duration-fast ease-editorial hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring";
// An applied filter reads as "on" at a glance, in the soft accent tint (not the solid accent).
const FILTER_ACTIVE = "border-accent/50 bg-accent-soft font-medium";

interface FilterSelectProps {
  label: string;
  value: string | number;
  active?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/** A compact pill select; its options carry their own wording ("Any salary"), so no visible label. */
function FilterSelect({ label, value, active, onChange, children, className }: FilterSelectProps) {
  return (
    <div className="relative shrink-0">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(FILTER_CONTROL, "cursor-pointer appearance-none pl-3 pr-7", active && FILTER_ACTIVE, className)}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
    </div>
  );
}

/** Page numbers to show: the first, the last, and the current page with its neighbours. */
/**
 * The Place filter, as its own component: while its suggestion list is open it re-measures on
 * every scroll, and that should re-render this input - not the whole list of job cards.
 */
function PlaceFilter({
  draft,
  onDraftChange,
  onCommit,
  active,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onCommit: (value: string) => void;
  active: boolean;
}) {
  const { suggest, load } = usePlaceSearch({ extras: AU_LOCATIONS, extraStates: CITY_STATES });
  const dropdown = useSuggestions({
    query: draft,
    suggest,
    onPick: (picked) => {
      // The filter matches the job's own location text ("Kogarah, Sydney"), so drop the state.
      const place = picked.replace(/, [A-Z]{2,3}$/, "");
      onDraftChange(place);
      onCommit(place);
    },
    footer: PLACES_CREDIT,
  });

  return (
    <form
      className="relative shrink-0"
      onSubmit={(e) => {
        e.preventDefault();
        dropdown.close();
        onCommit(draft);
      }}
    >
      <MapPinIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
      <input
        id="match-location"
        aria-label="Location"
        {...dropdown.inputProps}
        value={draft}
        onChange={(e) => {
          onDraftChange(e.target.value);
          dropdown.onType();
        }}
        onFocus={load}
        onKeyDown={dropdown.handleKeyDown}
        onBlur={() => {
          dropdown.close();
          onCommit(draft);
        }}
        placeholder="Place"
        className={clsx(FILTER_CONTROL, "w-32 pl-7 pr-3 placeholder:text-ink-muted", active && FILTER_ACTIVE)}
      />
      {dropdown.list}
    </form>
  );
}

function pageList(page: number, count: number): (number | "gap")[] {
  const pages: (number | "gap")[] = [];
  for (let p = 1; p <= count; p++) {
    if (p === 1 || p === count || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }
  return pages;
}

const PAGE_BUTTON =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-pill px-2 text-sm tabular-nums transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";
const PAGE_IDLE = "text-ink-secondary hover:bg-paper-deep hover:text-ink";

/** Mirrors JobCard's layout so nothing jumps when the matches arrive. */
function JobCardSkeleton() {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-sm border border-border bg-surface p-4 sm:grid-cols-[48px_minmax(0,1fr)_176px] sm:gap-x-4 sm:p-5">
      <Skeleton className="h-10 w-10 rounded-[10px] sm:h-12 sm:w-12" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="mt-1 h-3 w-1/2" />
        <Skeleton className="mt-1 h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
        <Skeleton className="h-12 w-12 rounded-pill" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-start-2">
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-12 rounded-pill" />
          <Skeleton className="h-5 w-16 rounded-pill" />
          <Skeleton className="h-5 w-14 rounded-pill" />
        </div>
        <Skeleton className="h-9 w-24 rounded-pill" />
      </div>
    </div>
  );
}

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
  // Kept across reloads so the search panel doesn't flicker when filters change.
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

  function commitLocation(raw = locationDraft) {
    const location = raw.trim() || null;
    if (location !== filters.location) updateFilters({ location });
  }

  function clearFilters() {
    setLocationDraft("");
    updateFilters({ ...DEFAULT_FILTERS, sort: filters.sort });
  }

  if (data && !data.hasProfile) return <QuickStart onDone={reload} onMoreOptions={onAdjust} />;

  // Sort is an ordering, not a filter, so it doesn't count towards "All" / "Clear filters".
  const hasFilters = JSON.stringify({ ...filters, sort: "score" }) !== JSON.stringify(DEFAULT_FILTERS);
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      {profile && (
        <ProfileSummaryBar
          profile={profile}
          onAdjust={onAdjust}
          onUseMyProfile={useMyProfile}
          onTitlesChanged={() => {
            setPage(1);
            reload();
          }}
        />
      )}
      {/* Narrows this list only; the search itself (roles, places, range) is the panel above. */}
      <div
        role="group"
        aria-label="Filter matches"
        className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          aria-pressed={!hasFilters}
          onClick={clearFilters}
          className={clsx(FILTER_CONTROL, "shrink-0 px-3.5", !hasFilters && FILTER_ACTIVE)}
        >
          All
        </button>
        <FilterSelect
          label="Job type"
          value={filters.contractTypes[0] ?? ""}
          active={filters.contractTypes.length > 0}
          onChange={(v) => updateFilters({ contractTypes: v ? [v as ContractType] : [] })}
        >
          <option value="">Job type</option>
          {WORK_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Posted"
          value={filters.maxAgeDays ?? ""}
          active={filters.maxAgeDays !== null}
          onChange={(v) => updateFilters({ maxAgeDays: v ? Number(v) : null })}
        >
          <option value="">Posted any time</option>
          {AGE_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d === 1 ? "Last 24 hours" : `Last ${d} days`}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Minimum salary"
          value={filters.minSalary ?? ""}
          active={filters.minSalary !== null}
          onChange={(v) => updateFilters({ minSalary: v ? Number(v) : null })}
        >
          <option value="">Any salary</option>
          {SALARY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              ${s / 1000}k+
            </option>
          ))}
        </FilterSelect>
        <PlaceFilter
          draft={locationDraft}
          onDraftChange={setLocationDraft}
          onCommit={commitLocation}
          active={Boolean(filters.location)}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 rounded-pill px-2 py-1 text-meta font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear filters
          </button>
        )}
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-ink-secondary">We couldn&apos;t load your matches. {error}</p>
          <Button variant="secondary" size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Finding jobs that match your profile">
          {[0, 1, 2].map((i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      ) : data.matches.length === 0 && data.total > 0 ? (
        // Everything on this page was dismissed; more matches remain on other pages.
        <div className="flex justify-center py-8">
          <Button variant="secondary" size="sm" onClick={() => (page > pageCount ? setPage(pageCount) : reload())}>
            Show more matches
          </Button>
        </div>
      ) : data.matches.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-border-strong px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-ink">{hasFilters ? "No roles match these filters" : "No matching roles yet"}</h2>
          <p className="max-w-md text-sm text-ink-secondary">
            {hasFilters
              ? "Try clearing a filter to see more roles."
              : "Try adding a job title, widening your range, or allowing remote work. New roles arrive every morning."}
          </p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={hasFilters ? clearFilters : onAdjust}>
            {hasFilters ? "Clear filters" : "Adjust search"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[15px] font-medium text-ink">
                <span className="tabular-nums">{data.total}</span> matching {data.total === 1 ? "role" : "roles"}
              </p>
              <AdzunaAttribution />
            </div>
            <div className="-mr-3 ml-auto">
              <FilterSelect
                label="Sort by"
                value={filters.sort}
                onChange={(v) => updateFilters({ sort: v as MatchFilters["sort"] })}
                className="border-transparent bg-transparent font-medium hover:border-border"
              >
                <option value="score">Best match</option>
                <option value="newest">Newest first</option>
              </FilterSelect>
            </div>
          </div>
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
            <nav className="flex items-center justify-center gap-1 pt-2" aria-label="Pagination">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className={clsx(PAGE_BUTTON, PAGE_IDLE)}
              >
                <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              {pageList(page, pageCount).map((p, i) =>
                p === "gap" ? (
                  <span key={`gap-${i}`} className="px-1 text-sm text-ink-muted" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    aria-label={`Page ${p}`}
                    aria-current={p === page ? "page" : undefined}
                    onClick={() => setPage(p)}
                    className={clsx(
                      PAGE_BUTTON,
                      p === page ? "border border-accent/50 bg-accent-soft font-semibold text-accent-hover" : PAGE_IDLE
                    )}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
                className={clsx(PAGE_BUTTON, PAGE_IDLE)}
              >
                <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
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
