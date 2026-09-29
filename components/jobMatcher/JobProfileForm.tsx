"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TagInput } from "@/components/jobMatcher/TagInput";
import { ApiError, saveJobProfile, type JobProfileInput } from "@/lib/jobs/client";
import { AU_LOCATIONS } from "@/lib/jobs/locations";
import { CONTRACT_TYPES, PROFILE_LIMITS, SENIORITY_LEVELS, type ContractType, type Seniority } from "@/lib/jobs/profile";

const CONTRACT_LABELS: Record<ContractType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  permanent: "Permanent",
  contract: "Contract",
};

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

type Errors = Partial<Record<keyof JobProfileInput | "form", string>>;

interface JobProfileFormProps {
  initial: JobProfileInput;
  onSaved: () => void;
  onCancel?: () => void;
}

export function JobProfileForm({ initial, onSaved, onCancel }: JobProfileFormProps) {
  const [profile, setProfile] = useState(initial);
  const [salaryText, setSalaryText] = useState(initial.minSalary ? String(initial.minSalary) : "");
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
      setErrors({ targetTitles: "Add at least one target job title" });
      return;
    }
    if (minSalary !== null && minSalary > PROFILE_LIMITS.maxSalary) {
      setErrors({ minSalary: "That salary looks too high - enter a yearly amount in AUD" });
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      await saveJobProfile({ ...profile, minSalary });
      onSaved();
    } catch (error) {
      setErrors(error instanceof ApiError ? { ...error.fields, form: error.message } : { form: "Couldn't save your profile. Try again." });
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <div>
          <h2 className="text-h3 font-semibold text-ink">Adjust your search</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            We filled this in from your profile and applications. Change anything to fine-tune your matches.
          </p>
        </div>

        <TagInput
          label="Target job titles"
          values={profile.targetTitles}
          onChange={(v) => set("targetTitles", v)}
          max={PROFILE_LIMITS.targetTitles}
          placeholder="e.g. Frontend Developer, press Enter"
          error={errors.targetTitles}
        />
        <TagInput
          label="Skills"
          values={profile.skills}
          onChange={(v) => set("skills", v)}
          max={PROFILE_LIMITS.skills}
          placeholder="e.g. React, customer service"
          error={errors.skills}
        />

        <div className="flex flex-col gap-3">
          <TagInput
            label="Locations"
            values={profile.locations}
            onChange={(v) => set("locations", v)}
            max={PROFILE_LIMITS.locations}
            placeholder="City or state"
            suggestions={AU_LOCATIONS}
            hint="Leave empty to search all of Australia."
            error={errors.locations}
          />
          <Checkbox
            id="remote-ok"
            label="Include remote jobs anywhere in Australia"
            checked={profile.remoteOk}
            onChange={(e) => set("remoteOk", e.target.checked)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Minimum salary (AUD per year)"
            inputMode="numeric"
            placeholder="e.g. 90000"
            value={salaryText}
            onChange={(e) => setSalaryText(e.target.value)}
            error={errors.minSalary}
          />
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

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink-secondary">Work type</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {CONTRACT_TYPES.map((type) => (
              <Checkbox
                key={type}
                id={`contract-${type}`}
                label={CONTRACT_LABELS[type]}
                checked={profile.contractTypes.includes(type)}
                onChange={() => toggleContract(type)}
              />
            ))}
          </div>
          {errors.contractTypes && <p className="text-xs text-critical">{errors.contractTypes}</p>}
        </fieldset>

        <Textarea
          label="Resume text (optional)"
          placeholder="Paste your resume to sharpen your matches"
          rows={5}
          maxLength={PROFILE_LIMITS.resumeChars}
          value={profile.resumeText ?? ""}
          onChange={(e) => set("resumeText", e.target.value || null)}
          error={errors.resumeText}
        />

        {errors.form && (
          <p role="alert" className="text-sm text-critical">
            {errors.form}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          )}
          <Button type="submit" isLoading={isSaving}>
            {isSaving ? "Updating your matches…" : "Update matches"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
