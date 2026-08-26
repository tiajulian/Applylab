"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/marketing/Logo";
import { Accordion, AccordionItemData } from "@/components/marketing/Accordion";
import { clsx } from "@/lib/utils";

interface PricingViewProps {
  userSession: {
    isLoggedIn: boolean;
    initials?: string;
  };
}

export function PricingView({ userSession }: PricingViewProps) {
  const router = useRouter();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "quarterly">("monthly");
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isMatrixOpen, setIsMatrixOpen] = useState(true);

  async function handleStartPro() {
    if (!userSession.isLoggedIn) {
      router.push("/login?redirectedFrom=/pricing");
      return;
    }

    setIsLoadingCheckout(true);
    setCheckoutError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });

      if (response.status === 401) {
        router.push("/login?redirectedFrom=/pricing");
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.url) {
        setCheckoutError(data.error ?? "Failed to initiate Stripe checkout.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setCheckoutError("Something went wrong initializing checkout. Please try again.");
    } finally {
      setIsLoadingCheckout(false);
    }
  }

  const faqItems: AccordionItemData[] = [
    {
      question: "Can I cancel anytime?",
      answer:
        "Yes. You can manage or cancel your subscription in 1 click directly from your dashboard via the secure Stripe Customer Portal. There are no hidden cancellation fees, minimum term commitments, or tedious email requests required.",
    },
    {
      question: "Why pay for ApplyLab instead of using free ChatGPT?",
      answer:
        "ChatGPT regularly hallucinates unverified employment history, fabricates metric achievements, ignores Australian ATS formatting standards, and requires tedious manual prompting. ApplyLab strictly anchors every bullet in your verified Master Career Profile, auto-extracts requirements directly from SEEK job ads, and formats pixel-perfect 1-page A4 PDFs.",
    },
    {
      question: "What happens after my 2 free resumes?",
      answer:
        "Your Master Career Profile and created resumes remain accessible forever on the free tier. When you need to tailor additional resumes for new job applications or unlock the AI STAR Interview Room, you can seamlessly upgrade to Pro.",
    },
    {
      question: "Do you offer refunds?",
      answer:
        "Yes. We stand behind ApplyLab 100%. If you are not completely satisfied with your Pro pass within the first 7 days, simply email our support team for a prompt, hassle-free full refund.",
    },
    {
      question: "Is GST included in the price?",
      answer:
        "Yes. All prices displayed are in Australian Dollars (AUD) and are inclusive of 10% Australian GST. Tax invoices with GST breakdowns are issued automatically upon checkout.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink selection:bg-accent-soft selection:text-accent overflow-x-hidden">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-3.5">
          <Logo />

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-ink-secondary">
            <Link href="/#how-it-works" className="hover:text-ink transition-colors">
              How it works
            </Link>
            <Link href="/#why-applylab" className="hover:text-ink transition-colors">
              Why ApplyLab
            </Link>
            <Link href="/pricing" className="text-accent font-bold transition-colors">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold">
            {userSession.isLoggedIn ? (
              <Link
                href="/dashboard"
                aria-label="Go to your dashboard"
                title="You're logged in"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent transition-opacity duration-fast ease-editorial hover:opacity-90 shadow-sm"
              >
                {userSession.initials || "ME"}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="font-medium text-ink-secondary hover:text-ink transition-colors"
                >
                  Log in
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="font-bold px-3 py-1.5 sm:px-4 text-xs">
                    Build resume free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Section A: Hero Header */}
        <section className="mx-auto max-w-4xl px-4 pt-8 pb-6 text-center md:pt-16 md:pb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-accent shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            TRANSPARENT PRICING · BUILT FOR AUSTRALIAN JOB SEEKERS
          </div>

          <h1 className="mt-4 font-display text-[28px] sm:text-[40px] md:text-display text-ink leading-tight sm:leading-[1.1]">
            Invest in your next career step. <br className="hidden sm:inline" />
            Land interviews 3x faster.
          </h1>

          <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-body sm:text-body-lg text-ink-secondary">
            Start free with 2 tailored applications. Upgrade to Pro when you are actively interviewing for unlimited SEEK matching, cover letters, and AI interview prep.
          </p>

          <p className="mt-2.5 text-xs sm:text-meta font-medium text-ink-muted">
            All prices in AUD. Includes GST. No lock-in contracts, cancel anytime in 1 click.
          </p>

          {/* Section B: Billing Interval Toggle */}
          <div className="mt-6 sm:mt-8 flex flex-col items-center justify-center gap-3">
            <div className="inline-flex max-w-full items-center rounded-pill border border-border bg-surface p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                className={clsx(
                  "rounded-pill px-3.5 py-1.5 sm:px-5 sm:py-2 text-xs font-bold transition-all duration-fast whitespace-nowrap",
                  billingInterval === "monthly"
                    ? "bg-accent text-on-accent shadow-sm"
                    : "text-ink-secondary hover:text-ink"
                )}
              >
                Monthly Pass
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("quarterly")}
                className={clsx(
                  "flex items-center gap-1.5 sm:gap-2 rounded-pill px-3.5 py-1.5 sm:px-5 sm:py-2 text-xs font-bold transition-all duration-fast whitespace-nowrap",
                  billingInterval === "quarterly"
                    ? "bg-accent text-on-accent shadow-sm"
                    : "text-ink-secondary hover:text-ink"
                )}
              >
                <span>3-Month Sprint</span>
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide",
                    billingInterval === "quarterly"
                      ? "bg-on-accent text-accent"
                      : "bg-accent-soft text-accent"
                  )}
                >
                  SAVE 35%
                </span>
              </button>
            </div>
            {billingInterval === "quarterly" && (
              <span className="text-xs font-bold text-accent animate-fade-in-up px-2 text-center">
                🔥 MOST POPULAR FOR ACTIVE JOB HUNTERS (Equivalent to only $13/mo AUD)
              </span>
            )}
          </div>
        </section>

        {/* Section C: Plan Cards (Side-by-Side Grid) */}
        <section className="mx-auto max-w-6xl px-4 py-4 sm:py-6 md:py-10">
          <div className="grid gap-6 md:grid-cols-2 lg:gap-10">
            {/* Card 1: Free Starter */}
            <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm transition-all duration-fast hover:border-border-strong">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-h3 text-ink">Free Starter</h3>
                  <span className="rounded-full bg-paper-deep px-3 py-1 text-meta font-medium text-ink-muted">
                    Casual Search
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-baseline gap-1">
                  <span className="font-display text-[36px] sm:text-[42px] font-bold text-ink">$0</span>
                  <span className="text-body font-semibold text-ink-secondary">AUD</span>
                  <span className="ml-1 text-xs sm:text-meta text-ink-muted">(Forever free / No card needed)</span>
                </div>

                <p className="mt-3 text-body text-ink-secondary">
                  Perfect for testing your resume against a real SEEK job ad and setting up your career profile.
                </p>

                <div className="mt-6 border-t border-border pt-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">What&apos;s Included:</h4>
                  <ul className="mt-4 space-y-3 text-body text-ink">
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span><strong>2 Tailored</strong> 1-page Australian standard resumes</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span>SEEK & Workday keyword match analysis</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span>Master Career Profile (Single Source of Truth)</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span>Australian English dictionary & terminology</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span>PDF export with ATS-safe styling</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span>Standard email support</span>
                    </li>
                  </ul>

                  <h4 className="mt-6 text-xs font-bold uppercase tracking-wider text-ink-muted">Not Included:</h4>
                  <ul className="mt-3 space-y-2 text-meta text-ink-muted">
                    <li className="flex items-center gap-2 line-through opacity-70">
                      <span>✕</span> Unlimited tailored applications
                    </li>
                    <li className="flex items-center gap-2 line-through opacity-70">
                      <span>✕</span> Tailored cover letter generator
                    </li>
                    <li className="flex items-center gap-2 line-through opacity-70">
                      <span>✕</span> AI STAR interview practice simulator
                    </li>
                    <li className="flex items-center gap-2 line-through opacity-70">
                      <span>✕</span> 1-Click SEEK & LinkedIn job scraper
                    </li>
                    <li className="flex items-center gap-2 line-through opacity-70">
                      <span>✕</span> Editable .DOCX Word exports
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-2">
                <Link href="/signup" className="block w-full">
                  <Button variant="outline" className="w-full justify-center py-3 font-bold text-ink">
                    Build 2 Free Resumes
                  </Button>
                </Link>
              </div>
            </div>

            {/* Card 2: Pro Job Copilot (Highlighted) */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-accent bg-surface p-6 sm:p-8 shadow-pop transition-all duration-fast hover:shadow-lg mt-4 sm:mt-0">
              {/* Highlight Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3.5 py-1 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider sm:tracking-widest text-on-accent shadow-md whitespace-nowrap max-w-[90%] text-center">
                RECOMMENDED FOR ACTIVE JOB SEEKERS
              </div>

              <div>
                <div className="flex items-center justify-between pt-2">
                  <h3 className="font-display text-h3 text-ink">Pro Job Copilot</h3>
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-meta font-bold text-accent">
                    Full Access
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-baseline gap-1">
                  {billingInterval === "monthly" ? (
                    <>
                      <span className="font-display text-[36px] sm:text-[42px] font-bold text-ink">$19</span>
                      <span className="text-body font-semibold text-ink-secondary">AUD</span>
                      <span className="text-body text-ink-muted">/ month</span>
                    </>
                  ) : (
                    <>
                      <span className="font-display text-[36px] sm:text-[42px] font-bold text-ink">$39</span>
                      <span className="text-body font-semibold text-ink-secondary">AUD</span>
                      <span className="text-body text-ink-muted">/ 3 months</span>
                      <span className="ml-1.5 rounded bg-success-soft px-2 py-0.5 text-xs font-bold text-success">
                        ($13/mo AUD)
                      </span>
                    </>
                  )}
                </div>

                <p className="mt-3 text-body text-ink-secondary">
                  Everything you need to run an end-to-end job search with zero stress and maximum response rate.
                </p>

                <div className="mt-6 border-t border-border pt-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-accent">Everything in Free, plus:</h4>
                  <ul className="mt-4 space-y-3.5 text-body text-ink">
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span><strong className="text-accent">Unlimited</strong> tailored 1-page resumes</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span><strong className="text-accent">Unlimited</strong> tailored Australian cover letters</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span><strong>1-Click SEEK & LinkedIn job import</strong> (extracts key selection criteria)</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span><strong>Skill Gap Audit:</strong> Flags missing keywords & suggests honest pivot evidence</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span><strong>AI Interview Practice Room:</strong> Role-specific STAR questions & scoring feedback</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span><strong>PDF & Editable .DOCX Word exports</strong></span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span><strong>Strict Anti-Hallucination Guarantee:</strong> 100% grounded in your career profile</span>
                    </li>
                    <li className="flex items-start gap-2.5 sm:gap-3">
                      <span className="font-bold text-success shrink-0">✓</span>
                      <span><strong>Priority Australian email support</strong> (guaranteed under 12h turnaround)</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-2">
                <Button
                  type="button"
                  onClick={handleStartPro}
                  isLoading={isLoadingCheckout}
                  className="w-full justify-center bg-accent hover:bg-accent-hover text-on-accent py-3.5 text-body font-bold shadow-md"
                >
                  Start Pro Copilot Pass →
                </Button>
                {checkoutError && (
                  <p className="mt-2 text-center text-xs font-semibold text-critical">{checkoutError}</p>
                )}
                <p className="mt-3 text-center text-meta text-ink-muted">
                  Instant activation · 7-day money-back guarantee
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section D: Value Comparison Callout Box (ROI) */}
        <section className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm md:p-10">
            <div className="text-center">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
                CAREER ROI COMPARISON
              </span>
              <h2 className="mt-3 font-display text-h2 text-ink text-balance">
                Why job hunters switch from traditional resume writers
              </h2>
            </div>

            <div className="mt-6 sm:mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-critical/20 bg-critical-soft/30 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-critical font-bold text-sm uppercase tracking-wider">
                  <span>✕</span> Traditional Resume Writer
                </div>
                <div className="mt-3 font-display text-h2 text-ink">$350 – $600 <span className="text-body text-ink-muted font-normal">AUD</span></div>
                <ul className="mt-4 space-y-2 text-meta text-ink-secondary">
                  <li>• Takes 5 to 7 days turn-around</li>
                  <li>• Produces a single static document</li>
                  <li>• Must pay again to re-tailor for each new SEEK job ad</li>
                  <li>• Zero interview preparation included</li>
                </ul>
              </div>

              <div className="rounded-xl border-2 border-accent bg-accent-soft/40 p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2 text-accent font-bold text-sm uppercase tracking-wider">
                  <span>✓</span> ApplyLab Pro Copilot
                </div>
                <div className="mt-3 font-display text-h2 text-accent">$19 <span className="text-body text-ink font-normal">AUD / month</span></div>
                <ul className="mt-4 space-y-2 text-body font-medium text-ink">
                  <li>• <strong>Instant:</strong> Tailor resumes & cover letters in under 60 seconds</li>
                  <li>• <strong>Unlimited:</strong> Custom documents for every single application</li>
                  <li>• <strong>Anti-Hallucination:</strong> Grounded in your real career achievements</li>
                  <li>• <strong>Full Suite:</strong> Includes AI STAR Interview Simulator</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section E: Full Feature Comparison Matrix */}
        <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-h2 text-ink">Detailed Feature Comparison</h2>
              <p className="mt-1 text-body text-ink-secondary">See exact capability side-by-side.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsMatrixOpen((prev) => !prev)}
              className="self-start sm:self-auto text-xs font-bold text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent/40 rounded px-1.5 py-0.5"
            >
              {isMatrixOpen ? "Collapse Matrix −" : "Expand Matrix +"}
            </button>
          </div>

          {isMatrixOpen && (
            <div className="mt-6 sm:mt-8 overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
              <table className="w-full min-w-[560px] text-left text-sm text-ink border-collapse">
                <thead>
                  <tr className="border-b border-border bg-paper-deep">
                    <th className="p-3.5 sm:p-4 font-bold text-ink">Feature / Capability</th>
                    <th className="p-3.5 sm:p-4 font-bold text-ink text-center w-36">Free Starter</th>
                    <th className="p-3.5 sm:p-4 font-bold text-accent text-center w-44 bg-accent-soft/50">Pro Copilot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {/* Category 1 */}
                  <tr className="bg-surface/50 font-bold text-xs uppercase tracking-wider text-ink-muted">
                    <td colSpan={3} className="p-3 bg-paper">Core Resume Engine</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">1-Page Strict Layout Lock (ATS Standard)</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold">✓</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold bg-accent-soft/20">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">Anti-Hallucination Fact Grounding</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold">✓</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold bg-accent-soft/20">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">Master Career Profile Storage</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold">✓</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold bg-accent-soft/20">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">Tailored Application Limit</td>
                    <td className="p-3.5 sm:p-4 text-center font-semibold text-ink-muted">2 Applications</td>
                    <td className="p-3.5 sm:p-4 text-center font-extrabold text-accent bg-accent-soft/20">Unlimited</td>
                  </tr>

                  {/* Category 2 */}
                  <tr className="bg-surface/50 font-bold text-xs uppercase tracking-wider text-ink-muted">
                    <td colSpan={3} className="p-3 bg-paper">Job Matching & ATS</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">SEEK & LinkedIn Job Description Parsing</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold">✓ (Manual paste)</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold bg-accent-soft/20">✓ (1-Click Scraper)</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">ATS Keyword Gap Audit & Match %</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold">Basic</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold bg-accent-soft/20">Advanced + Evidence Finder</td>
                  </tr>

                  {/* Category 3 */}
                  <tr className="bg-surface/50 font-bold text-xs uppercase tracking-wider text-ink-muted">
                    <td colSpan={3} className="p-3 bg-paper">Documents & Formats</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">Tailored Cover Letter Generator</td>
                    <td className="p-3.5 sm:p-4 text-center text-ink-muted">✕</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold bg-accent-soft/20">✓ (Unlimited)</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">Export Formats</td>
                    <td className="p-3.5 sm:p-4 text-center text-ink-secondary">PDF only</td>
                    <td className="p-3.5 sm:p-4 text-center font-bold text-ink bg-accent-soft/20">PDF + Editable .DOCX</td>
                  </tr>

                  {/* Category 4 */}
                  <tr className="bg-surface/50 font-bold text-xs uppercase tracking-wider text-ink-muted">
                    <td colSpan={3} className="p-3 bg-paper">Interview Preparation</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">AI STAR Method Practice Simulator</td>
                    <td className="p-3.5 sm:p-4 text-center text-ink-muted">✕</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold bg-accent-soft/20">✓ (Role-specific)</td>
                  </tr>

                  {/* Category 5 */}
                  <tr className="bg-surface/50 font-bold text-xs uppercase tracking-wider text-ink-muted">
                    <td colSpan={3} className="p-3 bg-paper">Support & Guarantee</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">Support Channel</td>
                    <td className="p-3.5 sm:p-4 text-center text-ink-secondary">Standard Email</td>
                    <td className="p-3.5 sm:p-4 text-center font-bold text-accent bg-accent-soft/20">Priority (&lt;12h turnaround)</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 sm:p-4 font-medium">7-Day Money-Back Guarantee</td>
                    <td className="p-3.5 sm:p-4 text-center text-ink-muted">N/A</td>
                    <td className="p-3.5 sm:p-4 text-center text-success font-bold bg-accent-soft/20">✓ 100% Refundable</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section F: Frequently Asked Questions (FAQ Accordion) */}
        <section className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
          <div className="text-center">
            <h2 className="font-display text-h2 text-ink">Frequently Asked Questions</h2>
            <p className="mt-2 text-body text-ink-secondary">Everything you need to know about plans, billing, and refunds.</p>
          </div>

          <div className="mt-6 sm:mt-8">
            <Accordion items={faqItems} />
          </div>
        </section>

        {/* Section G: Final Call to Action */}
        <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12 mb-8 sm:mb-12">
          <div className="rounded-3xl bg-accent p-6 sm:p-10 md:p-14 text-center text-on-accent shadow-pop">
            <h2 className="font-display text-[26px] sm:text-display sm:text-[40px] leading-tight">
              Ready to stand out in your next job application?
            </h2>
            <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-body sm:text-body-lg opacity-90">
              Join thousands of Australian job seekers landing interviews at top companies with tailored, anti-hallucinated applications.
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
              <Button
                type="button"
                onClick={handleStartPro}
                className="bg-surface text-ink hover:bg-paper font-bold px-6 sm:px-8 py-3.5 text-body rounded-pill shadow-md w-full sm:w-auto"
              >
                Get Started with Pro Copilot ($19 AUD)
              </Button>
              <Link href="/signup" className="w-full sm:w-auto">
                <Button variant="outline" className="border-on-accent/40 text-on-accent hover:bg-on-accent/10 font-bold px-6 sm:px-8 py-3.5 text-body rounded-pill w-full">
                  Try 2 Applications Free
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-8 text-xs text-ink-secondary">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row text-center sm:text-left">
          <Logo />
          <p>© {new Date().getFullYear()} ApplyLab. All rights reserved. Built for Australian job seekers.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
            <Link href="/pricing" className="hover:text-ink transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
