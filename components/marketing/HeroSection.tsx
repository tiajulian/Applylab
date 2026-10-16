"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckIcon, WandSparklesIcon } from "@/components/ui/icons/LucideIcons";
import { CTA, HOME } from "@/lib/marketing/copy";
import { FREE_RESUMES_LABEL } from "@/lib/marketing/plans";

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

function statusFor(index: number, phase: number): QueueStatus {
  if (index === 0) return phase >= 1 ? "ready" : "tailoring";
  if (index <= 2) return "ready";
  return "applied";
}

const STATUS_LABEL: Record<QueueStatus, string> = {
  pasted: "Ad pasted",
  tailoring: "Tailoring",
  ready: "Ready to send",
  applied: "Applied",
};

function Row({ row, status, collapsed = false }: { row: QueueRow; status: QueueStatus; collapsed?: boolean }) {
  return (
    <li className={`qrow-wrap${collapsed ? " collapsed" : ""}`}>
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
    const timers = PHASE_DELAYS_MS.map((ms, i) => window.setTimeout(() => setPhase(i + 1), ms));
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
        <Row row={INCOMING} status={phase >= 3 ? "tailoring" : "pasted"} collapsed={!incomingShown} />
        {ROWS.map((row, i) => (
          <Row key={row.role} row={row} status={statuses[i]} collapsed={incomingShown && i === ROWS.length - 1} />
        ))}
      </ol>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="reveal">
          <h1>
            {/* The space keeps the h1's text one sentence for screen readers and search snippets. */}
            {HOME.headlineLead} <span className="h1-soft">{HOME.headlineRest}</span>
          </h1>
          <p className="lead">{HOME.lead}</p>
          <div className="hero-cta">
            <Link className="btn btn-primary" href="/onboarding">
              {CTA.tailor} &rarr;
            </Link>
            <a className="text-link" href="#how">or see how it works</a>
          </div>
          <p className="hero-fineprint">
            {FREE_RESUMES_LABEL} free &middot; No credit card &middot; Built for Australian job ads
          </p>
        </div>

        <div className="collage reveal">
          <ApplicationQueue />
          <div className="card mini-card mini-1 float d1">
            <span className="tick"><CheckIcon /></span> Every line from your real experience
          </div>
          <div className="card mini-card mini-2 float d2">
            <WandSparklesIcon className="inline h-4 w-4 align-text-bottom" /> Fills in the <b>SEEK</b> form
          </div>
        </div>
      </div>
    </section>
  );
}
