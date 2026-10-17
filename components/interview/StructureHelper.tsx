"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon } from "@/components/ui/icons/LucideIcons";
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

/**
 * "How to structure this", collapsed by default. Opens by itself the very first time someone
 * sees a STAR question (then remembers it was seen), so the term is explained once on first use.
 */
export function StructureHelper({ questionType }: { questionType: string }) {
  const match = structureFor(questionType);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!match?.isStar) return;
    try {
      if (!localStorage.getItem(STAR_SEEN_KEY)) {
        setOpen(true);
        localStorage.setItem(STAR_SEEN_KEY, "1");
      }
    } catch {
      // Storage blocked: stays collapsed, still one click away.
    }
  }, [match?.isStar]);

  if (!match) return null;
  const { structure } = match;

  return (
    <div className="rounded-lg border border-border bg-paper">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-left text-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        How to structure this
        <ChevronDownIcon className={clsx("h-4 w-4 transition-transform duration-fast", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3">
          {structure.intro && <p className="text-sm text-ink-secondary">{structure.intro}</p>}
          <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
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
