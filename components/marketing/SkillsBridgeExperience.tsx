"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/marketing/Container";
import { clsx } from "@/lib/utils";
import { EASE, staggerContainer, staggerItem } from "@/lib/motion";
import { BRIDGE_PERSONAS, GENERIC_PAIRS, type BridgePersona } from "@/lib/marketingBridgeData";

const AUTOPLAY_MS = 3800;

export function SkillsBridgeExperience() {
  const [personaIdx, setPersonaIdx] = useState(0);
  const [customText, setCustomText] = useState("");
  const [usingCustom, setUsingCustom] = useState(false);
  const [transformIdx, setTransformIdx] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const reduceMotion = useReducedMotion();

  const basePersona = BRIDGE_PERSONAS[personaIdx];
  const activePersona: BridgePersona = usingCustom
    ? {
        id: "custom",
        label: customText.trim() || "your background",
        role: "any role you are aiming for",
        pairs: GENERIC_PAIRS,
      }
    : basePersona;

  useEffect(() => {
    if (reduceMotion || !autoplay) return;
    const id = setInterval(() => {
      setTransformIdx((current) => (current + 1) % activePersona.pairs.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [autoplay, reduceMotion, activePersona.pairs.length]);

  function selectPersona(index: number) {
    setPersonaIdx(index);
    setUsingCustom(false);
    setCustomText("");
    setTransformIdx(0);
    setAutoplay(true);
  }

  function handleCustomSubmit(event: FormEvent) {
    event.preventDefault();
    if (!customText.trim()) return;
    setUsingCustom(true);
    setTransformIdx(0);
    setAutoplay(true);
  }

  const activeTransform = activePersona.pairs[transformIdx % activePersona.pairs.length];
  const rowsKey = activePersona.id;

  return (
    <>
      <section className="pb-4">
        <Container size="6xl">
          <div className="rounded-lg border border-border bg-surface p-6 shadow-lg sm:p-8">
            <p className="text-meta font-medium uppercase tracking-wide text-ink-muted">
              Try it &mdash; tell us where you&rsquo;re starting from
            </p>

            <form onSubmit={handleCustomSubmit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <input
                value={customText}
                onChange={(event) => setCustomText(event.target.value)}
                placeholder="e.g. forklift driver, barista, teacher, sales rep, stay-at-home parent&hellip;"
                aria-label="Describe your background"
                className="flex-1 rounded-sm border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" size="md">
                Show me
              </Button>
            </form>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-muted">or try an example:</span>
              {BRIDGE_PERSONAS.map((persona, index) => {
                const selected = !usingCustom && index === personaIdx;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectPersona(index)}
                    className={clsx(
                      "rounded-pill border px-3 py-1.5 text-sm font-medium transition-[background-color,color,border-color,transform] duration-fast ease-editorial",
                      "hover:-translate-y-px active:translate-y-px",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                      selected
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border-strong bg-surface text-ink-secondary hover:bg-paper-deep"
                    )}
                  >
                    {persona.label}
                  </button>
                );
              })}
            </div>

            <div aria-live="polite" className="sr-only">
              Showing the skills bridge for {activePersona.label}, targeting {activePersona.role}.
            </div>

            <p className="mt-6 text-sm text-ink-secondary">
              Showing the skills bridge for <strong className="text-ink">{activePersona.label}</strong>,
              targeting <strong className="text-ink">{activePersona.role}</strong>.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 border-b border-border pb-2.5 text-meta font-semibold uppercase tracking-wide text-ink-muted sm:grid-cols-[1.1fr_auto_1fr] sm:gap-4">
              <div>You did</div>
              <div className="hidden sm:block" />
              <div>Matched to the role</div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={rowsKey}
                initial={reduceMotion ? undefined : "hidden"}
                animate="visible"
                exit={reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
                variants={reduceMotion ? undefined : staggerContainer(0.07, 0.04)}
              >
                {activePersona.pairs.map((pair, index) => (
                  <motion.div
                    key={pair.did}
                    variants={reduceMotion ? undefined : staggerItem}
                    className={clsx(
                      "grid grid-cols-1 items-start gap-2 py-4 sm:grid-cols-[1.1fr_auto_1fr] sm:items-center sm:gap-4",
                      index < activePersona.pairs.length - 1 && "border-b border-border/70"
                    )}
                  >
                    <div className="text-sm leading-relaxed text-ink">{pair.did}</div>
                    <div
                      className="hidden text-lg text-ink-muted/70 sm:block"
                      aria-hidden="true"
                    >
                      &rarr;
                    </div>
                    <div>
                      <span className="inline-block rounded-pill bg-paper-deep px-2.5 py-1 text-xs font-semibold text-ink-secondary">
                        {pair.proves}
                      </span>
                      <div className="mt-2 flex items-start gap-1.5 text-sm leading-snug text-success">
                        <span aria-hidden="true">&#10003;</span>
                        <span>{pair.asks}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </Container>
      </section>

      <section id="transform" className="py-16">
        <Container size="6xl">
          <div className="mb-8 text-center">
            <h2 className="font-display text-h2 text-ink">Watch a line transform.</h2>
            <p className="mx-auto mt-3 max-w-xl text-body-lg text-ink-secondary">
              You read the job ad and think &ldquo;that&rsquo;s not me.&rdquo; You&rsquo;ve already
              done half of it, under different words &mdash; you just never translated it, so the
              filters never saw you.
            </p>
          </div>

          <div
            className="rounded-lg bg-ink p-6 text-paper sm:p-10"
            onMouseEnter={() => setAutoplay(false)}
            onMouseLeave={() => setAutoplay(true)}
          >
            <div className="grid min-h-[130px] grid-cols-1 items-center gap-6 sm:grid-cols-2 sm:gap-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`before-${rowsKey}-${transformIdx}`}
                  initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE }}
                >
                  <p className="text-meta font-semibold uppercase tracking-wide text-paper/55">
                    What you told us
                  </p>
                  <p className="mt-2.5 font-display text-lg italic leading-snug text-paper/85 sm:text-xl">
                    &ldquo;{activeTransform.did}&rdquo;
                  </p>
                </motion.div>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`after-${rowsKey}-${transformIdx}`}
                  initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="border-t border-paper/15 pt-6 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0"
                >
                  <p className="text-meta font-semibold uppercase tracking-wide text-success">
                    On your resume
                  </p>
                  <p className="mt-2.5 text-lg font-medium leading-snug text-paper sm:text-xl">
                    {activeTransform.after}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-8 flex justify-center gap-2">
              {activePersona.pairs.map((pair, index) => (
                <button
                  key={pair.did}
                  type="button"
                  aria-label={`Show transform ${index + 1} of ${activePersona.pairs.length}`}
                  aria-current={index === transformIdx}
                  onClick={() => {
                    setTransformIdx(index);
                    setAutoplay(false);
                  }}
                  className={clsx(
                    "h-2 w-2 rounded-pill transition-colors duration-fast ease-editorial",
                    index === transformIdx ? "bg-accent" : "bg-paper/25 hover:bg-paper/40"
                  )}
                />
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
