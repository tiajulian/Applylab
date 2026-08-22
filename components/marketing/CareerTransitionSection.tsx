"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { CAREER_TRANSITIONS } from "@/lib/marketingBridgeData";
import { AnimatePresence, motion } from "framer-motion";

export function CareerTransitionSection() {
  const [activeTabId, setActiveTabId] = useState("retail-ops");

  const activeTransition = CAREER_TRANSITIONS.find((t) => t.id === activeTabId) || CAREER_TRANSITIONS[0];

  return (
    <section className="py-20 bg-paper-deep/40">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Career Transitions Made Simple
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Your next role doesn&rsquo;t have to look like your last one.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              ApplyLab finds the experience you&rsquo;ve already gained that matters for the role you&rsquo;re applying for.
            </p>
          </Reveal>
        </div>

        {/* Tab Selection */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {CAREER_TRANSITIONS.map((transition) => {
            const isSelected = transition.id === activeTabId;
            return (
              <button
                key={transition.id}
                type="button"
                onClick={() => setActiveTabId(transition.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-accent text-on-accent shadow-sm"
                    : "bg-surface border border-border text-ink-secondary hover:text-ink hover:border-border-strong"
                }`}
              >
                {transition.label}
              </button>
            );
          })}
        </div>

        {/* Tab Detail View */}
        <div className="mt-8 mx-auto max-w-4xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTransition.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="rounded-2xl border border-border bg-surface p-6 shadow-pop sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between border-b border-border pb-4 gap-2">
                <div>
                  <span className="text-xs font-semibold text-ink-muted">Targeting role transition:</span>
                  <p className="font-display text-xl font-bold text-ink">
                    {activeTransition.fromRole} <span className="text-accent">&rarr;</span> {activeTransition.toRole}
                  </p>
                </div>
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
                  Transferable Skills Pipeline
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Previous Role Experience */}
                <div className="rounded-xl border border-border bg-paper p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    1. Past Experience
                  </span>
                  <p className="mt-3 text-xs sm:text-sm font-medium text-ink italic leading-relaxed">
                    &ldquo;{activeTransition.sourceExperience}&rdquo;
                  </p>
                </div>

                {/* ApplyLab Identifies */}
                <div className="rounded-xl border border-accent/20 bg-accent-soft/30 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-accent">
                    2. ApplyLab Identifies
                  </span>
                  <ul className="mt-3 flex flex-col gap-1.5 text-xs text-ink">
                    {activeTransition.identifiedSkills.map((skill) => (
                      <li key={skill} className="flex items-center gap-1.5 font-medium">
                        <span className="text-accent">&#10003;</span> {skill}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Relevant for Target Role */}
                <div className="rounded-xl border border-success/20 bg-success-soft/20 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-success">
                    3. Target Role Match
                  </span>
                  <ul className="mt-3 flex flex-col gap-1.5 text-xs text-ink">
                    {activeTransition.targetRequirements.map((req) => (
                      <li key={req} className="flex items-center gap-1.5 font-medium text-success">
                        <span>🎯</span> {req}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Resulting Resume Bullet */}
              <div className="mt-6 rounded-xl border border-success/30 bg-success-soft/30 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-success">
                  Resulting Resume Bullet:
                </span>
                <p className="mt-2 font-sans text-xs sm:text-sm font-semibold text-ink leading-relaxed">
                  • {activeTransition.resumeBullet}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}
