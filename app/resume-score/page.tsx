import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/marketing/Container";
import { MarketingHeader, toMarketingUser, type MarketingNavLink } from "@/components/marketing/MarketingHeader";
import { PublicResumeScorer } from "@/components/marketing/PublicResumeScorer";
import { Reveal } from "@/components/ui/Reveal";
import { getCurrentUser } from "@/lib/getCurrentUser";

export const metadata: Metadata = {
  title: "Free AI Resume Score & ATS Diagnostic (0–100) | ApplyLab",
  description:
    "Get an instant, free 0–100 score for your resume across ATS parseability, content impact, writing quality, and Australian recruiter standards. No login required.",
  alternates: {
    canonical: "/resume-score",
  },
  openGraph: {
    title: "Free AI Resume Score & ATS Diagnostic | ApplyLab",
    description:
      "Instant 0–100 diagnostic score for Australian job seekers. Evaluated across ATS parseability, content quality, and recruiter readiness.",
    url: "https://applylab.com.au/resume-score",
    siteName: "ApplyLab",
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Resume Score & ATS Diagnostic | ApplyLab",
    description:
      "Instant 0–100 diagnostic score for Australian job seekers. Evaluated across ATS parseability, content quality, and recruiter readiness.",
  },
};

const NAV_LINKS: MarketingNavLink[] = [
  { href: "/resume-score", label: "Free Resume Score", highlight: true },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/#how-it-works", label: "How it works" },
];

export default async function ResumeScorePage() {
  const user = await getCurrentUser();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ApplyLab Free AI Resume Scorer",
    url: "https://applylab.com.au/resume-score",
    description:
      "Instant 0–100 resume scoring diagnostic across ATS parseability, content quality, and Australian recruiter standards.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "All",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "AUD",
    },
  };

  return (
    <div className="flex flex-1 flex-col bg-paper text-ink min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <MarketingHeader navLinks={NAV_LINKS} user={toMarketingUser(user)} ctaLabel="Sign up free →" />

      {/* Main Scoring Section */}
      <main className="flex-1 py-12 sm:py-16">
        <Container size="marketing">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1 text-xs font-bold text-accent">
                <span>Free 10-Second Diagnostic</span>
                <span>🇦🇺</span>
              </span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-ink">
                How strong is your resume?
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="text-sm sm:text-base text-ink-secondary leading-relaxed">
                Drop in your resume for an instant 0–100 score across 5 recruiter-backed pillars. Free, private, and calibrated to Australian hiring standards.
              </p>
            </Reveal>
          </div>

          {/* Interactive Public Scorer */}
          <PublicResumeScorer isLoggedIn={Boolean(user && !user.isAnonymous)} />

          {/* 5-Pillar Explanation Section */}
          <div className="mt-20 border-t border-border pt-16 max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                What does ApplyLab evaluate?
              </h2>
              <p className="text-sm text-ink-secondary mt-1.5">
                Our AI simulation evaluates your resume across five distinct hiring dimensions:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wide">30 Max Pts</span>
                <h3 className="font-display font-bold text-ink text-base">Content Quality</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Evaluates bullet strength, metric evidence, clear ownership verbs, and substantive impact rather than vague task lists.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wide">20 Max Pts</span>
                <h3 className="font-display font-bold text-ink text-base">ATS &amp; Structure</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Checks contact completeness, Australian work rights, standard headings, and single-column parseability for Taleo, Workday, and SEEK.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wide">20 Max Pts</span>
                <h3 className="font-display font-bold text-ink text-base">Writing Quality</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Scans for active voice, brevity, eliminating generic buzzwords (&quot;hard worker&quot;, &quot;team player&quot;), and clean Australian English.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wide">15 Max Pts</span>
                <h3 className="font-display font-bold text-ink text-base">Job Optimization</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Evaluates role clarity, transferable competencies, and industry keyword alignment for your target career direction.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wide">15 Max Pts</span>
                <h3 className="font-display font-bold text-ink text-base">Application Readiness</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Audits 1–2 page length budgets, referee completeness, link hygiene, and avoids bullet repetition across roles.
                </p>
              </div>

              <div className="rounded-xl border border-accent/30 bg-accent-soft/20 p-5 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-accent uppercase tracking-wide">Integrity Guarantee</span>
                  <h3 className="font-display font-bold text-ink text-base mt-1">Recruiter Simulation</h3>
                  <p className="text-xs text-ink-secondary leading-relaxed mt-1">
                    Evaluated by our calibrated AI recruiter simulation. Zero fabricated claims or inflated scores.
                  </p>
                </div>
                <div className="pt-3">
                  <Link href="/onboarding" className="text-xs font-bold text-accent hover:underline">
                    Get started with ApplyLab &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-border bg-surface py-6 text-xs text-ink-muted">
        <Container size="marketing">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <p>
              <span className="font-bold text-ink">ApplyLab</span> &middot; &copy; {new Date().getFullYear()} &middot; The AU job-search copilot
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 font-medium">
              <Link href="/resume-score" className="text-accent font-semibold">
                Free Resume Score
              </Link>
              <Link href="/blog" className="hover:text-ink transition-colors">
                Blog
              </Link>
              <Link href="/pricing" className="hover:text-ink transition-colors">
                Pricing
              </Link>
              <Link href="/terms" className="hover:text-ink transition-colors">
                Terms &amp; Conditions
              </Link>
              <Link href="/privacy" className="hover:text-ink transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
}
