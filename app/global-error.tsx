"use client";

import { useEffect } from "react";
import { AlertTriangleIcon } from "@/components/ui/icons/LucideIcons";

// This page replaces the root layout, so globals.css (and its colour tokens) may not be loaded.
// Same values as the tokens in globals.css :root; keep them in step.
const C = {
  page: "#FAF6F3", // neutral-50
  card: "#FFFFFF", // neutral-0
  ink: "#1F1915", // neutral-900
  secondary: "#5B544E", // neutral-600
  muted: "#726A64", // neutral-500
  codeBg: "#F3EDE9", // neutral-100
  border: "#E6E0DB", // neutral-200
  controlBorder: "#938A84", // neutral-400
  shadow: "rgba(31, 25, 21, 0.08)", // neutral-900
  dangerBg: "#FEEBE9", // danger-50
  danger: "#B32E2A", // danger-700
  accent: "#B74F15", // brand-700
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fatal root error captured by global-error boundary:", error);
  }, [error]);

  return (
    <html lang="en-AU">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: C.page,
          color: C.ink,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          boxSizing: "border-box",
        }}
      >
        <main
          role="alert"
          style={{
            maxWidth: "440px",
            width: "100%",
            backgroundColor: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "12px",
            padding: "32px",
            textAlign: "center",
            boxShadow: `0 4px 20px ${C.shadow}`,
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: C.dangerBg,
              color: C.danger,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <AlertTriangleIcon className="h-6 w-6" />
          </div>

          <h1
            style={{
              fontSize: "24px",
              fontWeight: 600,
              margin: "0 0 8px 0",
              letterSpacing: "-0.01em",
            }}
          >
            Application Error
          </h1>
          <p
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              color: C.secondary,
              margin: "0 0 20px 0",
            }}
          >
            A critical error interrupted the application. Please try reloading the page.
          </p>

          {error?.digest && (
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "12px",
                color: C.muted,
                backgroundColor: C.codeBg,
                padding: "6px 12px",
                borderRadius: "6px",
                marginBottom: "20px",
                display: "inline-block",
              }}
            >
              Error reference: {error.digest}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                backgroundColor: C.accent,
                color: C.card,
                border: "none",
                borderRadius: "9999px",
                padding: "10px 22px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "opacity 140ms ease",
              }}
            >
              Try again
            </button>
            {/* A full page load on purpose: this page replaces the root layout, so the client
                router can't be relied on to recover from here. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                backgroundColor: "transparent",
                color: C.ink,
                border: `1px solid ${C.controlBorder}`,
                borderRadius: "9999px",
                padding: "10px 22px",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Go to Home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
