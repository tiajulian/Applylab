"use client";

import { useEffect, useState } from "react";

/** SSR-safe: starts `false`, corrects on mount via matchMedia, same "use client" pattern used
 * everywhere else in this codebase. Used by FactCheckFixPanel to choose bottom-sheet (mobile) vs
 * popover (desktop) chrome for the same underlying fix content. */
export function useIsMobile(breakpointPx = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [breakpointPx]);
  return isMobile;
}
