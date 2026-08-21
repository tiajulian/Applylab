"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Textarea";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ChipPicker } from "@/components/profile/ChipPicker";
import { MetricInput } from "@/components/profile/ImpactField";
import { WIN_VERBS, WIN_OUTCOME_SHAPES } from "@/lib/wins/constants";
import { assembleWinText } from "@/lib/wins/assembleWin";
import { getStarterSuggestions, type StarterSource } from "@/lib/wins/starterLadder";
import type { WorkExperienceWin } from "@/types";

import { smartPrefill } from "@/lib/wins/smartPrefill";

const TOTAL_STEPS = 7;
const OTHER_VERB = "__other__";

const METRIC_BENCHMARKS = [
  "35% performance speedup",
  "10+ hours saved weekly",
  "$15k compute cost reduction",
  "50+ team stakeholders",
];

interface DraftSlots {
  verb: string;
  customVerb: string;
  what: string;
  tools: string[];
  stakeholders: string[];
  outcome: string;
  metric: string;
}

function blankSlots(): DraftSlots {
  return { verb: "", customVerb: "", what: "", tools: [], stakeholders: [], outcome: "", metric: "" };
}

function slotsFromWin(win?: WorkExperienceWin, profileTools: string[] = []): DraftSlots {
  if (!win) return blankSlots();
  const prefilled = smartPrefill(win.text || win.what || "", profileTools);
  const effectiveVerbChoice = win.verb || prefilled.verb;
  const knownVerb = effectiveVerbChoice ? (WIN_VERBS as readonly string[]).includes(effectiveVerbChoice) : false;

  return {
    verb: knownVerb ? effectiveVerbChoice : effectiveVerbChoice ? OTHER_VERB : "",
    customVerb: knownVerb ? "" : effectiveVerbChoice,
    what: win.what || prefilled.what || win.text || "",
    tools: win.tools && win.tools.length > 0 ? win.tools : prefilled.tools,
    stakeholders: win.stakeholders ?? [],
    outcome: win.outcome || prefilled.outcome || "",
    metric: win.metric ?? "",
  };
}

function slotsEqual(a: DraftSlots, b: DraftSlots): boolean {
  return (
    a.verb === b.verb &&
    a.customVerb === b.customVerb &&
    a.what === b.what &&
    a.outcome === b.outcome &&
    a.metric === b.metric &&
    a.tools.length === b.tools.length &&
    a.tools.every((tool, i) => tool === b.tools[i]) &&
    a.stakeholders.length === b.stakeholders.length &&
    a.stakeholders.every((person, i) => person === b.stakeholders[i])
  );
}

function effectiveVerb(slots: DraftSlots): string {
  return slots.verb === OTHER_VERB ? slots.customVerb.trim() : slots.verb;
}

function buildWin(slots: DraftSlots): WorkExperienceWin {
  const verb = effectiveVerb(slots);
  const what = slots.what.trim();
  const outcome = slots.outcome.trim();
  return {
    text: assembleWinText({ verb, what, tools: slots.tools, stakeholders: slots.stakeholders, outcome }),
    metric: slots.metric.trim(),
    ...(verb ? { verb } : {}),
    ...(what ? { what } : {}),
    ...(slots.tools.length > 0 ? { tools: slots.tools } : {}),
    ...(slots.stakeholders.length > 0 ? { stakeholders: slots.stakeholders } : {}),
    ...(outcome ? { outcome } : {}),
  };
}

const STARTER_SOURCE_LABEL: Record<StarterSource, string> = {
  description: "From your notes above",
  "description-ai": "From your notes above",
  duties: "From duties you already confirmed for this role",
  title: "Common for this kind of role",
};

function StepShell({
  step,
  title,
  subtitle,
  children,
  onBack,
  onSkip,
  skipLabel = "Skip",
  onNext,
  nextLabel = "Next",
  nextDisabled,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Step {step} of {TOTAL_STEPS - 1}
        </p>
        <ProgressBar value={(step / (TOTAL_STEPS - 1)) * 100} className="mt-2" />
      </div>
      <div>
        <h2 className="font-display text-h3 text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {onBack && (
            <Button type="button" variant="ghost" size="md" onClick={onBack}>
              Back
            </Button>
          )}
          {onSkip && (
            <Button type="button" variant="ghost" size="md" onClick={onSkip}>
              {skipLabel}
            </Button>
          )}
        </div>
        <Button type="button" size="lg" onClick={onNext} disabled={nextDisabled} className="w-full sm:w-auto">
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

export function WinBuilder({
  jobTitle,
  description,
  profileTools,
  onAddProfileTool,
  profileStakeholders,
  onAddProfileStakeholder,
  initialWin,
  onSave,
  onClose,
}: {
  jobTitle: string;
  description: string;
  profileTools: string[];
  onAddProfileTool: (tool: string) => void;
  profileStakeholders: string[];
  onAddProfileStakeholder: (stakeholder: string) => void;
  initialWin?: WorkExperienceWin;
  onSave: (win: WorkExperienceWin) => void | Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [slots, setSlots] = useState<DraftSlots>(() => slotsFromWin(initialWin, profileTools));
  const initialSlotsRef = useRef<DraftSlots | null>(null);
  if (initialSlotsRef.current === null) {
    initialSlotsRef.current = slotsFromWin(initialWin, profileTools);
  }
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [starters, setStarters] = useState<{ starters: string[]; source: StarterSource } | null>(null);
  const fetchedStartersRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isPolishing, setIsPolishing] = useState(false);
  const [variations, setVariations] = useState<{ actionFirst: string; metricFirst: string; concise: string } | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<"actionFirst" | "metricFirst" | "concise">("actionFirst");
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [manualText, setManualText] = useState("");

  function fetchStarters() {
    fetchedStartersRef.current = true;
    getStarterSuggestions(description, jobTitle)
      .then((result) => setStarters(result))
      .catch(() => setStarters(null));
  }

  useEffect(() => {
    if (fetchedStartersRef.current) return;
    fetchStarters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function requestClose() {
    if (slotsEqual(slotsRef.current, initialSlotsRef.current!)) {
      onCloseRef.current();
    } else {
      setShowDiscardConfirm(true);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function patch(partial: Partial<DraftSlots>) {
    setSlots((current) => ({ ...current, ...partial }));
  }

  function triggerPolishStep() {
    setStep(7);
    const win = buildWin(slots);
    if (!win.text.trim()) return;

    setIsPolishing(true);
    setSaveError(null);

    fetch("/api/win-polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: win.text,
        metric: win.metric,
        verb: win.verb,
        what: win.what,
        outcome: win.outcome,
        tools: win.tools ?? [],
        stakeholders: win.stakeholders ?? [],
        roleTitle: jobTitle,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.variations) {
          setVariations(data.variations);
          setManualText(data.variations.actionFirst);
        } else if (data.suggestion) {
          setVariations({
            actionFirst: data.suggestion,
            metricFirst: win.metric ? `${win.metric}: ${data.suggestion}` : data.suggestion,
            concise: data.suggestion,
          });
          setManualText(data.suggestion);
        } else {
          const defaultText = assembleWinText({
            verb: effectiveVerb(slots),
            what: slots.what,
            tools: slots.tools,
            stakeholders: slots.stakeholders,
            outcome: slots.outcome,
          });
          setVariations({
            actionFirst: defaultText,
            metricFirst: slots.metric ? `${slots.metric}: ${defaultText}` : defaultText,
            concise: defaultText,
          });
          setManualText(defaultText);
        }
      })
      .catch(() => {
        const defaultText = assembleWinText({
          verb: effectiveVerb(slots),
          what: slots.what,
          tools: slots.tools,
          stakeholders: slots.stakeholders,
          outcome: slots.outcome,
        });
        setVariations({
          actionFirst: defaultText,
          metricFirst: slots.metric ? `${slots.metric}: ${defaultText}` : defaultText,
          concise: defaultText,
        });
        setManualText(defaultText);
      })
      .finally(() => {
        setIsPolishing(false);
      });
  }

  function goNext() {
    if (step === 6) {
      triggerPolishStep();
    } else {
      setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    }
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSaveSelectedWin() {
    setSaveError(null);
    setIsSaving(true);
    const chosenText = isManualEdit
      ? manualText
      : variations
      ? variations[selectedVariation]
      : buildWin(slots).text;

    const winToSave: WorkExperienceWin = {
      ...buildWin(slots),
      text: chosenText,
    };

    try {
      await onSave(winToSave);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <motion.div
        className="absolute inset-0 bg-ink/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={requestClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Build a win"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-lg bg-surface p-6 shadow-pop"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={requestClose}
        >
          ✕
        </button>

        {step === 1 && (
          <StepShell
            step={1}
            title="Action Verb"
            subtitle="Pick a strong past/present action verb that fits what you accomplished."
            onNext={goNext}
          >
            <div className="flex flex-wrap gap-2">
              {WIN_VERBS.map((verb) => (
                <button
                  key={verb}
                  type="button"
                  aria-pressed={slots.verb === verb}
                  onClick={() => patch({ verb: slots.verb === verb ? "" : verb, customVerb: "" })}
                  className={clsx(
                    "min-h-11 rounded-pill border px-4 py-2 text-sm font-medium transition-colors duration-fast ease-editorial",
                    slots.verb === verb
                      ? "border-accent bg-accent text-on-accent"
                      : "border-border bg-surface text-ink-secondary hover:border-accent/40 hover:text-accent"
                  )}
                >
                  {verb}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={slots.verb === OTHER_VERB}
                onClick={() => patch({ verb: slots.verb === OTHER_VERB ? "" : OTHER_VERB })}
                className={clsx(
                  "min-h-11 rounded-pill border px-4 py-2 text-sm font-medium transition-colors duration-fast ease-editorial",
                  slots.verb === OTHER_VERB
                    ? "border-accent bg-accent text-on-accent"
                    : "border-border bg-surface text-ink-secondary hover:border-accent/40 hover:text-accent"
                )}
              >
                Other
              </button>
            </div>
            {slots.verb === OTHER_VERB && (
              <input
                type="text"
                autoFocus
                placeholder="Type your own verb"
                value={slots.customVerb}
                onChange={(e) => patch({ customVerb: e.target.value })}
                className="min-h-11 rounded border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            )}
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            step={2}
            title="Core Task / Activity"
            subtitle="Describe what you built, managed, or worked on."
            onBack={goBack}
            onNext={goNext}
            nextDisabled={!slots.what.trim()}
          >
            {starters && starters.starters.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded border border-border bg-paper-deep/50 p-3">
                <p className="text-xs font-medium text-ink-secondary">{STARTER_SOURCE_LABEL[starters.source]}</p>
                <div className="flex flex-wrap gap-2">
                  {starters.starters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => patch({ what: starter })}
                      className="min-h-11 rounded-pill border border-border bg-surface px-3 py-2 text-left text-sm text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent/40 hover:text-accent"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Textarea
              rows={3}
              placeholder="e.g. refactored Snowflake SQL queries to streamline data pipelines"
              value={slots.what}
              onChange={(e) => patch({ what: e.target.value })}
            />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            step={3}
            title="Tools & Technologies"
            subtitle="Pick tools used for this task to highlight technical capability."
            onBack={goBack}
            onSkip={() => {
              patch({ tools: [] });
              goNext();
            }}
            onNext={goNext}
          >
            <ChipPicker
              options={profileTools}
              selected={slots.tools}
              onToggle={(tool) =>
                patch({
                  tools: slots.tools.includes(tool) ? slots.tools.filter((t) => t !== tool) : [...slots.tools, tool],
                })
              }
              onAddNew={(tool) => {
                onAddProfileTool(tool);
                patch({ tools: slots.tools.includes(tool) ? slots.tools : [...slots.tools, tool] });
              }}
              addPlaceholder="Add a tool (e.g. Snowflake, Tableau)"
            />
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            step={4}
            title="Stakeholders / Beneficiaries"
            subtitle="Who directly benefitted or was impacted by this work?"
            onBack={goBack}
            onSkip={() => {
              patch({ stakeholders: [] });
              goNext();
            }}
            onNext={goNext}
          >
            <ChipPicker
              options={profileStakeholders}
              selected={slots.stakeholders}
              onToggle={(person) =>
                patch({
                  stakeholders: slots.stakeholders.includes(person)
                    ? slots.stakeholders.filter((s) => s !== person)
                    : [...slots.stakeholders, person],
                })
              }
              onAddNew={(person) => {
                onAddProfileStakeholder(person);
                patch({
                  stakeholders: slots.stakeholders.includes(person)
                    ? slots.stakeholders
                    : [...slots.stakeholders, person],
                });
              }}
              addPlaceholder="Add who it was for (e.g. 50+ stakeholders)"
            />
          </StepShell>
        )}

        {step === 5 && (
          <StepShell
            step={5}
            title="Business Outcome"
            subtitle="What direction of impact did this achieve?"
            onBack={goBack}
            onSkip={() => {
              patch({ outcome: "" });
              goNext();
            }}
            onNext={goNext}
          >
            <div className="flex flex-wrap gap-2">
              {WIN_OUTCOME_SHAPES.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => patch({ outcome: shape })}
                  className={clsx(
                    "min-h-11 rounded-pill border px-4 py-2 text-sm font-medium transition-colors duration-fast ease-editorial",
                    slots.outcome === shape
                      ? "border-accent bg-accent text-on-accent"
                      : "border-border bg-surface text-ink-secondary hover:border-accent/40 hover:text-accent"
                  )}
                >
                  {shape}
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              placeholder="Or describe the outcome in your own words"
              value={slots.outcome}
              onChange={(e) => patch({ outcome: e.target.value })}
            />
          </StepShell>
        )}

        {step === 6 && (
          <StepShell
            step={6}
            title="Quantified Metric"
            subtitle="Add a measurable figure or tap a benchmark suggestion below."
            onBack={goBack}
            onSkip={() => {
              patch({ metric: "" });
              goNext();
            }}
            nextLabel="Polish with AI →"
            onNext={goNext}
          >
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-ink-secondary">Suggested Metric Benchmarks:</p>
              <div className="flex flex-wrap gap-2">
                {METRIC_BENCHMARKS.map((benchmark) => (
                  <button
                    key={benchmark}
                    type="button"
                    onClick={() => patch({ metric: benchmark })}
                    className="rounded-pill border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
                  >
                    + {benchmark}
                  </button>
                ))}
              </div>
            </div>
            <MetricInput value={slots.metric} onChange={(value) => patch({ metric: value })} />
          </StepShell>
        )}

        {step === 7 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Final Review</p>
              <ProgressBar value={100} className="mt-2" />
            </div>

            <div>
              <h2 className="font-display text-h3 text-ink">Choose Your AI-Polished Bullet</h2>
              <p className="mt-1 text-sm text-ink-secondary">
                Select from 3 recruiter-ready variations generated from your slots:
              </p>
            </div>

            {isPolishing ? (
              <div className="flex flex-col gap-3 rounded border border-border bg-surface p-6 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <p className="text-sm font-medium text-ink">Generating 3 recruiter-ready variations…</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div
                  className={clsx(
                    "cursor-pointer rounded-lg border p-3.5 transition-colors",
                    selectedVariation === "actionFirst" && !isManualEdit
                      ? "border-accent bg-accent-soft/40 shadow-sm"
                      : "border-border bg-surface hover:border-accent/40"
                  )}
                  onClick={() => {
                    setSelectedVariation("actionFirst");
                    setIsManualEdit(false);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                      Option 1: Action & Tech-First (Balanced)
                    </span>
                    <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent">
                      RECOMMENDED
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-ink font-medium">
                    {variations?.actionFirst || buildWin(slots).text}
                  </p>
                </div>

                <div
                  className={clsx(
                    "cursor-pointer rounded-lg border p-3.5 transition-colors",
                    selectedVariation === "metricFirst" && !isManualEdit
                      ? "border-accent bg-accent-soft/40 shadow-sm"
                      : "border-border bg-surface hover:border-accent/40"
                  )}
                  onClick={() => {
                    setSelectedVariation("metricFirst");
                    setIsManualEdit(false);
                  }}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                    Option 2: Metric-First (High Impact)
                  </span>
                  <p className="mt-1.5 text-sm text-ink font-medium">
                    {variations?.metricFirst || buildWin(slots).text}
                  </p>
                </div>

                <div
                  className={clsx(
                    "cursor-pointer rounded-lg border p-3.5 transition-colors",
                    selectedVariation === "concise" && !isManualEdit
                      ? "border-accent bg-accent-soft/40 shadow-sm"
                      : "border-border bg-surface hover:border-accent/40"
                  )}
                  onClick={() => {
                    setSelectedVariation("concise");
                    setIsManualEdit(false);
                  }}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                    Option 3: Concise (Space-Saver)
                  </span>
                  <p className="mt-1.5 text-sm text-ink font-medium">
                    {variations?.concise || buildWin(slots).text}
                  </p>
                </div>

                <div className="mt-1">
                  <button
                    type="button"
                    className="text-xs font-medium text-accent underline hover:text-accent/80"
                    onClick={() => {
                      setIsManualEdit((prev) => !prev);
                      if (!isManualEdit && variations) {
                        setManualText(variations[selectedVariation]);
                      }
                    }}
                  >
                    {isManualEdit ? "← Back to AI Options" : "✏️ Edit text manually"}
                  </button>
                  {isManualEdit && (
                    <Textarea
                      rows={3}
                      className="mt-2"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                    />
                  )}
                </div>
              </div>
            )}

            {saveError && <p className="text-xs text-critical">{saveError}</p>}

            <div className="flex justify-between gap-3 pt-2">
              <Button type="button" variant="ghost" size="md" onClick={() => setStep(6)}>
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                className="bg-accent text-on-accent hover:bg-accent/90"
                isLoading={isSaving}
                disabled={isPolishing || isSaving}
                onClick={handleSaveSelectedWin}
              >
                Save to Resume Bullets
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {showDiscardConfirm && (
        <ConfirmDialog
          title="Discard this win?"
          description="Your answers won't be saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          isDestructive
          onConfirm={() => {
            setShowDiscardConfirm(false);
            onClose();
          }}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  );
}
