"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // When pathname or searchParams change, mark transition complete
  useEffect(() => {
    if (isNavigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, isNavigating]);

  // Progress animation tick while navigating
  useEffect(() => {
    if (!isNavigating) return;

    setProgress(25);

    const interval1 = setTimeout(() => {
      setProgress(55);
    }, 180);

    const interval2 = setTimeout(() => {
      setProgress(80);
    }, 450);

    const interval3 = setTimeout(() => {
      setProgress((prev) => (prev < 92 ? prev + 3 : prev));
    }, 1200);

    return () => {
      clearTimeout(interval1);
      clearTimeout(interval2);
      clearTimeout(interval3);
    };
  }, [isNavigating]);

  // Intercept clicks on internal links to trigger immediate feedback
  useEffect(() => {
    function handleAnchorClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");

      if (
        !href ||
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#") ||
        targetAttr === "_blank" ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      try {
        const url = new URL(href, window.location.href);
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search &&
          !url.hash
        ) {
          return;
        }

        setIsNavigating(true);
      } catch {
        // Invalid URL, ignore
      }
    }

    document.addEventListener("click", handleAnchorClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
    };
  }, []);

  if (!isNavigating && progress === 0) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] h-[3px] bg-transparent pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full bg-accent transition-all duration-300 ease-out shadow-[0_0_8px_rgba(235,94,40,0.6)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: "width, opacity",
        }}
      />
    </div>
  );
}

export function NavigationProgressBar() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBarInner />
    </Suspense>
  );
}

