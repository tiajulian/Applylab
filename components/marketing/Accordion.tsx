"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { clsx } from "@/lib/utils";
import { EASE } from "@/lib/motion";

export interface AccordionItemData {
  question: string;
  answer: string;
}

export function Accordion({ items }: { items: AccordionItemData[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-border rounded border border-border bg-surface">
      {items.map((item, index) => (
        <AccordionRow
          key={item.question}
          item={item}
          isOpen={openIndex === index}
          onToggle={() => setOpenIndex((current) => (current === index ? null : index))}
        />
      ))}
    </div>
  );
}

function AccordionRow({
  item,
  isOpen,
  onToggle,
}: {
  item: AccordionItemData;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const panelId = useId();

  return (
    <div>
      <h3>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-body font-medium text-ink transition-colors duration-fast ease-editorial hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
        >
          {item.question}
          <span
            aria-hidden="true"
            className={clsx(
              "shrink-0 text-ink-muted transition-transform duration-fast ease-editorial",
              isOpen && "rotate-45"
            )}
          >
            +
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            initial={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-ink-secondary sm:px-6">{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
