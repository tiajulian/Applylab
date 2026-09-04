"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";

interface TemplateItem {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  fontFamily: string;
  accentColor: string;
  headerLayout: "centered" | "left" | "split";
}

const TEMPLATES: TemplateItem[] = [
  {
    id: "clean",
    name: "Clean",
    tagline: "Ultra-scannable ATS classic for corporate and public sector.",
    badge: "Most popular",
    fontFamily: "font-sans",
    accentColor: "text-ink",
    headerLayout: "left",
  },
  {
    id: "classic",
    name: "Classic",
    tagline: "Timeless serif typography for law, finance, and consulting.",
    badge: "Traditional",
    fontFamily: "font-serif",
    accentColor: "text-ink",
    headerLayout: "centered",
  },
  {
    id: "modern",
    name: "Modern",
    tagline: "Contemporary layout with subtle warm accent styling.",
    badge: "Design-forward",
    fontFamily: "font-sans",
    accentColor: "text-accent",
    headerLayout: "split",
  },
  {
    id: "compact",
    name: "Compact",
    tagline: "Engineered for deep 10+ year careers on a single page.",
    badge: "Dense",
    fontFamily: "font-sans",
    accentColor: "text-ink",
    headerLayout: "left",
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Publication-grade hierarchy for senior leaders and directors.",
    badge: "Executive",
    fontFamily: "font-serif",
    accentColor: "text-accent",
    headerLayout: "split",
  },
  {
    id: "technical",
    name: "Technical",
    tagline: "Structured for developers, analysts, and engineers.",
    badge: "Skills-first",
    fontFamily: "font-mono",
    accentColor: "text-ink",
    headerLayout: "left",
  },
  {
    id: "executive",
    name: "Executive",
    tagline: "High-impact framing for C-suite and department heads.",
    badge: "Leadership",
    fontFamily: "font-serif",
    accentColor: "text-ink",
    headerLayout: "centered",
  },
  {
    id: "minimal",
    name: "Minimal",
    tagline: "Stripped-back purity: zero decorative lines or fluff.",
    badge: "Pure ATS",
    fontFamily: "font-sans",
    accentColor: "text-ink",
    headerLayout: "left",
  },
];

export function TemplatesSection() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem>(TEMPLATES[0]);

  return (
    <section id="templates" className="sec band">
      <Container size="marketing">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Eight ATS-Safe Templates
            </span>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              What you actually get, shown not described.
            </h2>
            <p className="mt-4 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed max-w-2xl mx-auto">
              Every template is engineered to fit one A4 page, pass Australian ATS parsers cleanly, and export as both a pixel-perfect PDF and an editable Word document.
            </p>
          </Reveal>
        </div>

        {/* Template Selector Pills (Horizontal scroller on mobile, centered flex on desktop) */}
        <Reveal delay={0.1}>
          <div className="mt-8 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap sm:justify-center no-scrollbar">
            {TEMPLATES.map((tmpl) => {
              const isActive = tmpl.id === selectedTemplate.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={`relative rounded-pill px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "bg-ink text-paper shadow-sm"
                      : "bg-surface border border-border text-ink-secondary hover:text-ink hover:bg-paper-deep"
                  }`}
                >
                  <span>{tmpl.name}</span>
                  {tmpl.badge && (
                    <span
                      className={`ml-1.5 text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded ${
                        isActive
                          ? "bg-white/20 text-paper"
                          : "bg-paper-deep text-ink-muted"
                      }`}
                    >
                      {tmpl.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* Template Sheet Display Container */}
        <Reveal delay={0.16}>
          <div className="mt-10 mx-auto max-w-4xl">
            {/* Sheet Sub-bar: shows active template details */}
            <div className="flex items-center justify-between px-2 pb-3 text-xs text-ink-muted">
              <div>
                <span className="font-bold text-ink">{selectedTemplate.name} Template</span>
                <span className="hidden sm:inline"> &middot; {selectedTemplate.tagline}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-success font-semibold shrink-0">
                <CheckIcon className="w-3.5 h-3.5 text-success" />
                <span>Strict 1-Page A4 Fit</span>
              </div>
            </div>

            {/* A4 Sheet Viewer (fills ~85% height with full realistic content, Bug 7 fix) */}
            <div className="market-card p-6 sm:p-10 lg:p-12 bg-surface overflow-hidden shadow-pop">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedTemplate.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className={`text-[12px] leading-[1.6] text-ink ${selectedTemplate.fontFamily}`}
                >
                  {/* Sheet Header */}
                  <div
                    className={`border-b border-border pb-4 ${
                      selectedTemplate.headerLayout === "centered"
                        ? "text-center"
                        : selectedTemplate.headerLayout === "split"
                        ? "flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2"
                        : "text-left"
                    }`}
                  >
                    <div>
                      <h3
                        className={`text-2xl sm:text-3xl font-bold tracking-tight ${selectedTemplate.accentColor}`}
                      >
                        Alexander Wright
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-ink-secondary">
                        Senior Product Operations Manager
                      </p>
                    </div>
                    <div className="text-[11px] text-ink-muted font-mono space-y-0.5">
                      <p>Sydney NSW 2000 &middot; 0418 392 481</p>
                      <p>alex.wright@email.com.au &middot; AU Citizen</p>
                    </div>
                  </div>

                  {/* Professional Summary */}
                  <div className="mt-4 border-b border-border/80 pb-4">
                    <p className="font-bold uppercase tracking-wider text-[10.5px] text-ink-muted mb-1.5">
                      Executive Summary
                    </p>
                    <p className="text-ink-secondary leading-relaxed">
                      Cross-functional operations leader with 7+ years scaling operational platforms, leading vendor integrations, and automating workflows across Australian enterprise SaaS. Proven track record reducing cycle times by 38% and managing multidisciplinary teams of up to 18 staff.
                    </p>
                  </div>

                  {/* Core Skills Matrix */}
                  <div className="mt-4 border-b border-border/80 pb-4">
                    <p className="font-bold uppercase tracking-wider text-[10.5px] text-ink-muted mb-1.5">
                      Core Competencies
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1 gap-x-4 text-[11px] text-ink-secondary">
                      <p>&bull; Process Optimisation &amp; Six Sigma</p>
                      <p>&bull; Stakeholder Management</p>
                      <p>&bull; Jira &amp; Confluence Administration</p>
                      <p>&bull; Financial Reconciliation &amp; TCO</p>
                      <p>&bull; SQL &amp; Metabase Analytics</p>
                      <p>&bull; Change Management (Prosci)</p>
                    </div>
                  </div>

                  {/* Work Experience */}
                  <div className="mt-4 border-b border-border/80 pb-4 space-y-4">
                    <p className="font-bold uppercase tracking-wider text-[10.5px] text-ink-muted">
                      Professional Experience
                    </p>

                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between font-semibold">
                        <span className="text-ink">
                          Lead Operations Specialist &middot; Macquarie Technology Group
                        </span>
                        <span className="text-[11px] font-mono text-ink-muted">
                          2021 : Present &middot; Sydney
                        </span>
                      </div>
                      <ul className="mt-1.5 space-y-1.5 pl-4 list-disc text-ink-secondary">
                        <li>
                          Standardised enterprise workflow intake across 4 departments, reducing cross-team turnaround times from 5 business days to 1.8 days.
                        </li>
                        <li>
                          Spearheaded the migration of 14,000 legacy records into a modern cloud CRM with zero data loss or operational disruption.
                        </li>
                        <li>
                          Directly managed 6 shift team leads, implementing weekly OKR reviews and improving team retention by 22% over 18 months.
                        </li>
                      </ul>
                    </div>

                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between font-semibold">
                        <span className="text-ink">
                          Operations Analyst &middot; Woolworths Digital
                        </span>
                        <span className="text-[11px] font-mono text-ink-muted">
                          2018 : 2021 &middot; Surry Hills
                        </span>
                      </div>
                      <ul className="mt-1.5 space-y-1.5 pl-4 list-disc text-ink-secondary">
                        <li>
                          Built automated supply tracking dashboards in Metabase, monitoring real-time dispatch fulfillment across 42 fulfillment centres.
                        </li>
                        <li>
                          Resolved tier-2 supplier escalation tickets independently with a 99.4% SLA adherence rate over 24 consecutive months.
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Education & Credentials */}
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-ink-muted">
                    <div>
                      <span className="font-bold text-ink">Bachelor of Commerce (Management)</span> &middot; University of New South Wales
                    </div>
                    <div>Referees available upon request</div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
