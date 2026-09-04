"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { Button } from "@/components/ui/Button";
import { EASE } from "@/lib/motion";

export function StickyCtaBar() {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const threshold = typeof window !== "undefined" ? window.innerHeight * 0.7 : 500;
    setVisible(latest > threshold);
  });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed inset-x-0 bottom-0 z-40 block min-[900px]:hidden border-t border-border bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-none backdrop-blur"
        >
          <div className="mx-auto flex items-center justify-between gap-3">
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-ink">ApplyLab</span>
              <span className="text-[11px] text-ink-muted">2 applications free, no card</span>
            </div>
            <a href="#score" className="shrink-0">
              <Button size="sm" className="font-bold px-4 text-xs whitespace-nowrap shadow-none">
                Score your resume free &rarr;
              </Button>
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
