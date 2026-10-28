"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { MARKETING_NAV_LINKS } from "@/lib/marketing/nav";
import { CalendarIcon, PrinterIcon } from "@/components/ui/icons/LucideIcons";

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

export function PrivacyView() {
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
      <MarketingHeader
        navLinks={MARKETING_NAV_LINKS}
        activeHref="/privacy"
        maxWidthClassName="max-w-6xl"
        className="print:hidden"
      />

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
                <CalendarIcon className="h-3.5 w-3.5" /> Last Updated: October 2026
              </span>
              <p>
                Data Officer:{" "}
                <a
                  href="mailto:applylab.support@gmail.com"
                  className="text-accent font-semibold underline hover:text-accent-hover print:text-black"
                >
                  applylab.support@gmail.com
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

              <div className="mt-6 pt-4 border-t border-border text-xs text-ink-muted leading-relaxed">
                Need a physical copy?
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-paper-deep px-2.5 py-1.5 font-bold text-ink hover:bg-border transition-colors"
                >
                  <PrinterIcon className="h-4 w-4" /> Print Policy PDF
                </button>
              </div>
            </div>
          </aside>

          {/* Right Column: Policy Content */}
          <article className="min-w-0 max-w-prose lg:col-span-9 space-y-10 sm:space-y-12 text-body text-ink-secondary leading-relaxed print:col-span-12 print:max-w-none">
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
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> To write and score your documents, we send the relevant parts of your profile, resume, job ads and interview answers to Anthropic, OpenAI and Google. They process it for us and do not use it to train their AI models.
              </div>

              <p>
                ApplyLab uses AI models from the following providers, through their paid business APIs:
              </p>

              <ul className="list-disc pl-5 sm:pl-6 space-y-2 text-ink">
                <li>
                  <strong>Anthropic (Claude) and OpenAI:</strong> resume and cover letter writing, resume scoring and review, reading job ads and uploaded resumes, and matching you to job listings.
                </li>
                <li>
                  <strong>Google (Gemini and Cloud Text-to-Speech):</strong> interview practice questions, feedback on your answers, application answer suggestions in the browser extension, and reading interview questions aloud.
                </li>
                <li>
                  <strong>Not used for training:</strong> under these providers&apos; business API terms, the data we send is <strong>not used to train or improve their AI models</strong>.
                </li>
                <li>
                  <strong>Limited retention by providers:</strong> providers may keep what we send for a limited period to detect misuse of their services, as set out in their terms, and then delete it. They may not use it for any other purpose.
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
                <li>Understanding how ApplyLab is used (which pages and features, and where people get stuck) so we can improve it, and spotting errors.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="subprocessors-data-storage" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                5. Third-Party Sub-Processors & Infrastructure
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> These are the companies that host, process or receive your data on our behalf, and what each one gets.
              </div>

              <p>
                We store and process data using vetted, enterprise-grade cloud providers adhering to SOC 2 Type II, ISO 27001, and PCI-DSS standards.
              </p>

              <div className="relative mt-4">
              <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full min-w-[500px] text-left text-sm text-ink border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-paper-deep">
                      <th className="sticky left-0 z-10 bg-paper-deep p-3 font-bold">Sub-Processor</th>
                      <th className="p-3 font-bold">Role & Purpose</th>
                      <th className="p-3 font-bold">Security / Standards</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface p-3 font-semibold">Supabase / AWS (South Korea)</td>
                      <td className="p-3 text-ink-secondary">Database hosting, authentication, user data storage</td>
                      <td className="p-3 text-ink-secondary">AES-256 at rest, TLS 1.3 in transit</td>
                    </tr>
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface p-3 font-semibold">Vercel Inc.</td>
                      <td className="p-3 text-ink-secondary">Next.js application hosting & edge runtime</td>
                      <td className="p-3 text-ink-secondary">SOC 2 Type II, ISO 27001</td>
                    </tr>
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface p-3 font-semibold">Stripe Inc.</td>
                      <td className="p-3 text-ink-secondary">Payment processing & customer billing portal</td>
                      <td className="p-3 text-ink-secondary">PCI-DSS Level 1 Compliant</td>
                    </tr>
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface p-3 font-semibold">Anthropic PBC (USA)</td>
                      <td className="p-3 text-ink-secondary">AI writing, scoring and document reading (profile, resume, job ad text)</td>
                      <td className="p-3 text-ink-secondary">Business API; not used for model training</td>
                    </tr>
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface p-3 font-semibold">OpenAI (USA)</td>
                      <td className="p-3 text-ink-secondary">AI writing and document reading; job matching (profile and job ad text)</td>
                      <td className="p-3 text-ink-secondary">Business API; not used for model training</td>
                    </tr>
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface p-3 font-semibold">Google LLC (USA)</td>
                      <td className="p-3 text-ink-secondary">Gemini for interview practice and answer suggestions; Cloud Text-to-Speech for reading questions aloud</td>
                      <td className="p-3 text-ink-secondary">Paid business API; not used for model training</td>
                    </tr>
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface p-3 font-semibold">Cloudflare Inc. (USA)</td>
                      <td className="p-3 text-ink-secondary">Turnstile bot check on sign-up, log-in and uploads (IP address and browser signals)</td>
                      <td className="p-3 text-ink-secondary">SOC 2 Type II, ISO 27001</td>
                    </tr>
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface p-3 font-semibold">PostHog Inc. (EU hosting)</td>
                      <td className="p-3 text-ink-secondary">Product analytics and error reports: pages visited, features used, browser and device type, IP address and an account ID. Never your name, email or resume content</td>
                      <td className="p-3 text-ink-secondary">Data held in the EU (GDPR)</td>
                    </tr>
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface p-3 font-semibold">Adzuna (UK)</td>
                      <td className="p-3 text-ink-secondary">Job listings for Job Matcher. Receives only the job titles you search for, never your name or contact details</td>
                      <td className="p-3 text-ink-secondary">No personal information shared</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-lg bg-gradient-to-l from-surface to-transparent sm:hidden"
                aria-hidden="true"
              />
              </div>
            </section>

            {/* Section 6 */}
            <section id="data-retention-deletion" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                6. Data Retention, Export & &quot;Right to Be Forgotten&quot;
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> You own your data. You can export your profile anytime, or delete your account and we delete your data straight away.
              </div>

              <p>
                We retain your career data for as long as your account remains active. You maintain total ownership over your information:
              </p>

              <ul className="list-disc pl-5 sm:pl-6 space-y-2">
                <li>
                  <strong>Data Export:</strong> You can export your full Master Career Profile and generated documents at any time in JSON, PDF, or editable DOCX formats.
                </li>
                <li>
                  <strong>Account Deletion:</strong> You can initiate account deletion at any time via your <Link href="/profile" className="text-accent underline font-semibold">Account settings</Link>. Upon confirmation, your account, career profile, resumes, cover letters, applications, interview practice (including question audio) and uploaded files are deleted immediately. Encrypted database backups that may still contain them are overwritten within <strong>30 days</strong>.
                </li>
                <li>
                  <strong>Free resume score without an account:</strong> if you score a resume before creating an account, we keep the result for 2 days so it can be added to your account when you sign up or log in from the score page in the same browser. If it isn&apos;t added by then, it is deleted in our next daily clean-up.
                </li>
                <li>
                  <strong>What we keep after deletion:</strong> your email address and how many free-plan uses you had made, so the free allowance can&apos;t be reset by deleting and re-creating an account. Billing records are kept by Stripe as required by tax law.
                </li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="cookies-tracking" className="scroll-mt-28 space-y-4">
              <h2 className="font-display text-h3 sm:text-h2 text-ink">
                7. Cookies & Tracking Technologies
              </h2>

              <div className="rounded-r-lg border-l-4 border-accent bg-accent-soft p-4 text-ink font-medium text-sm leading-snug print:border-black print:bg-gray-100">
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> We use cookies to keep you logged in, and one analytics tool (PostHog) to see how ApplyLab is used. We never sell your data or use cross-site ad trackers.
              </div>

              <p>
                ApplyLab uses strictly necessary session cookies required to authenticate your user session and maintain platform security.
              </p>
              <p>
                <strong>Analytics:</strong> we use PostHog to understand how ApplyLab is used, for example which pages are visited and where people stop during sign-up or checkout, and to catch errors. It stores a random identifier in a first-party cookie and your browser&apos;s local storage. Once you log in, it is linked to your account ID, never your name or email. It does not record your screen or what you type, and is not used for advertising. To have your analytics data deleted, email applylab.support@gmail.com; deleting your account does not remove it automatically.
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
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> Your data is stored overseas, in South Korea, and parts of it are processed in the United States by the providers listed in section 5.
              </div>

              <p>
                As an Australian entity, we comply with <strong>Australian Privacy Principle 8 (Cross-border disclosure of personal information)</strong>. Our operations are based in Australia, but your account data and files are stored in our database in South Korea (Amazon Web Services, Seoul region), and the other providers listed in section 5 process data in the United States, the European Union and the United Kingdom. In particular, the text sent to our AI providers (Anthropic, OpenAI and Google) is processed in the United States.
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
                <span className="font-bold text-accent print:text-black">PLAIN ENGLISH SUMMARY:</span> Have questions or privacy concerns? Email our Privacy Officer at applylab.support@gmail.com or contact the OAIC.
              </div>

              <p>
                If you have questions regarding this Privacy Policy, wish to request access to or correction of your personal information, or wish to lodge a privacy complaint, please contact our Data Privacy Officer:
              </p>

              <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 text-sm space-y-2 mt-4">
                <p className="font-bold text-ink">ApplyLab Privacy Officer</p>
                <p className="text-ink-secondary">
                  <strong>Email:</strong>{" "}
                  <a href="mailto:applylab.support@gmail.com" className="text-accent underline font-semibold">
                    applylab.support@gmail.com
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

      <Footer />
    </div>
  );
}
