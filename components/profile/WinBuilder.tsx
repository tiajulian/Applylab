"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ChipPicker } from "@/components/profile/ChipPicker";
import { MetricInput } from "@/components/profile/ImpactField";
import { WIN_VERBS, WIN_OUTCOME_SHAPES } from "@/lib/wins/constants";
import { assembleWinText } from "@/lib/wins/assembleWin";
import { getStarterSuggestions, type StarterSource } from "@/lib/wins/starterLadder";
import type { WorkExperienceWin } from "@/types";

const TOTAL_STEPS = 6;
const OTHER_VERB = "__other__";

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

function slotsFromWin(win?: WorkExperienceWin): DraftSlots {
  if (!win) return blankSlots();
  const knownVerb = win.verb ? (WIN_VERBS as readonly string[]).includes(win.verb) : false;
  return {
    verb: knownVerb ? win.verb! : win.verb ? OTHER_VERB : "",
    customVerb: knownVerb ? "" : win.verb ?? "",
    what: win.what ?? win.text ?? "",
    tools: win.tools ?? [],
    stakeholders: win.stakeholders ?? [],
    outcome: win.outcome ?? "",
    metric: win.metric ?? "",
  };
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
          Step {step} of {TOTAL_STEPS}
        </p>
        <ProgressBar value={(step / TOTAL_STEPS) * 100} className="mt-2" />
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

/**
 * Six-step, one-decision-per-screen builder that assembles a win from the candidate's own picks.
 * The product only ever asks and slots - it never writes the achievement, the outcome, or the
 * number (see build brief). Every slot traces to something the candidate tapped or typed.
 */
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
  const [step, setStep] = useState(initialWin ? TOTAL_STEPS : 1);
  const [slots, setSlots] = useState<DraftSlots>(() => slotsFromWin(initialWin));
  const [starters, setStarters] = useState<{ starters: string[]; source: StarterSource } | null>(null);
  const fetchedStartersRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (fetchedStartersRef.current) return;
    fetchedStartersRef.current = true;
    getStarterSuggestions(description, jobTitle)
      .then((result) => setStarters(result))
      .catch(() => setStarters(null));
  }, [description, jobTitle]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function patch(partial: Partial<DraftSlots>) {
    setSlots((current) => ({ ...current, ...partial }));
  }

  function goNext() {
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleAddThisWin() {
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave(buildWin(slots));
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAnotherWin() {
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave(buildWin(slots));
      setSlots(blankSlots());
      fetchedStartersRef.current = false;
      setStarters(null);
      setStep(1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const preview = buildWin(slots);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <motion.div
        className="absolute inset-0 bg-ink/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={onClose}
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
          onClick={onClose}
        >
          ✕
        </button>

        {step === 1 && (
          <StepShell
            step={1}
            title="What did you do?"
            subtitle="Pick a word that fits if one jumps out, then say it in your own words."
            onNext={goNext}
            nextDisabled={!slots.what.trim()}
          >
            <div className="flex flex-wrap gap-2">
              {WIN_VERBS.map((verb) => (
                <button
                  key={verb}
                  type="button"
                  aria-pressed={slots.verb === verb}
                  onClick={() => patch({ verb: slots.verb === verb ? "" : verb, customVerb: "" })}
                  className={clsx(
                    "min-h-11 rounded-pill border px-4 py-2 text-sm font-medium transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                  "min-h-11 rounded-pill border px-4 py-2 text-sm font-medium transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                placeholder="Type your own word"
                value={slots.customVerb}
                onChange={(e) => patch({ customVerb: e.target.value })}
                className="min-h-11 rounded border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}

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
              rows={2}
              autoFocus={!starters}
              placeholder="e.g. sorted out the stockroom so month-end counts stopped running late"
              value={slots.what}
              onChange={(e) => patch({ what: e.target.value })}
            />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            step={2}
            title="Any tools or software?"
            subtitle="Optional. Pick from your list, or add one that's not there yet."
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
              addPlaceholder="Add a tool"
            />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            step={3}
            title="Who was this for?"
            subtitle="Optional. Pick from your list, or add someone new."
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
              addPlaceholder="Add who it was for"
            />
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            step={4}
            title="What changed?"
            subtitle="Optional. Tap something close if it helps, then say it your way."
            onBack={goBack}
            onSkip={() => {
              patch({ outcome: "" });
              goNext();
            }}
            skipLabel="Not sure, skip"
            onNext={goNext}
          >
            <div className="flex flex-wrap gap-2">
              {WIN_OUTCOME_SHAPES.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => patch({ outcome: shape })}
                  className="min-h-11 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent/40 hover:text-accent"
                >
                  {shape}
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              placeholder="In your own words - what actually changed?"
              value={slots.outcome}
              onChange={(e) => patch({ outcome: e.target.value })}
            />
          </StepShell>
        )}

        {step === 5 && (
          <StepShell
            step={5}
            title="Got a number?"
            subtitle="Totally optional. A good win doesn't need one."
            onBack={goBack}
            onSkip={() => {
              patch({ metric: "" });
              goNext();
            }}
            onNext={goNext}
          >
            <MetricInput value={slots.metric} onChange={(value) => patch({ metric: value })} />
          </StepShell>
        )}

        {step === TOTAL_STEPS && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Almost done</p>
              <ProgressBar value={100} className="mt-2" />
            </div>
            <div>
              <h2 className="font-display text-h3 text-ink">Here&apos;s your win</h2>
              <p className="mt-1 text-sm text-ink-secondary">Have a look, and add it when it reads right.</p>
            </div>
            <div className="rounded border border-border bg-paper-deep/50 p-4">
              <p className="text-sm text-ink">
                {preview.text || "Add a few words in the earlier steps to see your win here."}
                {preview.metric && <span className="text-ink-secondary">, {preview.metric}</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s)}
                  className="min-h-11 rounded-pill border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent/40 hover:text-accent"
                >
                  Edit step {s}
                </button>
              ))}
            </div>
            {saveError && <p className="text-sm text-critical">{saveError}</p>}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="md"
                isLoading={isSaving}
                onClick={handleAnotherWin}
                disabled={!preview.text || isSaving}
              >
                Add and start another
              </Button>
              <Button
                type="button"
                size="lg"
                isLoading={isSaving}
                onClick={handleAddThisWin}
                disabled={!preview.text || isSaving}
              >
                Add this win
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
