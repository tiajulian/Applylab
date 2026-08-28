"use client";

import { useEffect, useRef } from "react";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
  theme?: "light" | "dark" | "auto";
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

let turnstileScriptLoading = false;
let turnstileScriptLoaded = false;

function loadTurnstileScript(onLoad: () => void) {
  if (typeof window === "undefined") return;

  if (window.turnstile) {
    onLoad();
    return;
  }

  if (turnstileScriptLoaded) {
    onLoad();
    return;
  }

  if (turnstileScriptLoading) {
    const existingCallback = window.onTurnstileLoaded;
    window.onTurnstileLoaded = () => {
      existingCallback?.();
      onLoad();
    };
    return;
  }

  turnstileScriptLoading = true;
  window.onTurnstileLoaded = () => {
    turnstileScriptLoading = false;
    turnstileScriptLoaded = true;
    onLoad();
  };

  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoaded&render=explicit";
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  className = "",
  theme = "auto",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const siteKey =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

    loadTurnstileScript(() => {
      if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            onVerify(token);
          },
          "expired-callback": () => {
            onExpire?.();
          },
          "error-callback": () => {
            onError?.();
          },
          theme,
        });
      } catch (err) {
        console.error("Failed to render Turnstile widget", err);
      }
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore removal errors during unmount
        }
        widgetIdRef.current = null;
      }
    };
  }, [onVerify, onExpire, onError, theme]);

  return <div ref={containerRef} className={className} />;
}
