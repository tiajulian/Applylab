"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { TOUR_STEPS, type TourStep } from "./tourSteps";

interface TourContextType {
  isTourOpen: boolean;
  currentStepIndex: number;
  currentStep: TourStep;
  totalSteps: number;
  startTour: (stepIndex?: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  goToStep: (index: number) => void;
}

const TourContext = createContext<TourContextType | null>(null);

const STORAGE_KEY = "applylab_feature_tour_completed";

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const pathname = usePathname();

  // Auto-prompt / auto-start on first dashboard visit if not completed
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only auto-trigger on the main dashboard page
    if (pathname === "/dashboard") {
      const hasCompleted = localStorage.getItem(STORAGE_KEY);
      if (!hasCompleted) {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
          setCurrentStepIndex(0);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [pathname]);

  const startTour = useCallback((stepIndex = 0) => {
    setCurrentStepIndex(stepIndex);
    setIsTourOpen(true);
  }, []);

  const completeTour = useCallback(() => {
    setIsTourOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, []);

  const skipTour = useCallback(() => {
    setIsTourOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      if (prev < TOUR_STEPS.length - 1) {
        return prev + 1;
      }
      completeTour();
      return prev;
    });
  }, [completeTour]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < TOUR_STEPS.length) {
      setCurrentStepIndex(index);
    }
  }, []);

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];

  return (
    <TourContext.Provider
      value={{
        isTourOpen,
        currentStepIndex,
        currentStep,
        totalSteps: TOUR_STEPS.length,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
        goToStep,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
