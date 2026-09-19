"use client";

import { useEffect } from "react";
import { AlertTriangleIcon } from "@/components/ui/icons/LucideIcons";

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
          backgroundColor: "#fcfbf9",
          color: "#2c2825",
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
            backgroundColor: "#ffffff",
            border: "1px solid #e4dfd7",
            borderRadius: "12px",
            padding: "32px",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(44, 40, 37, 0.08)",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "#fee2e2",
              color: "#dc2626",
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
              color: "#6b625b",
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
                color: "#857c74",
                backgroundColor: "#f5f2ed",
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
                backgroundColor: "#c24e2c",
                color: "#ffffff",
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
            <a
              href="/"
              style={{
                backgroundColor: "transparent",
                color: "#2c2825",
                border: "1px solid #c8c3ba",
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
