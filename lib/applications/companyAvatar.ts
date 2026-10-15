/** Two-letter initials for a company's placeholder logo, e.g. "Crown Melbourne" -> "CM". */
export function getCompanyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CO";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** One calm neutral style for every company tile, so colour stays reserved for job status. */
export const COMPANY_AVATAR_CLASS = "border-border bg-paper-deep text-ink-secondary";
