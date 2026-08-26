"use client";

import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

const EXTENSION_FEATURES = [
  {
    title: "1-Click Form Autofill",
    desc: "Instantly fills name, email, Australian mobile (04xx xxx xxx), residential address, and AU work rights.",
    icon: "⚡",
    badge: "SEEK & Workday",
  },
  {
    title: "Direct PDF Attachment",
    desc: "Injects your active tailored resume PDF directly into portal file upload fields without manual drag-and-drop.",
    icon: "📄",
    badge: "Binary Upload",
  },
  {
    title: "STAR Screening Assistant",
    desc: "Generates grounded, role-specific STAR answers for employer screening questions directly inside portal textareas.",
    icon: "🪄",
    badge: "In-Browser AI",
  },
  {
    title: "1-Click Tracker Logging",
    desc: "Captures job title, company, salary range, and application date straight to your ApplyLab Kanban board.",
    icon: "📊",
    badge: "Auto-Sync",
  },
];

const SUPPORTED_PLATFORMS = [
  { name: "SEEK", badge: "Live Adaptor" },
  { name: "LinkedIn Australia", badge: "Live Adaptor" },
  { name: "Workday", badge: "Enterprise Portal" },
  { name: "PageUp", badge: "AU Govt & Uni" },
  { name: "LiveHire", badge: "Live Adaptor" },
];

export function ExtensionCopilotSection() {
  return (
    <section id="extension-copilot" className="scroll-mt-24 border-t border-border bg-paper-deep/60 py-20">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Pillar 4 &middot; Application Co-Pilot (Chrome Extension)
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Apply without the copy-paste marathon.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Applying for jobs in Australia usually means retyping your work history twenty times. The ApplyLab Chrome extension brings your verified profile directly to SEEK, LinkedIn, Workday, and PageUp.
            </p>
          </Reveal>
        </div>

        {/* Extension Interactive Visual Mockup */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Feature Highlights */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {EXTENSION_FEATURES.map((item, idx) => (
              <Reveal key={item.title} delay={idx * 0.06}>
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-accent/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.icon}</span>
                      <h3 className="font-display text-sm font-bold text-ink">{item.title}</h3>
                    </div>
                    <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                      {item.badge}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    {item.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Right Column: In-Browser Extension Mockup */}
          <div className="lg:col-span-7">
            <Reveal delay={0.16}>
              <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-pop">
                {/* Browser Tab Simulation */}
                <div className="flex items-center gap-2 border-b border-border pb-3 text-xs text-ink-muted">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-critical/50" />
                    <div className="h-3 w-3 rounded-full bg-attention/50" />
                    <div className="h-3 w-3 rounded-full bg-success/50" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] text-ink-secondary">
                    https://www.seek.com.au/job/apply/operations-coordinator
                  </span>
                </div>

                {/* Simulated Portal Form with Floating Copilot */}
                <div className="relative mt-4 rounded-xl border border-border bg-paper p-5">
                  <div className="space-y-3 opacity-90">
                    <div>
                      <label className="text-[11px] font-bold text-ink-secondary uppercase">
                        Phone Number
                      </label>
                      <div className="mt-1 flex items-center justify-between rounded border border-border bg-surface px-3 py-1.5 text-xs text-ink">
                        <span>0412 345 678</span>
                        <span className="text-[10px] text-success font-semibold">✓ Filled</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-ink-secondary uppercase">
                        Australian Work Rights
                      </label>
                      <div className="mt-1 flex items-center justify-between rounded border border-border bg-surface px-3 py-1.5 text-xs text-ink">
                        <span>Australian Citizen / Permanent Resident</span>
                        <span className="text-[10px] text-success font-semibold">✓ Filled</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-ink-secondary uppercase">
                        Resume Upload
                      </label>
                      <div className="mt-1 flex items-center justify-between rounded border border-success/30 bg-success-soft/30 px-3 py-1.5 text-xs text-ink font-medium">
                        <span>📄 Tia_Julian_Resume_Operations.pdf</span>
                        <span className="text-[10px] text-success font-bold">✓ Attached (Auto)</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-ink-secondary uppercase">
                        Screening Question: Describe a time you resolved an operational bottleneck.
                      </label>
                      <div className="mt-1 rounded border border-border bg-surface p-2.5 text-xs text-ink leading-relaxed">
                        <span className="text-[10px] font-bold text-accent">STAR Answer (Generated from profile):</span>
                        <p className="mt-0.5 text-ink-secondary italic">
                          &ldquo;Situation: As Retail Shift Supervisor, weekend stock replenishments caused 40-minute register delays. Action: Redesigned shelf indexing protocols. Result: Cut retrieval cycle times by 35% with zero inventory discrepancies.&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Floating ApplyLab Co-Pilot Bar (Bottom Right Overlay) */}
                  <div className="mt-4 rounded-xl border border-accent bg-surface p-3.5 shadow-lg">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
                          ⚡
                        </span>
                        <span className="text-xs font-bold text-ink">
                          ApplyLab Co-Pilot Active
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success border border-success/30">
                          SEEK Form Detected
                        </span>
                        <span className="rounded bg-accent px-2.5 py-1 text-[11px] font-bold text-on-accent">
                          Autofilled &amp; Logged ✓
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Supported Australian Job Platforms */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-[11px] font-semibold text-ink-muted">Supported Platforms:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SUPPORTED_PLATFORMS.map((p) => (
                      <span
                        key={p.name}
                        className="rounded-full border border-border bg-paper px-2.5 py-0.5 text-[10px] font-medium text-ink-secondary"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
