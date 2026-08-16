"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";

export function StaggerList({
  children,
  className,
  staggerChildren,
}: {
  children: ReactNode;
  className?: string;
  staggerChildren?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={staggerContainer(staggerChildren)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  // Deliberately not relying on the parent StaggerList's whileInView state alone: variant
  // propagation only reaches children that were mounted at the time the parent last resolved
  // to "visible". Since the parent uses viewport={{ once: true }}, it never re-fires once a
  // list has already been revealed - so an item appended later (e.g. clicking "+ Add role"
  // after the list is already on screen) mounted at "hidden" and nothing ever told it to
  // animate in, leaving it stuck at opacity: 0 forever. Giving each item its own whileInView
  // means it checks (and animates) itself on mount, regardless of when that mount happens.
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={staggerItem}
    >
      {children}
    </motion.div>
  );
}
