"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTour } from "./TourContext";
import { Button } from "@/components/ui/Button";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export function TourSpotlight() {
  const {
    isTourOpen,
    currentStepIndex,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update target bounding box whenever step changes or on resize/scroll
  useEffect(() => {
    if (!isTourOpen) {
      setTargetRect(null);
      return;
    }

    const updatePosition = () => {
      if (!currentStep.target || isMobile) {
        setTargetRect(null);
        setTooltipPos(null);
        return;
      }

      const element = document.querySelector(currentStep.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        // If element is not visible or has zero size, fallback to center
        if (rect.width === 0 && rect.height === 0) {
          setTargetRect(null);
          setTooltipPos(null);
          return;
        }

        const padding = 6;
        const newRect: TargetRect = {
          top: Math.max(0, rect.top - padding),
          left: Math.max(0, rect.left - padding),
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          bottom: rect.bottom + padding,
          right: rect.right + padding,
        };

        setTargetRect(newRect);

        // Ensure target is in viewport
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else {
        setTargetRect(null);
        setTooltipPos(null);
      }
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isTourOpen, currentStep, isMobile, currentStepIndex]);

  // Position tooltip relative to target rect
  useEffect(() => {
    if (!isTourOpen || !targetRect || isMobile) {
      setTooltipPos(null);
      return;
    }

    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl?.offsetWidth || 380;
    const tooltipHeight = tooltipEl?.offsetHeight || 220;
    const margin = 14;

    let top = targetRect.bottom + margin;
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;

    // Check if bottom placement overflows window
    if (top + tooltipHeight > window.innerHeight - 20) {
      // Place above target
      top = Math.max(20, targetRect.top - tooltipHeight - margin);
    }

    // Prevent horizontal overflow
    if (left + tooltipWidth > window.innerWidth - 20) {
      left = window.innerWidth - tooltipWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }

    setTooltipPos({ top, left });
  }, [targetRect, isTourOpen, isMobile, currentStepIndex]);

  // Lock background scroll when tour is active
  useEffect(() => {
    if (isTourOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isTourOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isTourOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTourOpen, nextStep, prevStep, skipTour]);

  if (!isTourOpen) return null;

  const isCenterModal = !targetRect || isMobile || currentStep.placement === "center";
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none pointer-events-auto">
      {/* SVG Backdrop Scrim with Spotlight Cutout */}
      <svg
        className="absolute inset-0 h-full w-full transition-opacity duration-300"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="applylab-tour-spotlight-mask">
            {/* White covers all (opaque) */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black hole cuts out the target (transparent) */}
            {targetRect && !isCenterModal && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx={8}
                ry={8}
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Dim overlay */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(18, 20, 19, 0.72)"
          mask="url(#applylab-tour-spotlight-mask)"
        />
      </svg>

      {/* Target Glowing Spotlight Ring */}
      <AnimatePresence>
        {targetRect && !isCenterModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: 1,
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
            }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute pointer-events-none rounded-lg border-2 border-accent ring-4 ring-accent/25 shadow-lg shadow-accent/20"
          />
        )}
      </AnimatePresence>

      {/* Tooltip or Centered Card */}
      <div
        className={
          isCenterModal
            ? "fixed inset-0 flex items-center justify-center p-4"
            : "fixed"
        }
        style={
          !isCenterModal && tooltipPos
            ? {
                top: `${tooltipPos.top}px`,
                left: `${tooltipPos.left}px`,
              }
            : undefined
        }
      >
        <motion.div
          ref={tooltipRef}
          key={currentStep.id}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5 shadow-pop sm:p-6 backdrop-blur-md"
        >
          {/* Header Row: Badge & Progress indicator */}
          <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent">
                {currentStep.badge || "Feature Tour"}
              </span>
              <span className="text-xs font-medium text-ink-muted">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
            </div>

            {/* Step progress pills */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    idx === currentStepIndex
                      ? "w-4 bg-accent"
                      : idx < currentStepIndex
                      ? "w-1.5 bg-accent/40"
                      : "w-1.5 bg-border-strong"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Body Content */}
          <div className="mt-4 flex flex-col gap-2">
            <h3 className="font-display text-lg font-bold text-ink">
              {currentStep.title}
            </h3>
            <p className="text-[13.5px] leading-relaxed text-ink-secondary">
              {currentStep.description}
            </p>
          </div>

          {/* Action Footer */}
          <div className="mt-6 flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={skipTour}
              className="text-xs font-semibold text-ink-muted transition-colors hover:text-ink hover:underline focus:outline-none"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  className="rounded-pill px-3 text-xs"
                >
                  ← Back
                </Button>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={nextStep}
                className="rounded-pill px-4 text-xs font-semibold shadow-sm"
              >
                {currentStep.primaryButtonText || (isLastStep ? "Finish" : "Next →")}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
