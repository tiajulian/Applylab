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
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 shadow-pop backdrop-blur"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p className="hidden text-sm font-medium text-ink sm:block">
              Your resume just needs to catch up.
            </p>
            <Link href="/signup" className="ml-auto">
              <Button size="md">Build your resume free</Button>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
