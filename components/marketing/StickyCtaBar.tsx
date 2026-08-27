"use client";

import { useState } from "react";
import Link from "next/link";
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
    const threshold = typeof window !== "undefined" ? window.innerHeight * 0.75 : 600;
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
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-pop backdrop-blur"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p className="hidden text-xs sm:text-sm font-semibold text-ink sm:block">
              From job ad to job offer. Your AI job-search copilot, built for Australia 🇦🇺.
            </p>
            <Link href="/signup" className="ml-auto w-full sm:w-auto text-center">
              <Button size="md" className="w-full sm:w-auto font-bold px-6 transition-transform active:scale-95 shadow-sm">
                Start for free &rarr;
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
