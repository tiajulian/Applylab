"use client";

import { useState } from "react";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

interface IndustryData {
  id: string;
  label: string;
  icon: string;
  keywords: string[];
  sampleBullet: string;
}

const INDUSTRIES: IndustryData[] = [
  {
    id: "banking",
    label: "Banking & Finance",
    icon: "🏦",
    keywords: ["APRA Compliance", "AML/CTF", "Financial Modelling", "Stakeholder Governance", "Risk Assessment"],
    sampleBullet: "Managed APRA regulatory compliance reporting across 12 product lines, reducing quarterly audit turnaround by 4 days.",
  },
  {
    id: "retail",
    label: "Retail & Customer Service",
    icon: "🛍️",
    keywords: ["POS Operations", "Inventory Reconciliations", "NPS Improvement", "Visual Merchandising", "Shift Leadership"],
    sampleBullet: "Led a floor team of 15 staff, elevating store Net Promoter Score (NPS) from +42 to +68 in 6 months.",
  },
  {
    id: "healthcare",
    label: "Healthcare & Nursing",
    icon: "🏥",
    keywords: ["AHPRA Registration", "Patient Care Plans", "Triage Assessment", "Medication Administration", "EMR Documentation"],
    sampleBullet: "Coordinated patient triage and care plans for 30+ daily admissions in a high-volume emergency ward.",
  },
  {
    id: "tech",
    label: "Tech & Data",
    icon: "💻",
    keywords: ["AWS / Cloud Architecture", "SQL & Python", "Agile / Scrum", "CI/CD Pipelines", "System Reliability"],
    sampleBullet: "Engineered scalable Python microservices on AWS, maintaining 99.95% uptime during peak load periods.",
  },
  {
    id: "ops",
    label: "Operations & Admin",
    icon: "📋",
    keywords: ["Process Automation", "Executive Support", "Vendor Negotiations", "Budget Tracking", "Workflow Optimisation"],
    sampleBullet: "Automated monthly vendor invoice reconciliation in Excel, cutting processing time by 15 hours per week.",
  },
  {
    id: "trades",
    label: "Trades & Logistics",
    icon: "🏗️",
    keywords: ["WHS Standards", "Fleet Dispatch", "Supply Chain Logistics", "Site Management", "Equipment Safety"],
    sampleBullet: "Supervised site WHS compliance across 5 active commercial projects with zero lost-time injuries (LTI).",
  },
];

export function IndustryPillsBanner() {
  const [selectedId, setSelectedId] = useState<string>("banking");

  const selectedIndustry = INDUSTRIES.find((i) => i.id === selectedId) ?? INDUSTRIES[0];

  return (
    <section className="border-y border-border bg-paper-deep/60 py-10">
      <Container size="5xl" className="flex flex-col items-center text-center">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Tailored for hiring systems across Australian industries:
          </p>
        </Reveal>

        {/* Industry Pill Chips */}
        <Reveal delay={0.06}>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {INDUSTRIES.map((ind) => {
              const isSelected = ind.id === selectedId;
              return (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => setSelectedId(ind.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-fast ${
                    isSelected
                      ? "bg-accent text-on-accent shadow-sm scale-105"
                      : "bg-surface border border-border text-ink-secondary hover:border-accent/40 hover:text-ink"
                  }`}
                >
                  <span>{ind.icon}</span>
                  <span>{ind.label}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* Dynamic Sector Match Card */}
        <Reveal delay={0.12}>
          <div className="mt-6 w-full max-w-2xl rounded-xl border border-border bg-surface p-4 text-left shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <span className="text-xs font-bold text-ink">
                {selectedIndustry.icon} {selectedIndustry.label} ATS Keywords
              </span>
              <span className="rounded bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                Optimised for SEEK & Workday
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedIndustry.keywords.map((kw) => (
                <span key={kw} className="rounded border border-accent/20 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  ✓ {kw}
                </span>
              ))}
            </div>

            <p className="mt-3 text-xs italic text-ink-secondary">
              &ldquo;{selectedIndustry.sampleBullet}&rdquo;
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
