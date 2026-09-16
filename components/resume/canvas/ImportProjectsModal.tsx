"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import type { ProjectEntry, ResumeProjectEntry } from "@/types";

/** Turns a profile project (richer shape: description/outcome/tools/link) into the resume's
 * flatter ResumeProjectEntry (title/context/year/bullets) - same conversion the accordion's
 * "Import Projects from Profile" used, promoted here so the canvas can reuse it. */
export function projectEntryFromProfile(proj: ProjectEntry): ResumeProjectEntry {
  const bullets: string[] = [];
  if (proj.description) {
    const lines = proj.description
      .split(/\r?\n|•/)
      .map((l) => l.trim().replace(/^[-*]\s*/, ""))
      .filter(Boolean);
    bullets.push(...lines);
  }
  if (proj.outcome?.trim()) {
    const outcomeText = proj.outcome_metric?.trim()
      ? `${proj.outcome.trim()} (${proj.outcome_metric.trim()})`
      : proj.outcome.trim();
    bullets.push(outcomeText);
  }
  if (proj.link?.trim()) {
    bullets.push(`Project link: ${proj.link.trim()}`);
  }

  return {
    title: proj.title.trim() || "Untitled Project",
    context: proj.context?.trim() || (proj.tools && proj.tools.length > 0 ? proj.tools.join(", ") : ""),
    year: proj.timeframe?.trim() || "",
    bullets: bullets.length > 0 ? bullets : [""],
  };
}

/**
 * Lets the canvas import a project straight from the user's profile, same feature the accordion's
 * "+ Import" button + dialog offered before the Phase 2 cutover - just relocated here so deleting
 * ResumeEditorForm.tsx doesn't quietly drop it.
 */
export function ImportProjectsModal({
  profileProjects,
  resumeProjects,
  onImport,
  onClose,
}: {
  profileProjects: ProjectEntry[];
  resumeProjects: ResumeProjectEntry[];
  onImport: (proj: ProjectEntry) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-surface shadow-pop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-projects-title"
        >
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h3 id="import-projects-title" className="font-display text-h3 text-ink">
                Import Projects from Profile
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">Add projects from your profile directly into this resume.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto p-5">
            {profileProjects.map((proj, idx) => {
              const added = resumeProjects.some((p) => p.title.trim().toLowerCase() === proj.title.trim().toLowerCase());
              return (
                <div
                  key={idx}
                  className={`flex flex-col gap-2 rounded-lg border p-4 transition-all ${
                    added ? "border-success/30 bg-success-soft/30" : "border-border bg-paper/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="font-display text-sm font-bold text-ink truncate">{proj.title}</span>
                      {proj.context && <span className="text-xs text-ink-secondary truncate">{proj.context}</span>}
                      {proj.timeframe && <span className="text-[11px] text-ink-muted">{proj.timeframe}</span>}
                    </div>
                    {added ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-success/20 px-2 py-0.5 text-xs font-semibold text-success">
                        ✓ Added
                      </span>
                    ) : (
                      <Button type="button" size="sm" onClick={() => onImport(proj)} className="shrink-0 bg-accent text-on-accent text-xs">
                        + Add to resume
                      </Button>
                    )}
                  </div>

                  {proj.tools && proj.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {proj.tools.map((t) => (
                        <span key={t} className="rounded bg-paper-deep px-1.5 py-0.5 text-[10px] text-ink-secondary">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {proj.description && <p className="line-clamp-2 text-xs text-ink-muted mt-0.5">{proj.description}</p>}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end border-t border-border p-4">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
