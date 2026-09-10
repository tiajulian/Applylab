"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ToastItem } from "./ToastList";

interface ToastContextValue {
  showToast: (message: string, variant?: ToastItem["variant"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// framer-motion (and the toast markup) only loads once a toast is actually shown, instead of
// shipping in the initial JS bundle of every page via the root ToastProvider.
const ToastList = dynamic(() => import("./ToastList").then((mod) => mod.ToastList), {
  ssr: false,
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [hasToasted, setHasToasted] = useState(false);
  const hasToastedRef = useRef(false);

  const showToast = useCallback(
    (message: string, variant: ToastItem["variant"] = "accent") => {
      if (!hasToastedRef.current) {
        hasToastedRef.current = true;
        setHasToasted(true);
      }
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 2600);
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {hasToasted && <ToastList toasts={toasts} />}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
