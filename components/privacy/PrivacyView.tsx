"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Button } from "@/components/ui/Button";

interface PrivacyViewProps {
  userSession: {
    isLoggedIn: boolean;
    initials?: string;
  };
}

interface SectionItem {
  id: string;
  title: string;
  shortTitle: string;
}

const SECTIONS: SectionItem[] = [
  { id: "introduction", title: "1. Introduction & APPs Commitment", shortTitle: "1. Introduction" },
  { id: "information-we-collect", title: "2. Information We Collect", shortTitle: "2. Collected Data" },
  { id: "ai-data-policy", title: "3. AI & Zero-Training Guarantee", shortTitle: "3. AI Policy" },
  { id: "how-we-use-information", title: "4. How We Use Your Information", shortTitle: "4. Data Usage" },
  { id: "subprocessors-data-storage", title: "5. Sub-Processors & Infrastructure", shortTitle: "5. Sub-Processors" },
  { id: "data-retention-deletion", title: "6. Data Retention & Account Deletion", shortTitle: "6. Retention" },
  { id: "cookies-tracking", title: "7. Cookies & Tracking", shortTitle: "7. Cookies" },
  { id: "international-transfers", title: "8. International Data Transfers", shortTitle: "8. Transfers" },
  { id: "contact-complaints", title: "9. Contact & OAIC Complaints", shortTitle: "9. Contact" },
];

export function PrivacyView({ userSession }: PrivacyViewProps) {
  const [activeSection, setActiveSection] = useState<string>("introduction");

  // ScrollSpy using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      }
    );

    SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -100;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink selection:bg-accent-soft selection:text-accent print:bg-white print:text-black overflow-x-hidden">
      {/* Top Header Navigation (Hidden on print) */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-3.5">
          <Logo />

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-ink-secondary">
            <Link href="/#how-it-works" className="hover:text-ink transition-colors">
              How it works
            </Link>
            <Link href="/pricing" className="hover:text-ink transition-colors">
              Pricing
            </Link>
            <Link href="/blog" className="hover:text-ink transition-colors">
              Blog
            </Link>
            <Link href="/privacy" className="text-accent font-bold transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-ink transition-colors">
              Terms of Service
            </Link>
          </nav>

          <div className="flex items-center gap-3 text-xs font-semibold">
            {userSession.isLoggedIn ? (
              <Link
                href="/dashboard"
                aria-label="Go to your dashboard"
                title="You're logged in"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 shadow-sm"
              >
                {userSession.initials || "ME"}
              </Link>
            ) : (
              <>
                <Link href="/login" className="font-medium text-ink-secondary hover:text-ink transition-colors">
                  Log in
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="font-bold px-3.5 py-1.5 text-xs">
                    Build resume free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Layout */}
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6 sm:py-12">
        {/* Page Header */}
        <div className="border-b border-border pb-6 sm:pb-8 mb-6 sm:mb-8 print:border-black">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-accent print:border-black print:text-black">
                LEGAL & DATA PROTECTION
              </span>
              <h1 className="mt-3 font-display text-[32px] sm:text-[40px] text-ink leading-tight">
                Privacy Policy
              </h1>
            </div>

            <div className="flex flex-col sm:items-end gap-1.5 text-xs text-ink-secondary print:text-black">
              <span className="inline-flex items-center gap-1.5 font-bold rounded-md bg-paper-deep px-2.5 py-1 text-ink print:bg-transparent">
                📅 Last Updated: August 2026
              </span>
              <p>
                Data Officer:{" "}
                <a
                  href="mailto:privacy@applylab.com.au"
                  className="text-accent font-semibold underline hover:text-accent-hover print:text-black"
                >
                  privacy@applylab.com.au
                </a>
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-body text-ink-secondary">
            This Privacy Policy details how ApplyLab manages your career data, resumes, and personal information in strict compliance with the <strong>Australian Privacy Act 1988 (Cth)</strong> and the <strong>Australian Privacy Principles (APPs)</strong>.
          </p>

          {/* Mobile Section Quick-Jump Selector (Hidden on Desktop & Print) */}
          <div className="mt-6 lg:hidden print:hidden">
            <label htmlFor="mobile-toc-select" className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
              Jump to Section:
            </label>
            <select
              id="mobile-toc-select"
              value={activeSection}
              onChange={(e) => scrollToSection(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {SECTIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Two-Column Layout (Desktop TOC + Content) */}
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Left Column: Sticky Table of Contents (Hidden on mobile & print) */}
          <aside className="lg:col-span-3 hidden lg:block print:hidden">
            <div className="sticky top-24 rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">
                Contents
              </h2>
              <nav className="space-y-1 text-xs">
                {SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`block w-full text-left px-3 py-2 rounded-lg font-medium transition-all duration-fast ${
                      activeSection === section.id
                        ? "bg-accent-soft text-accent font-bold border-l-2 border-accent"
                        : "text-ink-secondary hover:text-ink hover:bg-paper"
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>

              <div className="mt-6 pt-4 border-t border-border text-[11px] text-ink-muted leading-relaxed">
                Need a physical copy?
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="mt-2 block w-full text-center rounded bg-paper-deep px-2.5 py-1.5 font-bold text-ink hover:bg-border transition-colors"
                >
                  🖨️ Print Policy PDF
                </button>
              </div>
            </div>
          </aside>

          {/* Right Column: Policy Content */}
          <article className="lg:col-span-9 space-y-10 sm:space-y-12 text-body text-ink-secondary leading-relaxed print:col-span-12">
            {/* Section 1 */}
            <section id="introduction" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                1. Introduction & Australian Privacy Principles (APPs) Commitment
              </h2>

              {/* Plain English Box */}
              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> We take your personal data seriously. We only collect what is strictly necessary to build your resumes, match job ads, and prepare you for interviews.
              </div>

              <p>
                ApplyLab (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the AI Job Application Copilot service. We are committed to protecting the privacy of job seekers, candidates, and visitors. This Privacy Policy sets out how we collect, hold, use, disclosure, and protect your personal information in accordance with the <strong>Privacy Act 1988 (Cth)</strong> and the 13 <strong>Australian Privacy Principles (APPs)</strong>.
              </p>
              <p>
                By creating an account, uploading career history, pasting job descriptions, or using ApplyLab, you consent to the data practices described in this policy.
              </p>
            </section>

            {/* Section 2 */}
            <section id="information-we-collect" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                2. Information We Collect
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> We collect your account details, employment history, target job ads, and payment info to deliver our career services.
              </div>

              <p>
                To provide tailored resumes, Australian standard cover letters, and interview coaching, we collect the following categories of personal information:
              </p>

              <div className="space-y-3 pl-0 sm:pl-2">
                <div className="rounded-lg border border-border bg-surface p-4">
                  <h3 className="font-bold text-ink text-body">A. Account & Contact Information</h3>
                  <p className="text-sm text-ink-secondary mt-1">
                    Your full name, email address, password hash, and OAuth authentication tokens (e.g. Google Sign-In IDs).
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface p-4">
                  <h3 className="font-bold text-ink text-body">B. Master Career Profile & Professional Data</h3>
                  <p className="text-sm text-ink-secondary mt-1">
                    Employment history (role titles, company names, dates of employment, responsibilities, bulleted achievements), educational background, formal qualifications, licenses, skills repository, contact phone numbers, addresses, and any uploaded resume documents (PDF, DOCX).
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface p-4">
                  <h3 className="font-bold text-ink text-body">C. Job Application Data</h3>
                  <p className="text-sm text-ink-secondary mt-1">
                    Target job descriptions pasted or imported from SEEK, LinkedIn, or employer portals, extracted key selection criteria, generated tailored resumes, cover letters, and practice interview responses.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface p-4">
                  <h3 className="font-bold text-ink text-body">D. Billing & Transaction Information</h3>
                  <p className="text-sm text-ink-secondary mt-1">
                    Subscription status, tier history, and transaction receipts. All payment transactions are processed securely via <strong>Stripe Inc.</strong> Raw credit card numbers are never stored on ApplyLab servers.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface p-4">
                  <h3 className="font-bold text-ink text-body">E. Technical & Telemetry Data</h3>
                  <p className="text-sm text-ink-secondary mt-1">
                    IP addresses, browser type, device information, operating system, and authentication session cookies strictly required for platform operation.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="ai-data-policy" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                3. How We Use Artificial Intelligence & Third-Party LLMs
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> Your resume and career history are NEVER used to train public or commercial AI models. We use zero-retention enterprise API endpoints.
              </div>

              <p>
                Because ApplyLab is an AI-powered platform, we enforce strict, ironclad data protection guarantees regarding Large Language Models (LLMs):
              </p>

              <ul className="list-disc pl-5 sm:pl-6 space-y-2 text-ink">
                <li>
                  <strong>Strict Zero-Data Training Guarantee:</strong> Your personal information, work history, uploaded resumes, and interview responses are <strong>NEVER used to train, retrain, or fine-tune public foundation models</strong> (including OpenAI, Anthropic, or Google AI models).
                </li>
                <li>
                  <strong>Enterprise API Contracts:</strong> We process prompt data exclusively via enterprise API endpoints bound by commercial agreements that mandate zero data retention for model training purposes.
                </li>
                <li>
                  <strong>Strict Fact Grounding (Anti-Hallucination):</strong> Our proprietary system prompts require AI model outputs to strictly reference verified facts from your Master Career Profile.
                </li>
                <li>
                  <strong>No Autonomous Legal or Employment Decisions:</strong> ApplyLab tools generate draft content for your review. You retain full editorial control over every resume and application document prior to submission.
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="how-we-use-information" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                4. How We Use Your Information
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> We only use your data to generate your resumes, cover letters, ATS scores, and interview prep, never to profile or advertise to you.
              </div>

              <p>We use your personal information solely for the following business purposes:</p>
              <ul className="list-disc pl-5 sm:pl-6 space-y-2">
                <li>Generating 1-page ATS-optimized resumes and Australian-tailored cover letters.</li>
                <li>Parsing SEEK and LinkedIn job ads to extract selection criteria and calculate match percentages.</li>
                <li>Generating role-specific STAR method interview practice questions and feedback scores.</li>
                <li>Processing subscription payments and managing account billing via Stripe.</li>
                <li>Sending critical technical service updates, security notifications, and billing receipts.</li>
                <li>Preventing platform abuse, fraudulent transactions, and unauthorized access.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="subprocessors-data-storage" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                5. Third-Party Sub-Processors & Infrastructure
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> We partner with industry-leading infrastructure providers like Supabase, Vercel, and Stripe with bank-grade encryption.
              </div>

              <p>
                We store and process data using vetted, enterprise-grade cloud providers adhering to SOC 2 Type II, ISO 27001, and PCI-DSS standards.
              </p>

              <div className="overflow-x-auto rounded-lg border border-border bg-surface mt-4">
                <table className="w-full min-w-[500px] text-left text-sm text-ink border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-paper-deep">
                      <th className="p-3 font-bold">Sub-Processor</th>
                      <th className="p-3 font-bold">Role & Purpose</th>
                      <th className="p-3 font-bold">Security / Standards</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="p-3 font-semibold">Supabase / AWS</td>
                      <td className="p-3 text-ink-secondary">Database hosting, authentication, user data storage</td>
                      <td className="p-3 text-ink-secondary">AES-256 at rest, TLS 1.3 in transit</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">Vercel Inc.</td>
                      <td className="p-3 text-ink-secondary">Next.js application hosting & edge runtime</td>
                      <td className="p-3 text-ink-secondary">SOC 2 Type II, ISO 27001</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">Stripe Inc.</td>
                      <td className="p-3 text-ink-secondary">Payment processing & customer billing portal</td>
                      <td className="p-3 text-ink-secondary">PCI-DSS Level 1 Compliant</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">Enterprise AI Vendors</td>
                      <td className="p-3 text-ink-secondary">Prompt processing for resume tailoring & interview prep</td>
                      <td className="p-3 text-ink-secondary">Zero Data Retention (ZDR) APIs</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 6 */}
            <section id="data-retention-deletion" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                6. Data Retention, Export & &quot;Right to Be Forgotten&quot;
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> You own your data. You can export your profile anytime or delete your account to permanently purge all data within 30 days.
              </div>

              <p>
                We retain your career data for as long as your account remains active. You maintain total ownership over your information:
              </p>

              <ul className="list-disc pl-5 sm:pl-6 space-y-2">
                <li>
                  <strong>Data Export:</strong> You can export your full Master Career Profile and generated documents at any time in JSON, PDF, or editable DOCX formats.
                </li>
                <li>
                  <strong>Account Deletion:</strong> You can initiate account deletion at any time via your <Link href="/settings" className="text-accent underline font-semibold">Settings Page</Link>. Upon confirmation, all your personal data, career profile entries, resume drafts, and cover letters will be permanently purged from our active databases within <strong>30 days</strong>.
                </li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="cookies-tracking" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                7. Cookies & Tracking Technologies
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> We only use essential cookies to keep you logged in securely. We never sell your data or use cross-site ad trackers.
              </div>

              <p>
                ApplyLab uses strictly necessary session cookies required to authenticate your user session and maintain platform security.
              </p>
              <p>
                <strong>Zero Selling of Personal Data:</strong> We do not sell, rent, or trade your personal information or resume contents to third-party data brokers, advertisers, or recruitment agencies.
              </p>
            </section>

            {/* Section 8 */}
            <section id="international-transfers" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                8. International Data Transfers (APP 8 Compliance)
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> Your data is stored in secure, encrypted cloud data centers compliant with Australian Privacy Principle 8.
              </div>

              <p>
                As an Australian entity, we comply with <strong>Australian Privacy Principle 8 (Cross-border disclosure of personal information)</strong>. While our primary operations are based in Australia, our encrypted cloud sub-processors operate secure data centers in Australia, the United States, and the European Union.
              </p>
              <p>
                Before disclosing personal information to overseas cloud recipients, we ensure that overseas recipients are bound by contractually enforceable obligations to uphold privacy standards substantially similar to the APPs.
              </p>
            </section>

            {/* Section 9 */}
            <section id="contact-complaints" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                9. Contact Information & Privacy Complaints
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> Have questions or privacy concerns? Email our Privacy Officer at privacy@applylab.com.au or contact the OAIC.
              </div>

              <p>
                If you have questions regarding this Privacy Policy, wish to request access to or correction of your personal information, or wish to lodge a privacy complaint, please contact our Data Privacy Officer:
              </p>

              <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 text-sm space-y-2 mt-4">
                <p className="font-bold text-ink">ApplyLab Privacy Officer</p>
                <p className="text-ink-secondary">
                  <strong>Email:</strong>{" "}
                  <a href="mailto:privacy@applylab.com.au" className="text-accent underline font-semibold">
                    privacy@applylab.com.au
                  </a>
                </p>
                <p className="text-ink-secondary">
                  <strong>Address:</strong> ApplyLab Privacy Office, Sydney NSW, Australia
                </p>
              </div>

              <h3 className="font-bold text-ink text-body mt-6">Escalation to OAIC</h3>
              <p className="text-sm">
                If you are not satisfied with our response to a privacy complaint, you may escalate your matter to the <strong>Office of the Australian Information Commissioner (OAIC)</strong>:
              </p>
              <ul className="list-disc pl-5 sm:pl-6 space-y-1 text-sm">
                <li>
                  <strong>Website:</strong>{" "}
                  <a
                    href="https://www.oaic.gov.au"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline font-semibold"
                  >
                    www.oaic.gov.au
                  </a>
                </li>
                <li>
                  <strong>Phone:</strong> 1300 363 992
                </li>
              </ul>
            </section>
          </article>
        </div>
      </main>

      {/* Footer (Hidden on print) */}
      <footer className="border-t border-border bg-surface py-8 text-xs text-ink-secondary print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row text-center sm:text-left">
          <Logo />
          <p>© {new Date().getFullYear()} ApplyLab. All rights reserved. Built for Australian job seekers.</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <Link href="/blog" className="hover:text-ink transition-colors">Blog</Link>
            <Link href="/pricing" className="hover:text-ink transition-colors">Pricing</Link>
            <Link href="/privacy" className="hover:text-ink transition-colors font-bold text-accent">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
