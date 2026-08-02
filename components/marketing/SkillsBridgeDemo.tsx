"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { clsx } from "@/lib/utils";
import { EASE, staggerContainer, staggerItem } from "@/lib/motion";
import { BRIDGE_PERSONAS } from "@/lib/marketingBridgeData";

function Arrow({ vertical = false }: { vertical?: boolean }) {
  return (
    <svg
      className={clsx("shrink-0 text-ink-muted", vertical ? "h-4 w-4 rotate-90 sm:rotate-0" : "h-4 w-4")}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 8h11M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SkillsBridgeDemo() {
  const [personaId, setPersonaId] = useState(BRIDGE_PERSONAS[0].id);
  const reduceMotion = useReducedMotion();
  const persona = BRIDGE_PERSONAS.find((p) => p.id === personaId) ?? BRIDGE_PERSONAS[0];

  return (
    <div className="w-full">
      <div
        role="group"
        aria-label="Choose your starting point"
        className="flex flex-wrap items-center justify-center gap-2"
      >
        {BRIDGE_PERSONAS.map((p) => {
          const selected = p.id === persona.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPersonaId(p.id)}
              className={clsx(
                "rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-[background-color,color,border-color,transform] duration-fast ease-editorial",
                "hover:-translate-y-px active:translate-y-px",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                selected
                  ? "border-accent bg-accent text-on-accent shadow-sm"
                  : "border-border-strong bg-surface text-ink-secondary hover:bg-accent-soft hover:text-accent"
              )}
            >
              {p.pillLabel}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="sr-only">
        Showing the skills bridge for {persona.pillLabel}, targeting a {persona.targetRole} role.
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        What you did <span className="mx-1.5 text-ink-muted">&rarr;</span> what it proves{" "}
        <span className="mx-1.5 text-ink-muted">&rarr;</span> what{" "}
        <span className="font-medium text-ink-secondary">{persona.targetRole}</span> asks for
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={persona.id}
          initial={reduceMotion ? undefined : "hidden"}
          animate="visible"
          exit={reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
          variants={reduceMotion ? undefined : staggerContainer(0.08, 0.05)}
          className="mt-5 flex flex-col gap-3"
        >
          {persona.steps.map((step) => (
            <motion.div
              key={step.task}
              variants={reduceMotion ? undefined : staggerItem}
              className="flex flex-col items-stretch gap-2 rounded-sm border border-border bg-surface p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4"
            >
              <div className="flex-1 rounded-sm bg-paper-deep px-3 py-2 text-sm text-ink-secondary">
                {step.task}
              </div>
              <div className="flex items-center justify-center sm:px-1">
                <Arrow vertical />
              </div>
              <div className="flex-1 rounded-sm bg-accent-soft px-3 py-2 text-sm font-medium text-accent">
                {step.competency}
              </div>
              <div className="flex items-center justify-center sm:px-1">
                <Arrow vertical />
              </div>
              <div className="flex flex-1 items-center gap-1.5 rounded-sm bg-success-soft px-3 py-2 text-sm text-ink">
                <span className="text-success" aria-hidden="true">
                  ✓
                </span>
                {step.requirement}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      <TransformLine before={persona.transform.before} after={persona.transform.after} personaId={persona.id} />
    </div>
  );
}

function TransformLine({
  before,
  after,
  personaId,
}: {
  before: string;
  after: string;
  personaId: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mt-6 rounded border border-border-strong bg-paper-deep p-4 sm:p-5">
      <p className="text-meta font-medium uppercase tracking-wide text-ink-muted">Watch a line transform</p>
      <AnimatePresence mode="wait">
        <motion.div
          key={personaId}
          initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="mt-3 flex flex-col gap-2"
        >
          <p className="text-sm text-ink-muted line-through decoration-ink-muted/50">{before}</p>
          <div className="flex items-center gap-2 text-accent">
            <svg className="h-3.5 w-3.5 rotate-90" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2 8h11M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-ink">{after}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
