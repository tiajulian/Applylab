"use client";

import { Select } from "@/components/ui/Select";
import { parseMonthYearParts } from "@/lib/profile/parseRoleDate";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EARLIEST_YEAR = 1960;
// Matches FUTURE_TOLERANCE_MONTHS in lib/profile/validate.ts: the picker should never offer a
// year that the date-validity check is guaranteed to reject.
const LATEST_YEAR = new Date().getFullYear() + 1;
const YEARS = Array.from({ length: LATEST_YEAR - EARLIEST_YEAR + 1 }, (_, i) => LATEST_YEAR - i);

/** Round-trips through parseMonthYearParts even with only one side picked (e.g. "March" with no
 * year yet) - dropping a month-only pick here (rather than keeping it as month-name-only text)
 * would lose it the moment the field re-renders from the parent's value, since nothing else
 * remembers it. */
function buildValue(monthIndex: number | null, year: string): string {
  if (monthIndex === null) return year;
  return year ? `${MONTH_NAMES[monthIndex]} ${year}` : MONTH_NAMES[monthIndex];
}

/** Month + Year picker over the app's existing free-text date format ("March 2022") - two plain
 * selects rather than a native `<input type="month">` so the stored value stays exactly the
 * format lib/profile/parseRoleDate.ts and every downstream consumer (AI prompts, resume
 * rendering, quality gate) already parses, with no new format to round-trip. */
export function MonthYearField({
  label,
  value,
  onChange,
  disabled,
  disabledLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  if (disabled) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-secondary">{label}</label>
        <div className="flex h-[42px] items-center rounded border border-border bg-paper-deep px-3.5 text-sm text-ink-muted">
          {disabledLabel ?? "Current"}
        </div>
      </div>
    );
  }

  const { monthIndex, year } = parseMonthYearParts(value);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink-secondary">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <Select
          aria-label={`${label} - month`}
          value={monthIndex ?? ""}
          onChange={(e) => onChange(buildValue(e.target.value === "" ? null : Number(e.target.value), year))}
        >
          <option value="">Month</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          aria-label={`${label} - year`}
          value={year}
          onChange={(e) => onChange(buildValue(monthIndex, e.target.value))}
        >
          <option value="">Year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
