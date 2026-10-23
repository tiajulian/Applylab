"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon, LightbulbIcon } from "@/components/ui/icons/LucideIcons";
import { clsx } from "@/lib/utils";

const STAR_SEEN_KEY = "applylab:interview:starHelperSeen";

interface Structure {
  intro?: string;
  parts: { name: string; line: string }[];
}

const STAR: Structure = {
  intro:
    "STAR is a simple way to tell a work story: the Situation, your Task, the Action you took, and the Result.",
  parts: [
    { name: "Situation", line: "Where and when, in a sentence or two." },
    { name: "Task", line: "What you were responsible for." },
    { name: "Action", line: "The steps you took yourself, and why." },
    { name: "Result", line: "What changed because of it." },
  ],
};

const MOTIVATION: Structure = {
  intro: "Past → present → why this job.",
  parts: [
    { name: "Past", line: "What you've done that matters for this job." },
    { name: "Present", line: "Where you are now and what you're good at." },
    { name: "Why this job", line: "Something real from the job ad that draws you." },
  ],
};

const GAP: Structure = {
  intro: "Be honest → what's close → how you're closing it.",
  parts: [
    { name: "Be honest", line: "Say plainly what you haven't done yet." },
    { name: "What's close", line: "Real experience that's related." },
    { name: "How you're closing it", line: "The concrete steps you're taking." },
  ],
};

function structureFor(questionType: string): { structure: Structure; isStar: boolean } | null {
  if (questionType === "motivation") return { structure: MOTIVATION, isStar: false };
  if (questionType === "gap") return { structure: GAP, isStar: false };
  if (questionType === "coding" || questionType === "group_coaching") return null;
  return { structure: STAR, isStar: true };
}

/** Whether this question type gets a structure guide (lets the page skip an empty side column). */
export const hasStructure = (questionType: string) => structureFor(questionType) !== null;

/**
 * "How to structure this", collapsed by default. Opens by itself the very first time someone
 * sees a STAR question, and keeps doing so until they use its toggle (then remembers it was seen),
 * so the term is explained on first use even if it was below the fold or folded by recording.
 * Folds away when recording starts, so the question has the screen; one click reopens it.
 */
export function StructureHelper({ questionType, recording = false }: { questionType: string; recording?: boolean }) {
  const match = structureFor(questionType);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!match?.isStar) return;
    try {
      if (!localStorage.getItem(STAR_SEEN_KEY)) setOpen(true);
    } catch {
      // Storage blocked: stays collapsed, still one click away.
    }
  }, [match?.isStar]);

  function toggle() {
    setOpen((v) => !v);
    if (!match?.isStar) return;
    try {
      localStorage.setItem(STAR_SEEN_KEY, "1");
    } catch {
      // Storage blocked: it just opens by itself again next time.
    }
  }

  useEffect(() => {
    if (recording) setOpen(false);
  }, [recording]);

  if (!match) return null;
  const { structure } = match;

  return (
    <div className="rounded-lg border border-border bg-paper">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-left text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex items-center gap-2">
          <LightbulbIcon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          How to structure this
        </span>
        <ChevronDownIcon className={clsx("h-4 w-4 text-ink-secondary transition-transform duration-fast", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3">
          {structure.intro && <p className="text-sm text-ink-secondary">{structure.intro}</p>}
          <ol className="mt-2 flex flex-col gap-1.5">
            {structure.parts.map((p) => (
              <li key={p.name} className="text-sm">
                <span className="font-semibold text-ink">{p.name}:</span>{" "}
                <span className="text-ink-secondary">{p.line}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
