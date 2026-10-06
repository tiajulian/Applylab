import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/marketing/Container";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { MARKETING_NAV_LINKS } from "@/lib/marketing/nav";
import { PublicResumeScorer } from "@/components/marketing/PublicResumeScorer";
import { REVIEW_CATEGORIES } from "@/components/resume/review/reviewCategories";
import { Reveal } from "@/components/ui/Reveal";
import { BRAND, CTA, TIMINGS } from "@/lib/marketing/copy";

const TITLE = "Free ATS Resume Score for Australian Jobs (0–100) | ApplyLab";
const DESCRIPTION =
  "ApplyLab scores your resume out of 100 for Australian jobs: achievements, writing, fit and how easily hiring software reads it. See your score free.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/resume-score",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://applylab.io/resume-score",
    siteName: "ApplyLab",
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Point values mirror MAX_CATEGORY_POINTS in lib/resume/scoreReview.ts (not imported: that module
// pulls in the AI gateway, which this static page shouldn't bundle).
const SCORE_AREAS = [
  { key: "content_quality", points: 30 },
  { key: "ats_structure", points: 20 },
  { key: "writing_quality", points: 20 },
  { key: "job_optimization", points: 15 },
  { key: "application_readiness", points: 15 },
] as const;

// Not async, and no getCurrentUser() call: see app/page.tsx for why - the auth check now happens
// client-side (MarketingHeader, PublicResumeScorer) so this page can be served static.
export default function ResumeScorePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ApplyLab Free Resume Score",
    url: "https://applylab.io/resume-score",
    description: DESCRIPTION,
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

      <MarketingHeader navLinks={MARKETING_NAV_LINKS} activeHref="/resume-score" />

      {/* Main Scoring Section */}
      <main className="flex-1 py-12 sm:py-16">
        <Container size="marketing">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1 text-xs font-bold text-accent">
                <span>Free resume score</span>
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
                Upload your resume and get a score out of 100 in about {TIMINGS.resumeScoreSeconds} seconds. Create a free account to see exactly what to fix.
              </p>
            </Reveal>
          </div>

          {/* Interactive Public Scorer */}
          <PublicResumeScorer />

          <p className="mt-6 text-center text-sm text-ink-secondary">
            Want a resume written for a specific job?{" "}
            <Link href="/#how" className="font-semibold text-accent hover:underline">
              See how ApplyLab works
            </Link>
          </p>

          {/* What the score measures */}
          <div className="mt-20 border-t border-border pt-16 max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                What your score measures
              </h2>
              <p className="text-sm text-ink-secondary mt-1.5">
                Your resume is scored out of 100 across 5 areas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {SCORE_AREAS.map(({ key, points }) => (
                <div key={key} className="rounded-xl border border-border bg-surface p-5 space-y-2">
                  <span className="text-xs font-bold text-accent uppercase tracking-wide">{points} points</span>
                  <h3 className="font-display font-bold text-ink text-base">{REVIEW_CATEGORIES[key].label}</h3>
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    {REVIEW_CATEGORIES[key].description}
                  </p>
                </div>
              ))}

              <div className="rounded-xl border border-accent/30 bg-accent-soft/20 p-5 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-accent uppercase tracking-wide">Next step</span>
                  <h3 className="font-display font-bold text-ink text-base mt-1">Tailor it to a job</h3>
                  <p className="text-xs text-ink-secondary leading-relaxed mt-1">{BRAND.oneLiner}</p>
                </div>
                <div className="pt-3">
                  <Link href="/#how" className="text-xs font-bold text-accent hover:underline">
                    {CTA.howItWorks} &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
