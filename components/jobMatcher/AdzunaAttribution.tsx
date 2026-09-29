// Adzuna's terms require "Jobs by Adzuna" on every displayed job, at least 116x23px, with "Jobs"
// linked to the local Adzuna site and "Adzuna" shown as the Adzuna logo, also linked.
const ADZUNA_LOGO_SRC = "/brand/adzuna-logo.png";
const ADZUNA_URL = "https://www.adzuna.com.au";

const link = "text-ink-secondary underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

export function AdzunaAttribution() {
  return (
    <span className="inline-flex min-h-[23px] min-w-[116px] items-center gap-1 text-xs text-ink-muted">
      <a href={ADZUNA_URL} target="_blank" rel="noopener" className={link}>
        Jobs
      </a>
      <span>by</span>
      <a href={ADZUNA_URL} target="_blank" rel="noopener" className={link}>
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand asset at a fixed size */}
        <img src={ADZUNA_LOGO_SRC} alt="Adzuna" width={85} height={23} className="h-[23px] w-auto" />
      </a>
    </span>
  );
}
