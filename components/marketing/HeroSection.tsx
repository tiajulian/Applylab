"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckIcon, MicIcon } from "@/components/ui/icons/LucideIcons";
import { CTA, HOME, TIMINGS } from "@/lib/marketing/copy";

type QueueStatus = "pasted" | "tailoring" | "ready" | "applied";

interface QueueRow {
  role: string;
  company: string;
  place: string;
  source: "SEEK" | "LinkedIn";
}

// Illustrative jobs (made-up employers), all the same kind of role: that's who applies at volume.
const INCOMING: QueueRow = { role: "Project Coordinator", company: "Bayside Council", place: "Sandringham VIC", source: "SEEK" };
const ROWS: QueueRow[] = [
  { role: "Customer Success Lead", company: "Tilly Payroll", place: "Richmond VIC", source: "LinkedIn" },
  { role: "Operations Coordinator", company: "Harbourline Freight", place: "Port Melbourne VIC", source: "SEEK" },
  { role: "Implementation Analyst", company: "Rosterly", place: "Cremorne VIC", source: "SEEK" },
  { role: "Business Analyst", company: "Northcote Health", place: "Northcote VIC", source: "SEEK" },
  { role: "Service Delivery Officer", company: "Merri Water", place: "Coburg VIC", source: "LinkedIn" },
];

// The one authored moment on the page: the queue moves forward once after load. Phase 0 is what
// the server renders; reduced motion jumps straight to the last phase.
const PHASE_DELAYS_MS = [1400, 2600, 3700];
const LAST_PHASE = PHASE_DELAYS_MS.length;
// Matches the stacked hero breakpoint in globals.css, where only MOBILE_ROWS rows show.
const NARROW_QUERY = "(max-width: 960px)";
const MOBILE_ROWS = 3;

function statusFor(index: number, phase: number): QueueStatus {
  if (index === 0) return phase >= 1 ? "ready" : "tailoring";
  // Exactly the rows phones show are "ready", so the count matches on every screen size.
  if (index < MOBILE_ROWS) return "ready";
  return "applied";
}

const STATUS_LABEL: Record<QueueStatus, string> = {
  pasted: "Ad pasted",
  tailoring: "Tailoring",
  ready: "Ready to send",
  applied: "Applied",
};

function Row({ row, status, collapsed = false, wideOnly = false }: { row: QueueRow; status: QueueStatus; collapsed?: boolean; wideOnly?: boolean }) {
  return (
    <li className={`qrow-wrap${collapsed ? " collapsed" : ""}${wideOnly ? " q-wide-only" : ""}`}>
      <div className="qrow-clip">
        <div className={`qrow is-${status}`}>
          <span className="qlogo">{row.company[0]}</span>
          <div className="qmain">
            <b>{row.role}</b>
            <small>
              {row.company} &middot; {row.place}
            </small>
          </div>
          <span className="qstatus">
            {status === "applied" && <CheckIcon className="h-3.5 w-3.5" />}
            {status === "pasted" ? `${STATUS_LABEL.pasted} from ${row.source}` : STATUS_LABEL[status]}
          </span>
          {status === "tailoring" && <span className="qsweep" />}
        </div>
      </div>
    </li>
  );
}

function ApplicationQueue() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(LAST_PHASE);
      return;
    }
    // Later phases only move rows that phones hide, so stop after the first one there.
    const lastPhase = window.matchMedia(NARROW_QUERY).matches ? 1 : LAST_PHASE;
    const timers = PHASE_DELAYS_MS.slice(0, lastPhase).map((ms, i) => window.setTimeout(() => setPhase(i + 1), ms));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const statuses = ROWS.map((_, i) => statusFor(i, phase));
  const readyCount = statuses.filter((s) => s === "ready").length;
  const incomingShown = phase >= 2;

  return (
    <div className="queue card" role="img" aria-label="Example: a week of job applications, each with its own tailored resume">
      <div className="queue-head">
        <div>
          <p className="queue-title">This week&apos;s applications</p>
          <small>All tailored from one profile</small>
        </div>
        <span className="queue-count">
          <b key={readyCount}>{readyCount}</b> ready to send
        </span>
      </div>
      <ol className="queue-list">
        {/* Phones show only the first 3 rows (all "ready", so the count still matches) to keep the
            free score within the second screen; the card's height never changes mid-animation. */}
        <Row row={INCOMING} status={phase >= 3 ? "tailoring" : "pasted"} collapsed={!incomingShown} wideOnly />
        {ROWS.map((row, i) => (
          <Row
            key={row.role}
            row={row}
            status={statuses[i]}
            collapsed={incomingShown && i === ROWS.length - 1}
            wideOnly={i >= MOBILE_ROWS}
          />
        ))}
      </ol>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="hero" data-section="hero">
      <div className="container hero-grid">
        <div className="reveal">
          <span className="eyebrow">Built for Australian job seekers 🇦🇺</span>
          <h1>
            {/* The space keeps the h1's text one sentence for screen readers and search snippets. */}
            {HOME.headlineLead} <span className="h1-soft">{HOME.headlineRest}</span>
          </h1>
          <p className="lead">{HOME.lead}</p>
          <div className="hero-cta">
            <Link className="btn btn-primary" href="/onboarding" data-cta="hero-start-free">
              {CTA.startFree} &rarr;
            </Link>
            <a className="text-link" href="#score" data-cta="hero-score">{CTA.scoreFree} &rarr;</a>
          </div>
          <p className="hero-fineprint">
            Free resume score in about {TIMINGS.resumeScoreSeconds} seconds &middot; No account needed &middot; No credit card
          </p>
        </div>

        <div className="collage reveal">
          <ApplicationQueue />
          <div className="card mini-card mini-1 float d1">
            <span className="tick"><CheckIcon /></span> Every line from your real experience
          </div>
          <div className="card mini-card mini-2 float d2">
            <MicIcon className="inline h-4 w-4 align-text-bottom" /> Practice score <b>4.2</b>/5 &middot; STAR{" "}
            <CheckIcon className="inline h-3.5 w-3.5 align-text-bottom" />
          </div>
        </div>
      </div>
    </section>
  );
}
