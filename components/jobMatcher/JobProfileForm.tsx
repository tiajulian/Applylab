"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ChevronDownIcon } from "@/components/ui/icons/LucideIcons";
import { TagInput } from "@/components/jobMatcher/TagInput";
import { ApiError, saveJobProfile, type JobProfileInput } from "@/lib/jobs/client";
import { AU_LOCATIONS } from "@/lib/jobs/locations";
import {
  CONTRACT_TYPES,
  PROFILE_LIMITS,
  RADIUS_OPTIONS_KM,
  SENIORITY_LEVELS,
  type ContractType,
  type Seniority,
} from "@/lib/jobs/profile";

const CONTRACT_LABELS: Record<ContractType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  permanent: "Permanent",
  contract: "Contract",
};

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

// A native checkbox/radio drawn as a pill: keeps keyboard and screen-reader behaviour for free.
const PILL =
  "inline-flex h-9 cursor-pointer items-center rounded-pill border border-border bg-surface px-3.5 text-sm text-ink-secondary shadow-sm transition-[border-color,background-color,color] duration-fast ease-editorial hover:border-border-strong hover:text-ink peer-checked:border-accent/40 peer-checked:bg-accent-soft peer-checked:font-medium peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ring";

type Errors = Partial<Record<keyof JobProfileInput | "form", string>>;

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

interface JobProfileFormProps {
  initial: JobProfileInput;
  onSaved: () => void;
  onCancel?: () => void;
}

export function JobProfileForm({ initial, onSaved, onCancel }: JobProfileFormProps) {
  const [profile, setProfile] = useState(initial);
  const [salaryText, setSalaryText] = useState(initial.minSalary ? initial.minSalary.toLocaleString("en-AU") : "");
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);

  const set = <K extends keyof JobProfileInput>(key: K, value: JobProfileInput[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));

  function toggleContract(type: ContractType) {
    set(
      "contractTypes",
      profile.contractTypes.includes(type) ? profile.contractTypes.filter((t) => t !== type) : [...profile.contractTypes, type]
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const digits = salaryText.replace(/[^\d]/g, "");
    const minSalary = digits ? Number(digits) : null;
    if (profile.targetTitles.length === 0) {
      setErrors({ targetTitles: "Add at least one job title" });
      return;
    }
    if (minSalary !== null && minSalary > PROFILE_LIMITS.maxSalary) {
      setErrors({ minSalary: "That looks too high - enter a yearly amount in AUD" });
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      await saveJobProfile({ ...profile, minSalary });
      onSaved();
    } catch (error) {
      setErrors(error instanceof ApiError ? { ...error.fields, form: error.message } : { form: "Couldn't save your search. Try again." });
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="overflow-clip rounded-lg border border-border bg-surface shadow-soft"
      aria-labelledby="adjust-search-title"
    >
      <header className="border-b border-border p-5 sm:p-6">
        <h2 id="adjust-search-title" className="text-h3 font-semibold text-ink">
          Adjust your search
        </h2>
        <p className="mt-1 max-w-[65ch] text-sm text-ink-secondary">
          Filled in from your profile and applications. Changes here only affect Job Matcher.
        </p>
      </header>

      <div className="divide-y divide-border">
        <Section title="Roles" description="The jobs you want, and the skills that should count in your favour.">
          <TagInput
            label="Job titles"
            values={profile.targetTitles}
            onChange={(v) => set("targetTitles", v)}
            max={PROFILE_LIMITS.targetTitles}
            placeholder="Add a job title"
            hint="Press Enter after each one."
            error={errors.targetTitles}
          />
          <TagInput
            label="Skills"
            values={profile.skills}
            onChange={(v) => set("skills", v)}
            max={PROFILE_LIMITS.skills}
            placeholder="Add a skill"
            error={errors.skills}
          />
        </Section>

        <Section title="Location" description="Jobs within your range of any place you add. Add a city you'd move to.">
          <TagInput
            label="Places you'd work"
            values={profile.locations}
            onChange={(v) => set("locations", v)}
            max={PROFILE_LIMITS.locations}
            placeholder="Suburb, city or state"
            suggestions={AU_LOCATIONS}
            hint="Leave empty to search all of Australia."
            error={errors.locations}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-secondary">Range</legend>
            <div className="flex flex-wrap gap-2">
              {[...RADIUS_OPTIONS_KM, null].map((km) => (
                <label key={km ?? "any"} className="relative">
                  <input
                    type="radio"
                    name="search-radius"
                    className="peer sr-only"
                    checked={profile.searchRadiusKm === km}
                    onChange={() => set("searchRadiusKm", km)}
                  />
                  <span className={PILL}>{km === null ? "Anywhere in Australia" : `${km} km`}</span>
                </label>
              ))}
            </div>
            {errors.searchRadiusKm && <p className="mt-1.5 text-xs text-critical">{errors.searchRadiusKm}</p>}
          </fieldset>
          <Checkbox
            id="remote-ok"
            label="Also include remote jobs anywhere in Australia"
            checked={profile.remoteOk}
            onChange={(e) => set("remoteOk", e.target.checked)}
          />
          <p className="text-xs text-ink-muted">
            Distances use place data from{" "}
            <a href="https://www.geonames.org" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
              GeoNames
            </a>
            .
          </p>
        </Section>

        <Section title="Preferences" description="Optional. Leave these blank to see everything.">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="min-salary" className="text-sm font-medium text-ink-secondary">
              Minimum salary
            </label>
            <div className="relative w-full max-w-xs">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted">$</span>
              <input
                id="min-salary"
                inputMode="numeric"
                placeholder="90,000"
                value={salaryText}
                onChange={(e) => setSalaryText(e.target.value)}
                aria-invalid={errors.minSalary ? true : undefined}
                aria-describedby="min-salary-help"
                className="w-full rounded border border-border bg-surface py-2.5 pl-7 pr-20 text-sm tabular-nums text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted">per year</span>
            </div>
            <p id="min-salary-help" className={errors.minSalary ? "text-xs text-critical" : "text-xs text-ink-muted"}>
              {errors.minSalary ?? "Jobs paying less are hidden. Jobs with no listed salary still show."}
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-secondary">Work type</legend>
            <div className="flex flex-wrap gap-2">
              {CONTRACT_TYPES.map((type) => (
                <label key={type} className="relative">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={profile.contractTypes.includes(type)}
                    onChange={() => toggleContract(type)}
                  />
                  <span className={PILL}>{CONTRACT_LABELS[type]}</span>
                </label>
              ))}
            </div>
            {errors.contractTypes && <p className="mt-1.5 text-xs text-critical">{errors.contractTypes}</p>}
          </fieldset>

          <div className="w-full max-w-xs">
            <Select
              id="seniority"
              label="Seniority"
              value={profile.seniority ?? ""}
              onChange={(e) => set("seniority", (e.target.value || null) as Seniority | null)}
              error={errors.seniority}
            >
              <option value="">Any level</option>
              {SENIORITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {capitalize(level)}
                </option>
              ))}
            </Select>
          </div>
        </Section>

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 hover:bg-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6">
            <span>
              <span className="block text-base font-semibold text-ink">Background (optional)</span>
              <span className="mt-1 block text-sm text-ink-muted">Extra detail about your experience that helps rank jobs.</span>
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-fast group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-5 pb-6 sm:px-6">
            <Textarea
              label="Background"
              placeholder="Paste your resume or a short summary of your experience"
              rows={6}
              maxLength={PROFILE_LIMITS.resumeChars}
              value={profile.resumeText ?? ""}
              onChange={(e) => set("resumeText", e.target.value || null)}
              error={errors.resumeText}
            />
          </div>
        </details>
      </div>

      <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-surface/95 p-4 backdrop-blur-[6px] sm:px-6">
        {errors.form && (
          <p role="alert" className="mr-auto text-sm text-critical">
            {errors.form}
          </p>
        )}
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={isSaving}>
          {isSaving ? "Updating your matches…" : "Update matches"}
        </Button>
      </footer>
    </form>
  );
}
