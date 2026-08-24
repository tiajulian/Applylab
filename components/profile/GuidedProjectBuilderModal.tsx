"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { clsx } from "@/lib/utils";
import type { ProjectEntry } from "@/types";

interface GuidedProjectBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectEntry;
  onApply: (enhanced: { description: string; outcome?: string; outcome_metric?: string; tools?: string[]; context?: string }) => void;
  autoRunInstant?: boolean;
}

const STEP_1_PROBLEM_CHIPS = [
  "⚡ Slow Data Latency / Processing Bottleneck",
  "🤖 Automated a Broken Manual Process",
  "👥 Built for Active Real-World Users",
  "🛒 High-Volume E-Commerce / Full-Stack SaaS",
  "🛡️ Security, Auth & Data Compliance",
];

const STEP_2_ARCH_CHIPS = [
  "RESTful Microservices",
  "Event-Driven Kafka Streaming",
  "dbt Transformation Models",
  "CI/CD Automated Pipelines",
  "Redis In-Memory Caching",
  "JWT / OAuth Authentication",
];

const STEP_3_CONSTRAINT_CHIPS = [
  "Handled Concurrent High-Traffic Spikes",
  "Reduced Cloud Compute & Database Costs",
  "Maintained Zero-Downtime Deployment",
  "Ensured ACID Data Consistency",
];

const STEP_4_EVIDENCE_CHIPS = [
  "⚡ Sub-200ms API response time",
  "⏱️ 40% reduction in query execution time",
  "📈 Processed 50k+ daily events/records",
  "👥 500+ active monthly users",
  "🎯 99.9% uptime with automated unit tests",
];

type OptionKind = "architectureFirst" | "impactFirst" | "concise";
type StepNumber = 1 | 2 | 3 | 4 | 5;

export function GuidedProjectBuilderModal({
  isOpen,
  onClose,
  project,
  onApply,
  autoRunInstant = false,
}: GuidedProjectBuilderModalProps) {
  const [step, setStep] = useState<StepNumber>(1);

  // Step answers
  const [problemSelected, setProblemSelected] = useState<string[]>([]);
  const [problemCustom, setProblemCustom] = useState("");

  const [archSelected, setArchSelected] = useState<string[]>([]);
  const [archCustom, setArchCustom] = useState("");

  const [constraintSelected, setConstraintSelected] = useState<string[]>([]);
  const [constraintCustom, setConstraintCustom] = useState("");

  const [evidenceSelected, setEvidenceSelected] = useState<string[]>([]);
  const [evidenceCustom, setEvidenceCustom] = useState("");

  // Generation state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Generated options
  const [options, setOptions] = useState<{
    architectureFirst: string[];
    impactFirst: string[];
    concise: string[];
  }>({
    architectureFirst: [],
    impactFirst: [],
    concise: [],
  });

  // Selected Option
  const [selectedOptionKind, setSelectedOptionKind] = useState<OptionKind>("architectureFirst");

  // Editable text per option
  const [editableTexts, setEditableTexts] = useState<Record<OptionKind, string>>({
    architectureFirst: "",
    impactFirst: "",
    concise: "",
  });

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      if (autoRunInstant) {
        runEnhanceApi();
      } else {
        setStep(1);
      }
    } else {
      document.body.style.overflow = "";
      resetState();
    }
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoRunInstant]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  function resetState() {
    setStep(1);
    setProblemSelected([]);
    setProblemCustom("");
    setArchSelected([]);
    setArchCustom("");
    setConstraintSelected([]);
    setConstraintCustom("");
    setEvidenceSelected([]);
    setEvidenceCustom("");
    setIsLoading(false);
    setErrorMsg(null);
    setOptions({ architectureFirst: [], impactFirst: [], concise: [] });
    setSelectedOptionKind("architectureFirst");
    setIsEditing(false);
  }

  function toggleChip(list: string[], setList: (v: string[]) => void, item: string) {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  }

  async function runEnhanceApi() {
    setIsLoading(true);
    setErrorMsg(null);

    const problem = [...problemSelected, problemCustom].filter(Boolean).join(". ");
    const architecture = [...archSelected, archCustom].filter(Boolean).join(". ");
    const constraint = [...constraintSelected, constraintCustom].filter(Boolean).join(". ");
    const evidence = [...evidenceSelected, evidenceCustom].filter(Boolean).join(". ");

    try {
      const res = await fetch("/api/projects/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: project.title,
          role: project.context,
          stack: project.tools,
          notes: project.description,
          paceAnswers: {
            problem,
            architecture,
            constraint,
            evidence,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate project enhancement");
      }

      const data: { architectureFirst?: string[]; impactFirst?: string[]; concise?: string[] } = await res.json();
      const archText = (data.architectureFirst || []).map((b) => `• ${b}`).join("\n");
      const impactText = (data.impactFirst || []).map((b) => `• ${b}`).join("\n");
      const conciseText = (data.concise || []).map((b) => `• ${b}`).join("\n");

      setOptions({
        architectureFirst: data.architectureFirst || [],
        impactFirst: data.impactFirst || [],
        concise: data.concise || [],
      });

      setEditableTexts({
        architectureFirst: archText,
        impactFirst: impactText,
        concise: conciseText,
      });

      setStep(5);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleApply() {
    const activeText = editableTexts[selectedOptionKind];
    onApply({
      description: activeText,
    });
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-ink/40 backdrop-blur-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isLoading) onClose();
            }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative z-10 mx-auto w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop sm:p-8"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                  P-A-C-E Framework &middot; Recruiter-Grade Enhancer
                </span>
                <h2 className="font-display text-h3 font-bold text-ink">
                  {project.title || "Project"} AI Enhancer
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="rounded-full p-2 text-ink-muted hover:bg-paper-deep hover:text-ink transition-colors disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 rounded border border-critical/30 bg-critical-soft/40 p-3 text-xs font-semibold text-critical">
                {errorMsg}
              </div>
            )}

            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="h-10 w-10 animate-spin rounded-full border-3 border-accent border-t-transparent" />
                <p className="mt-4 font-display text-lg font-semibold text-ink">
                  Crafting P-A-C-E Recruiter Variations...
                </p>
                <p className="mt-1 text-xs text-ink-secondary">
                  Applying Australian tech recruiter standards &amp; engineering metrics
                </p>
              </div>
            ) : step === 5 ? (
              /* Step 5: Final Selection Screen with 3 Recruiter-Grade Variations */
              <div className="mt-6 flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink">
                      Select Your Preferred Recruiter Style
                    </h3>
                    <p className="text-xs text-ink-secondary">
                      Review the 3 variations generated from your project details and P-A-C-E answers.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? "✓ Done Editing" : "✏️ Edit Manually"}
                  </Button>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Option 1: Architecture & Technical Depth */}
                  <div
                    onClick={() => setSelectedOptionKind("architectureFirst")}
                    className={clsx(
                      "cursor-pointer rounded-lg border p-5 transition-all",
                      selectedOptionKind === "architectureFirst"
                        ? "border-accent bg-accent-soft/30 ring-2 ring-accent/30 shadow-sm"
                        : "border-border bg-paper hover:border-border-strong"
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="optionKind"
                          checked={selectedOptionKind === "architectureFirst"}
                          onChange={() => setSelectedOptionKind("architectureFirst")}
                          className="text-accent focus:ring-accent"
                        />
                        <span className="font-bold text-sm text-ink">
                          Option 1: Architecture &amp; Technical Depth
                        </span>
                      </div>
                      <span className="rounded bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-accent">
                        Recommended for Tech Roles
                      </span>
                    </div>

                    {isEditing && selectedOptionKind === "architectureFirst" ? (
                      <Textarea
                        rows={4}
                        value={editableTexts.architectureFirst}
                        onChange={(e) =>
                          setEditableTexts({ ...editableTexts, architectureFirst: e.target.value })
                        }
                      />
                    ) : (
                      <pre className="font-sans text-xs sm:text-sm text-ink leading-relaxed whitespace-pre-wrap">
                        {editableTexts.architectureFirst}
                      </pre>
                    )}
                  </div>

                  {/* Option 2: Impact & User Adoption */}
                  <div
                    onClick={() => setSelectedOptionKind("impactFirst")}
                    className={clsx(
                      "cursor-pointer rounded-lg border p-5 transition-all",
                      selectedOptionKind === "impactFirst"
                        ? "border-accent bg-accent-soft/30 ring-2 ring-accent/30 shadow-sm"
                        : "border-border bg-paper hover:border-border-strong"
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="optionKind"
                          checked={selectedOptionKind === "impactFirst"}
                          onChange={() => setSelectedOptionKind("impactFirst")}
                          className="text-accent focus:ring-accent"
                        />
                        <span className="font-bold text-sm text-ink">
                          Option 2: Impact &amp; User Adoption
                        </span>
                      </div>
                      <span className="rounded bg-success/20 px-2 py-0.5 text-[11px] font-bold text-success">
                        Great for Product &amp; Full-Stack
                      </span>
                    </div>

                    {isEditing && selectedOptionKind === "impactFirst" ? (
                      <Textarea
                        rows={4}
                        value={editableTexts.impactFirst}
                        onChange={(e) =>
                          setEditableTexts({ ...editableTexts, impactFirst: e.target.value })
                        }
                      />
                    ) : (
                      <pre className="font-sans text-xs sm:text-sm text-ink leading-relaxed whitespace-pre-wrap">
                        {editableTexts.impactFirst}
                      </pre>
                    )}
                  </div>

                  {/* Option 3: High-Density 1-Page Format */}
                  <div
                    onClick={() => setSelectedOptionKind("concise")}
                    className={clsx(
                      "cursor-pointer rounded-lg border p-5 transition-all",
                      selectedOptionKind === "concise"
                        ? "border-accent bg-accent-soft/30 ring-2 ring-accent/30 shadow-sm"
                        : "border-border bg-paper hover:border-border-strong"
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="optionKind"
                          checked={selectedOptionKind === "concise"}
                          onChange={() => setSelectedOptionKind("concise")}
                          className="text-accent focus:ring-accent"
                        />
                        <span className="font-bold text-sm text-ink">
                          Option 3: High-Density 1-Page Format
                        </span>
                      </div>
                      <span className="rounded bg-paper-deep px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                        Space Saver
                      </span>
                    </div>

                    {isEditing && selectedOptionKind === "concise" ? (
                      <Textarea
                        rows={3}
                        value={editableTexts.concise}
                        onChange={(e) =>
                          setEditableTexts({ ...editableTexts, concise: e.target.value })
                        }
                      />
                    ) : (
                      <pre className="font-sans text-xs sm:text-sm text-ink leading-relaxed whitespace-pre-wrap">
                        {editableTexts.concise}
                      </pre>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4">
                  <Button type="button" variant="ghost" size="md" onClick={() => setStep(4)}>
                    &larr; Back to Questions
                  </Button>
                  <Button type="button" size="md" onClick={handleApply}>
                    💾 Apply to Project
                  </Button>
                </div>
              </div>
            ) : (
              /* Steps 1 to 4 Guided Stepper */
              <div className="mt-6 flex flex-col gap-6">
                {/* Stepper Progress Indicator */}
                <div className="flex items-center justify-between border-b border-border pb-3 text-xs font-semibold overflow-x-auto">
                  <span className={clsx(step === 1 ? "text-accent font-bold" : "text-ink-muted")}>
                    1. Problem
                  </span>
                  <span>&rarr;</span>
                  <span className={clsx(step === 2 ? "text-accent font-bold" : "text-ink-muted")}>
                    2. Architecture
                  </span>
                  <span>&rarr;</span>
                  <span className={clsx(step === 3 ? "text-accent font-bold" : "text-ink-muted")}>
                    3. Constraints
                  </span>
                  <span>&rarr;</span>
                  <span className={clsx(step === 4 ? "text-accent font-bold" : "text-ink-muted")}>
                    4. Evidence
                  </span>
                </div>

                {/* Step 1: Problem & Purpose */}
                {step === 1 && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <h3 className="font-display text-base font-bold text-ink">
                        Step 1: Problem &amp; Purpose (Why did you build this?)
                      </h3>
                      <p className="mt-1 text-xs text-ink-secondary">
                        What real-world problem, bottleneck, or user need did this project address?
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {STEP_1_PROBLEM_CHIPS.map((chip) => {
                        const isSel = problemSelected.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleChip(problemSelected, setProblemSelected, chip)}
                            className={clsx(
                              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all min-h-[38px]",
                              isSel
                                ? "bg-accent text-on-accent shadow-sm"
                                : "bg-paper-deep border border-border text-ink-secondary hover:text-ink"
                            )}
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>

                    <Input
                      label="Or describe in your own words (optional):"
                      placeholder="e.g. Ingestion pipeline was timing out on large CSV dumps..."
                      value={problemCustom}
                      onChange={(e) => setProblemCustom(e.target.value)}
                    />
                  </div>
                )}

                {/* Step 2: Architecture & Stack */}
                {step === 2 && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <h3 className="font-display text-base font-bold text-ink">
                        Step 2: Architecture &amp; Stack (How did you build it?)
                      </h3>
                      <p className="mt-1 text-xs text-ink-secondary">
                        What key system design patterns or frameworks were used?
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {STEP_2_ARCH_CHIPS.map((chip) => {
                        const isSel = archSelected.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleChip(archSelected, setArchSelected, chip)}
                            className={clsx(
                              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all min-h-[38px]",
                              isSel
                                ? "bg-accent text-on-accent shadow-sm"
                                : "bg-paper-deep border border-border text-ink-secondary hover:text-ink"
                            )}
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>

                    <Input
                      label="Add custom frameworks or patterns:"
                      placeholder="e.g. GraphQL, Next.js App Router, Docker..."
                      value={archCustom}
                      onChange={(e) => setArchCustom(e.target.value)}
                    />
                  </div>
                )}

                {/* Step 3: Engineering Constraints */}
                {step === 3 && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <h3 className="font-display text-base font-bold text-ink">
                        Step 3: Engineering Constraints &amp; Trade-Offs
                      </h3>
                      <p className="mt-1 text-xs text-ink-secondary">
                        What technical constraints or obstacles did you manage during development?
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {STEP_3_CONSTRAINT_CHIPS.map((chip) => {
                        const isSel = constraintSelected.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleChip(constraintSelected, setConstraintSelected, chip)}
                            className={clsx(
                              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all min-h-[38px]",
                              isSel
                                ? "bg-accent text-on-accent shadow-sm"
                                : "bg-paper-deep border border-border text-ink-secondary hover:text-ink"
                            )}
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>

                    <Input
                      label="Add specific constraint details:"
                      placeholder="e.g. Memory footprint capped at 512MB on free tier..."
                      value={constraintCustom}
                      onChange={(e) => setConstraintCustom(e.target.value)}
                    />
                  </div>
                )}

                {/* Step 4: Evidence & Technical Metrics */}
                {step === 4 && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <h3 className="font-display text-base font-bold text-ink">
                        Step 4: Evidence &amp; Technical Metrics
                      </h3>
                      <p className="mt-1 text-xs text-ink-secondary">
                        Select smart engineering benchmarks to prove impact without needing revenue numbers.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {STEP_4_EVIDENCE_CHIPS.map((chip) => {
                        const isSel = evidenceSelected.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleChip(evidenceSelected, setEvidenceSelected, chip)}
                            className={clsx(
                              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all min-h-[38px]",
                              isSel
                                ? "bg-accent text-on-accent shadow-sm"
                                : "bg-paper-deep border border-border text-ink-secondary hover:text-ink"
                            )}
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>

                    <Input
                      label="Add custom metric or outcome:"
                      placeholder="e.g. Reduced bundle size by 35%..."
                      value={evidenceCustom}
                      onChange={(e) => setEvidenceCustom(e.target.value)}
                    />
                  </div>
                )}

                {/* Navigation Controls */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      if (step > 1) setStep((step - 1) as StepNumber);
                    }}
                    disabled={step === 1}
                  >
                    &larr; Back
                  </Button>

                  <div className="flex gap-2">
                    {step < 4 ? (
                      <Button type="button" size="md" onClick={() => setStep((step + 1) as StepNumber)}>
                        Next &rarr;
                      </Button>
                    ) : (
                      <Button type="button" size="md" onClick={runEnhanceApi}>
                        ✨ Generate Recruiter Variations
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
