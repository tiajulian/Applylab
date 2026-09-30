"use client";

import { useMemo, useState } from "react";
import { MapPinIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { useToast } from "@/components/ui/Toast";
import { useSuggestions } from "@/components/ui/useSuggestions";
import { getJobProfile, saveJobProfile, type ProfileSummary } from "@/lib/jobs/client";
import { STATES } from "@/lib/jobs/places";
import { PROFILE_LIMITS } from "@/lib/jobs/profile";
import { suggestJobTitles } from "@/lib/jobs/jobTitleCatalog";

const STATE_NAMES = new Set(Object.values(STATES));

/** "Within 50 km of Kogarah or Melbourne or anywhere in Queensland" - states have no centre point. */
function describeArea({ locations, radiusKm }: ProfileSummary): string {
  if (locations.length === 0 || radiusKm === null) return "Anywhere in Australia";
  const places = locations.filter((l) => !STATE_NAMES.has(l));
  const states = locations.filter((l) => STATE_NAMES.has(l));
  const text = [
    places.length ? `within ${radiusKm} km of ${places.join(" or ")}` : null,
    states.length ? `anywhere in ${states.join(" or ")}` : null,
  ]
    .filter(Boolean)
    .join(" or ");
  return text[0].toUpperCase() + text.slice(1);
}

interface ProfileSummaryBarProps {
  profile: ProfileSummary;
  onAdjust: () => void;
  onUseMyProfile: () => void;
  /** Called after the searched job titles were saved (matches are recomputed server-side). */
  onTitlesChanged: () => void;
}

/** The search: job titles as removable chips, a box to add one, and what else the matches use. */
export function ProfileSummaryBar({ profile, onAdjust, onUseMyProfile, onTitlesChanged }: ProfileSummaryBarProps) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState("");
  // What is being saved right now, for the status line (null when idle).
  const [pending, setPending] = useState<string | null>(null);
  const titles = profile.targetTitles;
  const full = titles.length >= PROFILE_LIMITS.targetTitles;
  const skills = profile.skillCount ? `${profile.skillCount} ${profile.skillCount === 1 ? "skill" : "skills"}` : null;

  async function saveTitles(next: string[], status: string) {
    setPending(status);
    try {
      const { profile: current } = await getJobProfile();
      await saveJobProfile({ ...current, targetTitles: next });
      setDraft("");
      onTitlesChanged();
    } catch (error) {
      showToast((error as Error).message || "Couldn't update your search. Try again.", "critical");
    } finally {
      setPending(null);
    }
  }

  function addTitle(raw = draft) {
    const title = raw.trim().replace(/\s+/g, " ");
    if (!title || pending || full) return;
    if (titles.some((t) => t.toLowerCase() === title.toLowerCase())) return setDraft("");
    void saveTitles([...titles, title], `Finding ${title} jobs…`);
  }

  const items = useMemo(() => suggestJobTitles(draft, titles), [draft, titles]);
  const dropdown = useSuggestions(items, (title) => {
    setDraft(title);
    addTitle(title);
  });

  return (
    <section aria-labelledby="your-search" className="rounded-sm border border-border bg-surface p-3 sm:p-4">
      <h2 id="your-search" className="sr-only">
        Your search
      </h2>
      <div className="flex items-center gap-2">
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            dropdown.close();
            addTitle();
          }}
        >
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            aria-label="Add a job title to search for"
            ref={dropdown.anchor}
            {...dropdown.inputProps}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              dropdown.onType();
            }}
            onKeyDown={dropdown.handleKeyDown}
            onBlur={dropdown.close}
            disabled={Boolean(pending) || full}
            maxLength={PROFILE_LIMITS.itemChars}
            enterKeyHint="search"
            placeholder={full ? `Up to ${PROFILE_LIMITS.targetTitles} job titles - remove one to add another` : "Add a job title"}
            className="h-11 w-full rounded-pill border border-border bg-paper pl-10 pr-4 text-sm text-ink transition-[border-color,box-shadow] duration-fast ease-editorial placeholder:text-ink-muted hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
          />
          {dropdown.list}
        </form>
        <button
          type="button"
          onClick={onAdjust}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-pill border border-border-strong px-4 text-sm font-medium text-ink transition-colors duration-fast ease-editorial hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontalIcon className="h-4 w-4" aria-hidden="true" />
          Adjust
        </button>
      </div>

      {titles.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Job titles">
          {titles.map((title) => (
            <li key={title} className="inline-flex items-center gap-0.5 rounded-pill border border-border bg-surface py-0.5 pl-2.5 pr-0.5 text-meta font-medium text-ink">
              {title}
              {titles.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Remove ${title}`}
                  disabled={Boolean(pending)}
                  onClick={() => void saveTitles(titles.filter((t) => t !== title), "Updating your matches…")}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                >
                  <XIcon className="h-3 w-3" aria-hidden="true" />
                </button>
              ) : (
                <span className="w-2" />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-meta font-medium text-ink">Jobs that fit your skills</p>
      )}

      <p className="mt-3 text-xs text-ink-muted" role="status">
        {pending ? (
          <span className="font-medium text-ink-secondary">{pending}</span>
        ) : (
          <>
            <MapPinIcon className="-mt-0.5 mr-1 inline-block h-3.5 w-3.5 align-middle" aria-hidden="true" />
            {[describeArea(profile), skills].filter(Boolean).join(" · ")}
            {" · "}
            {profile.isAuto ? (
              "From your profile and applications"
            ) : (
              <>
                Custom search ·{" "}
                <button
                  type="button"
                  onClick={onUseMyProfile}
                  className="rounded-sm font-medium text-ink-secondary underline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Use my profile instead
                </button>
              </>
            )}
          </>
        )}
      </p>
    </section>
  );
}
