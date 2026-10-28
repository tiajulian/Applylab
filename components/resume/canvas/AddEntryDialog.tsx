"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { CatalogInput } from "@/components/ui/CatalogInput";
import { JobTitleInput } from "@/components/profile/JobTitleInput";
import { LocationInput } from "@/components/profile/LocationInput";
import { MonthYearField } from "@/components/profile/MonthYearField";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";
import { CanvasSheet } from "@/components/resume/canvas/CanvasSheet";
import { COMPANY_CATALOG } from "@/lib/catalogs/companies";
import { DEGREE_CATALOG, INSTITUTION_CATALOG } from "@/lib/catalogs/education";
import { trackFunnelEvent } from "@/lib/analytics";
import { clsx } from "@/lib/utils";
import {
  EMPTY_PROFILE_ENTRY,
  PROFILE_SECTION_FOR,
  profileEntryKey,
  resumeEntryKeys,
  type AddSection,
  type ProfileEntryFor,
  type ProfileLibrary,
} from "@/lib/resume/addEntries";
import type { EducationEntry, ProjectEntry, RefereeEntry, ResumeContent, WorkExperienceEntry } from "@/types";

interface FieldsProps<T> {
  draft: T;
  set: (patch: Partial<T>) => void;
  firstFieldRef: Ref<HTMLInputElement>;
}

/** Everything that differs between the four sections; the dialog around it is shared, so adding a
 * role, project, qualification or referee always looks and works the same way. */
interface SectionSpec<T> {
  title: string;
  noun: string;
  nounPlural: string;
  newTab: string;
  missingTitle: string;
  empty: () => T;
  /** Has the one field the entry can't do without (only that one is required). */
  ready: (draft: T) => boolean;
  describe: (item: T) => { primary: string; secondary: string };
  Fields: (props: FieldsProps<T>) => ReactNode;
}

const dateRange = (start: string, end: string, isCurrent: boolean, currentLabel: string) =>
  [start, isCurrent ? currentLabel : end].filter(Boolean).join(" - ");
const joinDot = (...parts: string[]) => parts.filter((part) => part.trim()).join(" · ");

/** Optional fields, folded away so the form starts short. */
function MoreDetails({ children }: { children: ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer select-none rounded-sm text-sm font-medium text-ink-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        More details <span className="text-ink-muted">(optional)</span>
      </summary>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </details>
  );
}

const EXPERIENCE: SectionSpec<WorkExperienceEntry> = {
  title: "Add a role",
  noun: "role",
  nounPlural: "roles",
  newTab: "New role",
  missingTitle: "Add a job title first.",
  empty: EMPTY_PROFILE_ENTRY.experience,
  ready: (d) => d.job_title.trim().length > 0,
  describe: (d) => ({ primary: d.job_title, secondary: joinDot(d.company, dateRange(d.start_date, d.end_date, d.is_current, "Present")) }),
  Fields: ({ draft, set, firstFieldRef }) => (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <JobTitleInput ref={firstFieldRef} label="Job title" value={draft.job_title} onValueChange={(job_title) => set({ job_title })} />
        <CatalogInput label="Company" catalog={COMPANY_CATALOG} value={draft.company} onValueChange={(company) => set({ company })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MonthYearField label="Start date" value={draft.start_date} onChange={(start_date) => set({ start_date })} />
        <MonthYearField label="End date" value={draft.end_date} disabled={draft.is_current} disabledLabel="Present" onChange={(end_date) => set({ end_date })} />
      </div>
      <Checkbox
        id="add-entry-current-role"
        label="I currently work here"
        checked={draft.is_current}
        onChange={(e) => set({ is_current: e.target.checked, end_date: e.target.checked ? "" : draft.end_date })}
      />
      <MoreDetails>
        <LocationInput label="Location" value={draft.location} onValueChange={(location) => set({ location })} />
      </MoreDetails>
    </>
  ),
};

const PROJECTS: SectionSpec<ProjectEntry> = {
  title: "Add a project",
  noun: "project",
  nounPlural: "projects",
  newTab: "New project",
  missingTitle: "Add the project name first.",
  empty: EMPTY_PROFILE_ENTRY.projects,
  ready: (d) => d.title.trim().length > 0,
  describe: (d) => ({ primary: d.title, secondary: joinDot(d.context, d.timeframe) }),
  Fields: ({ draft, set, firstFieldRef }) => (
    <>
      <Input ref={firstFieldRef} label="Project name" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
      <Input
        label="What kind of project"
        placeholder="e.g. Personal project, Volunteer, Uni assignment"
        value={draft.context}
        onChange={(e) => set({ context: e.target.value })}
      />
      <Input label="When" placeholder="e.g. 2024" value={draft.timeframe} onChange={(e) => set({ timeframe: e.target.value })} />
    </>
  ),
};

const EDUCATION: SectionSpec<EducationEntry> = {
  title: "Add a qualification",
  noun: "qualification",
  nounPlural: "qualifications",
  newTab: "New qualification",
  missingTitle: "Add the qualification name first.",
  empty: EMPTY_PROFILE_ENTRY.education,
  ready: (d) => d.degree.trim().length > 0,
  describe: (d) => ({ primary: d.degree, secondary: joinDot(d.institution, dateRange(d.start_date, d.end_date, d.is_current, "Present")) }),
  Fields: ({ draft, set, firstFieldRef }) => (
    <>
      <CatalogInput ref={firstFieldRef} label="Qualification" catalog={DEGREE_CATALOG} value={draft.degree} onValueChange={(degree) => set({ degree })} />
      <CatalogInput label="Institution" catalog={INSTITUTION_CATALOG} value={draft.institution} onValueChange={(institution) => set({ institution })} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MonthYearField label="Start date" value={draft.start_date} onChange={(start_date) => set({ start_date })} />
        <MonthYearField
          label="Finish date"
          value={draft.end_date}
          disabled={draft.is_current}
          disabledLabel="Still studying"
          allowNextYear
          onChange={(end_date) => set({ end_date })}
        />
      </div>
      <Checkbox
        id="add-entry-still-studying"
        label="I'm still studying this"
        checked={draft.is_current}
        onChange={(e) => set({ is_current: e.target.checked, end_date: e.target.checked ? "" : draft.end_date })}
      />
      <MoreDetails>
        <Input label="Notes" placeholder="e.g. Major in Marketing, Dean's List" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
      </MoreDetails>
    </>
  ),
};

const REFEREES: SectionSpec<RefereeEntry> = {
  title: "Add a referee",
  noun: "referee",
  nounPlural: "referees",
  newTab: "New referee",
  missingTitle: "Add the referee's name first.",
  empty: EMPTY_PROFILE_ENTRY.referees,
  ready: (d) => d.name.trim().length > 0,
  describe: (d) => ({ primary: d.name, secondary: joinDot(d.title, d.organisation) }),
  Fields: ({ draft, set, firstFieldRef }) => (
    <>
      <Input ref={firstFieldRef} label="Name" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Job title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        <Input label="Organisation" value={draft.organisation} onChange={(e) => set({ organisation: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Phone" type="tel" autoComplete="off" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
        <Input label="Email" type="email" autoComplete="off" value={draft.email} onChange={(e) => set({ email: e.target.value })} />
      </div>
    </>
  ),
};

const SPECS: { [S in AddSection]: SectionSpec<ProfileEntryFor[S]> } = {
  experience: EXPERIENCE,
  projects: PROJECTS,
  education: EDUCATION,
  referees: REFEREES,
};

/** Saves a hand-typed entry to the profile too, so the next resume has it. The resume already has
 * it either way, so a failure here is a toast, never a blocked add. */
function saveToProfile(section: AddSection, entry: unknown, onFail: (message: string) => void) {
  fetch("/api/profile/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section: PROFILE_SECTION_FOR[section], entry }),
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) onFail("Added to this resume, but it couldn't be saved to your profile.");
      else if (data.reason === "full") onFail("Added to this resume. Your profile list is full, so it wasn't saved there.");
      else if (data.reason === "no_profile") onFail("Added to this resume. Save your profile first to keep entries there too.");
    })
    .catch(() => onFail("Added to this resume, but it couldn't be saved to your profile."));
}

/**
 * The editor's Add pop-up for roles, projects, qualifications and referees: pick saved entries from
 * the profile, or fill in a short form. Nothing lands on the resume until "Add" is clicked - the
 * old "+ Add" dropped a blank entry straight onto the page. Editing what's already on the resume
 * still happens in place on the canvas.
 */
export function AddEntryDialog<S extends AddSection>({
  section,
  library,
  resume,
  onAdd,
  onClose,
}: {
  section: S;
  library: ProfileLibrary;
  resume: ResumeContent;
  onAdd: (entries: ProfileEntryFor[S][]) => void;
  onClose: () => void;
}) {
  const spec = SPECS[section] as SectionSpec<ProfileEntryFor[S]>;
  const profileSection = PROFILE_SECTION_FOR[section];
  const { showToast } = useToast();

  // Only entries with their key field - a blank row left in the profile isn't something to pick.
  const profileItems = useMemo(
    () => ((library[profileSection] ?? []) as ProfileEntryFor[S][]).filter((item) => spec.ready(item)),
    [library, profileSection, spec]
  );
  const onResume = useMemo(() => resumeEntryKeys(resume, section), [resume, section]);
  const isOnResume = (item: ProfileEntryFor[S]) => onResume.has(profileEntryKey(profileSection, item as unknown as Record<string, unknown>));

  // Fixed at open: whether there's anything to pick decides the tabs, and they don't vanish mid-use.
  const [showTabs] = useState(() => profileItems.some((item) => !isOnResume(item)));
  const [tab, setTab] = useState<"profile" | "new">(showTabs ? "profile" : "new");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<ProfileEntryFor[S]>(spec.empty);
  const [alsoSave, setAlsoSave] = useState(true);
  const [missing, setMissing] = useState(false);
  const [addedNote, setAddedNote] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // Either tab counts: switching tabs keeps both, so either can be lost on close.
  const isDirty = selected.size > 0 || JSON.stringify(draft) !== JSON.stringify(spec.empty());

  useEffect(() => {
    trackFunnelEvent("add_entry_opened", { section, tab });
    // Mount-only: opening the pop-up is the one event this tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First field on the form; first selectable entry on the profile tab.
  useEffect(() => {
    if (tab === "new") firstFieldRef.current?.focus();
    else listRef.current?.querySelector<HTMLInputElement>("[data-pick]:not(:disabled)")?.focus();
  }, [tab]);

  function dismiss() {
    trackFunnelEvent("add_entry_dismissed", { section, hadInput: isDirty });
    onClose();
  }

  function addPicked() {
    const picks = profileItems.filter((_, i) => selected.has(i));
    if (picks.length === 0) return;
    onAdd(picks);
    trackFunnelEvent("add_entry_added", { section, source: "profile", count: picks.length });
    onClose();
  }

  function addNew(another: boolean) {
    if (!spec.ready(draft)) {
      setMissing(true);
      firstFieldRef.current?.focus();
      return;
    }
    onAdd([draft]);
    trackFunnelEvent("add_entry_added", { section, source: "new", savedToProfile: alsoSave, another });
    if (alsoSave) saveToProfile(section, draft, (message) => showToast(message, "attention"));
    if (!another) {
      onClose();
      return;
    }
    setAddedNote(`Added: ${spec.describe(draft).primary}`);
    setDraft(spec.empty());
    setMissing(false);
    firstFieldRef.current?.focus();
  }

  const pickCount = selected.size;

  return (
    <CanvasSheet
      title={spec.title}
      isDirty={isDirty}
      onDismiss={dismiss}
      footer={(requestClose) =>
        tab === "profile" ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={pickCount === 0} onClick={addPicked}>
              {pickCount === 0 ? `Tick a ${spec.noun} to add` : `Add ${pickCount} ${pickCount === 1 ? spec.noun : spec.nounPlural}`}
            </Button>
          </>
        ) : (
          <>
            <span className="min-w-0 text-sm" aria-live="polite">
              {addedNote ? (
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {addedNote}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => addNew(true)}
                  className="rounded-sm font-medium text-accent-hover underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Save and add another
                </button>
              )}
            </span>
            <div className="flex gap-2">
              {addedNote ? (
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Done
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={requestClose}>
                  Cancel
                </Button>
              )}
              <Button type="submit" form="add-entry-form" size="sm">
                Add {spec.noun}
              </Button>
            </div>
          </>
        )
      }
    >
      {showTabs && (
        <div className="px-5 pb-3">
          <div role="tablist" aria-label={`How to add a ${spec.noun}`} className="grid grid-cols-2 rounded-pill bg-paper-deep p-[3px] text-[13.5px] font-semibold">
            {(["profile", "new"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={clsx(
                  "rounded-pill px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === value ? "bg-surface text-ink shadow-sm" : "text-ink-secondary hover:text-ink"
                )}
              >
                {value === "profile" ? "From my profile" : spec.newTab}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "profile" ? (
        <div ref={listRef} className="flex min-h-0 flex-col gap-2 overflow-y-auto px-5 pb-4" role="group" aria-label={`Saved ${spec.nounPlural}`}>
          {profileItems.map((item, i) => {
            const added = isOnResume(item);
            const isPicked = selected.has(i);
            const { primary, secondary } = spec.describe(item);
            return (
              <label
                key={i}
                className={clsx(
                  "flex items-center gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors",
                  added
                    ? "cursor-default border-border bg-paper/60 opacity-60"
                    : isPicked
                    ? "cursor-pointer border-accent bg-accent-soft/40"
                    : "cursor-pointer border-border hover:border-border-strong"
                )}
              >
                <input
                  type="checkbox"
                  data-pick
                  disabled={added}
                  checked={isPicked}
                  onChange={() =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                  className="h-4 w-4 shrink-0 rounded-sm border border-border-strong accent-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{primary}</span>
                  {secondary && <span className="block truncate text-xs text-ink-secondary">{secondary}</span>}
                </span>
                {added && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                    <CheckIcon className="h-3 w-3" aria-hidden="true" /> On resume
                  </span>
                )}
              </label>
            );
          })}
        </div>
      ) : (
        <form
          id="add-entry-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            addNew(false);
          }}
          className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-1"
        >
          <spec.Fields
            draft={draft}
            set={(patch) => {
              setDraft((current) => ({ ...current, ...patch }));
              setMissing(false);
              setAddedNote(null);
            }}
            firstFieldRef={firstFieldRef}
          />
          {missing && (
            <p role="alert" className="text-sm font-medium text-critical">
              {spec.missingTitle}
            </p>
          )}
          <Checkbox
            id="add-entry-save-to-profile"
            label="Also save to my profile, so my next resume has it"
            checked={alsoSave}
            onChange={(e) => setAlsoSave(e.target.checked)}
          />
        </form>
      )}
    </CanvasSheet>
  );
}
