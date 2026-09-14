"use client";

import { useEffect } from "react";

export function useLandingObserver() {
  useEffect(() => {
    // 1. Nav elevation sentinel observer
    const header = document.getElementById("site-header");
    const sentinel = document.getElementById("top-sentinel");
    let sentinelObserver: IntersectionObserver | null = null;

    if (header && sentinel) {
      sentinelObserver = new IntersectionObserver(
        ([entry]) => {
          header.classList.toggle("elevated", !entry.isIntersecting);
        },
        { rootMargin: "0px", threshold: 0 }
      );
      sentinelObserver.observe(sentinel);
    }

    // 2. Reduced motion check
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Helper for count-up animation
    function runCountUp(element: HTMLElement) {
      const countTargets = element.querySelectorAll<HTMLElement>("[data-to]");
      countTargets.forEach((el) => {
        const to = parseFloat(el.dataset.to || "0");
        const dec = parseInt(el.dataset.dec || "0", 10);
        const dur = 1700;

        if (prefersReducedMotion) {
          el.textContent = dec > 0 ? to.toFixed(dec) : to.toLocaleString("en-AU");
          return;
        }

        let start: number | null = null;
        const step = (timestamp: number) => {
          if (!start) start = timestamp;
          const progress = Math.min((timestamp - start) / dur, 1);
          // Ease-out cubic: 1 - (1 - p)^3
          const easeOut = 1 - Math.pow(1 - progress, 3);
          const current = to * easeOut;
          el.textContent =
            dec > 0
              ? current.toFixed(dec)
              : Math.round(current).toLocaleString("en-AU");
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            el.textContent =
              dec > 0 ? to.toFixed(dec) : to.toLocaleString("en-AU");
          }
        };
        requestAnimationFrame(step);
      });
    }

    // 3. Single IntersectionObserver for all reveals + count-ups
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          target.classList.add("in");
          if (target.hasAttribute("data-countup") || target.querySelector("[data-to]")) {
            runCountUp(target);
          }
          revealObserver.unobserve(target); // Unobserve immediately
        });
      },
      {
        threshold: 0.01,
        rootMargin: "0px 0px 50px 0px",
      }
    );

    const elements = document.querySelectorAll(".reveal, .stagger");
    elements.forEach((el) => {
      if (prefersReducedMotion) {
        el.classList.add("in");
        if (el.hasAttribute("data-countup") || el.querySelector("[data-to]")) {
          runCountUp(el as HTMLElement);
        }
      } else {
        revealObserver.observe(el);
      }
    });

    return () => {
      sentinelObserver?.disconnect();
      revealObserver.disconnect();
    };
  }, []);
}
