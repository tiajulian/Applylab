"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon, MapPinIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/components/ui/Toast";
import { useSuggestions } from "@/components/ui/useSuggestions";
import { TagInput } from "@/components/jobMatcher/TagInput";
import { getJobProfile, saveJobProfile, type JobProfileInput, type ProfileSummary } from "@/lib/jobs/client";
import { AU_LOCATIONS, CITY_STATES, splitPlaceList } from "@/lib/jobs/locations";
import { STATES } from "@/lib/jobs/places";
import { CONTRACT_TYPES, PROFILE_LIMITS, RADIUS_OPTIONS_KM, type ContractType } from "@/lib/jobs/profile";
import { suggestJobTitles } from "@/lib/jobs/jobTitleCatalog";
import { PLACES_CREDIT, usePlaceSearch } from "@/lib/places/usePlaceSearch";
import { CONTRACT_LABELS } from "@/lib/jobs/format";
import { clsx } from "@/lib/utils";

const STATE_NAMES = new Set(Object.values(STATES));
const PAY_OPTIONS = [60_000, 80_000, 100_000, 120_000, 150_000];
const POSTED_OPTIONS = [1, 3, 7, 14, 30];

/** "Within 50 km of Kogarah or Melbourne or anywhere in Queensland" - states have no centre point. */
export function describeArea({ locations, radiusKm }: Pick<ProfileSummary, "locations" | "radiusKm">): string {
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

const pay = (amount: number) => (amount % 1000 === 0 ? `$${amount / 1000}k+` : `$${amount.toLocaleString("en-AU")}+`);

const PILL =
  "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill border bg-surface pl-3 pr-2.5 text-[13.5px] transition-[border-color,background-color] duration-fast ease-editorial hover:border-border-strong focus-within:ring-2 focus-within:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
// A pill set away from "any" reads as on at a glance, in the soft accent tint.
const pillState = (set: boolean) => (set ? "border-accent/50 bg-accent-soft font-medium text-ink" : "border-border text-ink-secondary");

/** A native select drawn as a pill: the visible text is the current choice, so it explains itself. */
function PillSelect({
  label,
  value,
  set,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  set: boolean;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={clsx(PILL, pillState(set), "relative pr-7", disabled && "cursor-not-allowed opacity-60")}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent focus:outline-none disabled:cursor-not-allowed"
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
    </label>
  );
}

/** Where to look: places, a range around them, and remote jobs - edited together, then applied. */
function WherePanel({
  profile,
  saving,
  onApply,
  onClose,
}: {
  profile: ProfileSummary;
  saving: boolean;
  onApply: (patch: Pick<JobProfileInput, "locations" | "searchRadiusKm" | "remoteOk">) => void;
  onClose: () => void;
}) {
  const [locations, setLocations] = useState(profile.locations);
  const [radius, setRadius] = useState<number | null>(profile.radiusKm);
  const [remoteOk, setRemoteOk] = useState(profile.remoteOk);
  const places = usePlaceSearch({ extras: AU_LOCATIONS, extraStates: CITY_STATES });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointer(e: MouseEvent) {
      const target = e.target as Element;
      // Place suggestions render in a portal outside the panel; picking one isn't "clicking away",
      // and the Where pill toggles the panel itself.
      if (panelRef.current?.contains(target) || target.closest?.("[data-suggestions], [data-where-toggle]")) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Where to look"
      className="absolute inset-x-0 top-full z-30 mt-2 flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-lg sm:right-auto sm:w-[26rem]"
    >
      <TagInput
        label="Places"
        values={locations}
        onChange={setLocations}
        max={PROFILE_LIMITS.locations}
        placeholder="Suburb, city or state"
        suggest={places.suggest}
        commaAdds={false}
        split={splitPlaceList}
        onFocus={places.load}
        hint="Leave empty to search all of Australia."
      />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-secondary">How far from these places</legend>
        <div className="flex flex-wrap gap-1.5">
          {[...RADIUS_OPTIONS_KM, null].map((km) => (
            <label key={km ?? "any"} className="relative">
              <input type="radio" name="where-radius" className="peer sr-only" checked={radius === km} onChange={() => setRadius(km)} />
              <span className={clsx(PILL, "pr-3 peer-checked:border-accent/50 peer-checked:bg-accent-soft peer-checked:font-medium peer-checked:text-ink", "border-border text-ink-secondary")}>
                {km === null ? "Anywhere" : `${km} km`}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <a
        href="https://www.geonames.org"
        target="_blank"
        rel="noopener"
        className="-mt-2 self-start text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
      >
        {PLACES_CREDIT}
      </a>
      <Checkbox
        id="where-remote"
        label="Also show remote jobs anywhere in Australia"
        checked={remoteOk}
        onChange={(e) => setRemoteOk(e.target.checked)}
      />
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onClose} className="h-9 rounded-pill px-3.5 text-sm font-medium text-ink-secondary hover:bg-paper-deep hover:text-ink">
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onApply({ locations, searchRadiusKm: radius, remoteOk })}
          className="h-9 rounded-pill bg-accent-hover px-4 text-sm font-semibold text-on-accent hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? "Updating…" : "Show jobs"}
        </button>
      </div>
    </div>
  );
}

interface ProfileSummaryBarProps {
  profile: ProfileSummary;
  /** How recent the jobs must be: a view filter only, not saved with the search. */
  postedWithinDays: number | null;
  onPostedChange: (days: number | null) => void;
  /** Opens the full form (skills, seniority, background). */
  onAdjust: () => void;
  onUseMyProfile: () => void;
  /** Called after the search was saved (matches are recomputed server-side). */
  onSearchChanged: () => void;
}

/**
 * The whole search in one place: what jobs (titles), where, pay, job type and how recent. It starts
 * filled in from the user's profile; changing anything here saves it and updates the list, and
 * "Back to my profile" undoes every change at once.
 */
export function ProfileSummaryBar({
  profile,
  postedWithinDays,
  onPostedChange,
  onAdjust,
  onUseMyProfile,
  onSearchChanged,
}: ProfileSummaryBarProps) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState("");
  // What is being saved right now, for the status line (null when idle).
  const [pending, setPending] = useState<string | null>(null);
  const [whereOpen, setWhereOpen] = useState(false);
  const titles = profile.targetTitles;
  const full = titles.length >= PROFILE_LIMITS.targetTitles;

  /** Resolves true once saved, false if it failed (the toast says why). */
  async function save(patch: Partial<JobProfileInput>, status: string): Promise<boolean> {
    setPending(status);
    try {
      // Always on top of the stored search, so fields this bar doesn't show (skills...) are kept.
      const { profile: current } = await getJobProfile();
      await saveJobProfile({ ...current, ...patch });
      setDraft("");
      onSearchChanged();
      return true;
    } catch (error) {
      showToast((error as Error).message || "Couldn't update your search. Try again.", "critical");
      return false;
    } finally {
      setPending(null);
    }
  }

  function addTitle(raw = draft) {
    const title = raw.trim().replace(/\s+/g, " ");
    if (!title || pending || full) return;
    if (titles.some((t) => t.toLowerCase() === title.toLowerCase())) return setDraft("");
    void save({ targetTitles: [...titles, title] }, `Finding ${title} jobs…`);
  }

  const suggest = useCallback((query: string) => suggestJobTitles(query, titles), [titles]);
  const dropdown = useSuggestions({
    query: draft,
    suggest,
    onPick: (title) => {
      setDraft(title);
      addTitle(title);
    },
  });
  const closeWhere = useCallback(() => setWhereOpen(false), []);

  const whereIsSet = profile.locations.length > 0 && profile.radiusKm !== null;
  const where = describeArea(profile) + (whereIsSet && profile.remoteOk ? " + remote" : "");
  const types = profile.contractTypes;
  const payChoices = profile.minSalary && !PAY_OPTIONS.includes(profile.minSalary) ? [...PAY_OPTIONS, profile.minSalary].sort((a, b) => a - b) : PAY_OPTIONS;
  const busy = Boolean(pending);

  return (
    <section aria-labelledby="your-search" className="relative rounded-lg border border-border bg-surface p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="your-search" className="text-[14px] font-semibold text-ink">
          Your search
        </h2>
        <p className="text-[12.5px] text-ink-muted" role="status">
          {pending ? (
            <span className="font-medium text-ink-secondary">{pending}</span>
          ) : profile.isAuto ? (
            "Filled in from your profile. Change anything below."
          ) : (
            <>
              You&apos;ve changed this search ·{" "}
              <button
                type="button"
                onClick={onUseMyProfile}
                className="rounded-sm font-semibold text-accent-hover underline underline-offset-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back to my profile
              </button>
            </>
          )}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {titles.length > 0 && (
          <ul
            className="-mx-3 flex w-[calc(100%+1.5rem)] gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
            aria-label="Job titles"
          >
            {titles.map((title) => (
              <li key={title} className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-pill border border-border bg-paper py-0.5 pl-3 pr-0.5 text-[13px] font-medium text-ink">
                {title}
                {titles.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove ${title}`}
                    disabled={busy}
                    onClick={() => void save({ targetTitles: titles.filter((t) => t !== title) }, "Updating your matches…")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                  >
                    <XIcon className="h-3 w-3" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="w-2.5" />
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          className="relative min-w-[12rem] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            dropdown.close();
            addTitle();
          }}
        >
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            aria-label="Add a job title to search for"
            {...dropdown.inputProps}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              dropdown.open();
            }}
            onKeyDown={dropdown.handleKeyDown}
            onBlur={dropdown.close}
            disabled={busy || full}
            maxLength={PROFILE_LIMITS.itemChars}
            enterKeyHint="search"
            placeholder={full ? "Remove a title to add another" : titles.length ? "Add another job title" : "Add a job title (matching on your skills for now)"}
            className="h-8 w-full rounded-pill border border-transparent bg-transparent pl-8 pr-3 text-[13.5px] text-ink placeholder:text-ink-muted transition-colors hover:border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
          />
          {dropdown.list}
        </form>
      </div>

      <div
        role="group"
        aria-label="Search filters"
        className="-mx-3 mt-2.5 flex items-center gap-2 overflow-x-auto border-t border-border px-3 pt-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          aria-expanded={whereOpen}
          aria-label={`Where: ${where}`}
          data-where-toggle=""
          disabled={busy}
          onClick={() => setWhereOpen((open) => !open)}
          className={clsx(PILL, pillState(whereIsSet), "max-w-[18rem] disabled:cursor-not-allowed disabled:opacity-60")}
        >
          <MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{where}</span>
          <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
        </button>

        <PillSelect
          label="Pay"
          value={profile.minSalary ? String(profile.minSalary) : ""}
          set={profile.minSalary !== null}
          disabled={busy}
          onChange={(v) => void save({ minSalary: v ? Number(v) : null }, "Updating your matches…")}
        >
          <option value="">Any pay</option>
          {payChoices.map((amount) => (
            <option key={amount} value={amount}>
              {pay(amount)} a year
            </option>
          ))}
        </PillSelect>

        <PillSelect
          label="Job type"
          value={types.length === 1 ? types[0] : types.length > 1 ? "several" : ""}
          set={types.length > 0}
          disabled={busy}
          onChange={(v) => {
            if (v === "several") return;
            void save({ contractTypes: v ? [v as ContractType] : [] }, "Updating your matches…");
          }}
        >
          <option value="">Any job type</option>
          {CONTRACT_TYPES.map((type) => (
            <option key={type} value={type}>
              {CONTRACT_LABELS[type]}
            </option>
          ))}
          {types.length > 1 && (
            <option value="several" disabled>
              {types.map((t) => CONTRACT_LABELS[t]).join(", ")}
            </option>
          )}
        </PillSelect>

        <PillSelect
          label="Posted"
          value={postedWithinDays ? String(postedWithinDays) : ""}
          set={postedWithinDays !== null}
          onChange={(v) => onPostedChange(v ? Number(v) : null)}
        >
          <option value="">Posted any time</option>
          {POSTED_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d === 1 ? "Posted in the last day" : `Posted in the last ${d} days`}
            </option>
          ))}
        </PillSelect>

        <button
          type="button"
          onClick={onAdjust}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-2.5 text-[13.5px] font-medium text-ink-secondary hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontalIcon className="h-3.5 w-3.5" aria-hidden="true" />
          More options
        </button>
      </div>

      {whereOpen && (
        <WherePanel
          profile={profile}
          onClose={closeWhere}
          saving={busy}
          onApply={async (patch) => {
            if (await save(patch, "Updating your matches…")) setWhereOpen(false);
          }}
        />
      )}
    </section>
  );
}
