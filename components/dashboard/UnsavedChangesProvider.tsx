"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface UnsavedChangesContextValue {
  /** Forms call this whenever their dirty state changes. */
  setDirty: (isDirty: boolean) => void;
  /**
   * Resolves `true` immediately if nothing is dirty. If something is dirty, shows a confirm
   * dialog and resolves based on the user's choice - `true` to proceed (and clears dirty state),
   * `false` to stay put.
   */
  confirmLeave: () => Promise<boolean>;
}

// Default (no provider mounted) is a no-op guard, not a throw - UserAvatarMenu and Logo render
// both inside the dashboard (where a provider IS mounted) and on the public marketing site
// (where one deliberately isn't, since there's nothing there to guard).
const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  setDirty: () => {},
  confirmLeave: async () => true,
});

export function useUnsavedChangesGuard() {
  return useContext(UnsavedChangesContext);
}

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const isDirtyRef = useRef(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const setDirty = useCallback((isDirty: boolean) => {
    isDirtyRef.current = isDirty;
  }, []);

  const confirmLeave = useCallback(() => {
    if (!isDirtyRef.current) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setIsPrompting(true);
    });
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      // Modern browsers ignore any custom string and show their own generic prompt - setting
      // returnValue is what actually triggers it.
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  function resolve(canLeave: boolean) {
    setIsPrompting(false);
    if (canLeave) isDirtyRef.current = false;
    resolverRef.current?.(canLeave);
    resolverRef.current = null;
  }

  return (
    <UnsavedChangesContext.Provider value={{ setDirty, confirmLeave }}>
      {children}
      {isPrompting && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          description="If you leave now, the details you've entered won't be saved."
          confirmLabel="Leave"
          cancelLabel="Stay"
          isDestructive
          onConfirm={() => resolve(true)}
          onCancel={() => resolve(false)}
        />
      )}
    </UnsavedChangesContext.Provider>
  );
}
