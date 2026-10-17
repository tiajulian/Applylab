import type { ReactNode } from "react";

/** The peach welcome panel (.banner). The resume illustration shows on the returning view only. */
export function WelcomeBanner({
  heading,
  sub,
  actions,
  showArt = false,
}: {
  heading: string;
  sub: ReactNode;
  actions?: ReactNode;
  showArt?: boolean;
}) {
  return (
    <section
      aria-labelledby="welcome-h"
      className="flex items-center justify-between gap-6 rounded-[20px] border border-dash-banner-border bg-dash-banner px-8 py-7 max-md:p-6"
    >
      <div className="min-w-0 flex-1">
        <h1 id="welcome-h" className="font-dash-display text-[36px] font-semibold tracking-[-0.02em]">
          {heading}
        </h1>
        <p className="mt-1.5 text-[17px] text-dash-text-2">{sub}</p>
        {actions && <div className="mt-6 flex flex-wrap items-center gap-5">{actions}</div>}
      </div>
      {showArt && <BannerArt />}
    </section>
  );
}

function BannerArt() {
  return (
    <svg aria-hidden="true" width="190" height="130" viewBox="0 0 190 130" className="flex-none max-md:hidden">
      <g transform="rotate(-6 70 70)">
        <rect x="30" y="18" width="88" height="108" rx="10" fill="#fff" stroke="#F5CBB0" />
        <rect x="44" y="34" width="40" height="6" rx="3" fill="#F5CBB0" />
        <rect x="44" y="50" width="60" height="4" rx="2" fill="#EFE3DA" />
        <rect x="44" y="60" width="52" height="4" rx="2" fill="#EFE3DA" />
        <rect x="44" y="70" width="56" height="4" rx="2" fill="#EFE3DA" />
      </g>
      <g transform="rotate(5 120 66)">
        <rect x="76" y="10" width="88" height="108" rx="10" fill="#fff" stroke="#EA580C" strokeWidth="1.5" />
        <rect x="90" y="26" width="44" height="6" rx="3" fill="#EA580C" />
        <rect x="90" y="42" width="60" height="4" rx="2" fill="#FBD5BE" />
        <rect x="90" y="52" width="48" height="4" rx="2" fill="#FBD5BE" />
        <rect x="90" y="62" width="56" height="4" rx="2" fill="#FBD5BE" />
        <rect x="90" y="78" width="36" height="4" rx="2" fill="#EFE3DA" />
        <rect x="90" y="88" width="50" height="4" rx="2" fill="#EFE3DA" />
      </g>
      <circle cx="160" cy="102" r="16" fill="#15803D" />
      <path d="M152 102l5 5 10-10" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
