import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ErrorBoundary from "../error";
import GlobalError from "../global-error";
import NotFound from "../not-found";

describe("Frontend Error Boundaries & 404 Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("app/error.tsx (ErrorBoundary)", () => {
    it("renders user-friendly message, landmarks, and recovery actions", () => {
      const resetMock = vi.fn();
      const markup = renderToStaticMarkup(
        createElement(ErrorBoundary, {
          error: new Error("Test client error"),
          reset: resetMock,
        })
      );

      expect(markup).toContain("Something went wrong");
      expect(markup).toContain("Try again");
      expect(markup).toContain("Go to Dashboard");
      expect(markup).toContain("Return Home");
      expect(markup).toContain('role="alert"');
      expect(markup).toContain("Dashboard");
      expect(markup).toContain("Home");
    });

    it("displays error reference digest when provided", () => {
      const errorWithDigest = Object.assign(new Error("Crash"), { digest: "ERR_12345" });
      const markup = renderToStaticMarkup(
        createElement(ErrorBoundary, {
          error: errorWithDigest,
          reset: vi.fn(),
        })
      );

      expect(markup).toContain("Error reference: ERR_12345");
    });

    it("strictly forbids em dashes or en dashes in rendered copy", () => {
      const markup = renderToStaticMarkup(
        createElement(ErrorBoundary, {
          error: Object.assign(new Error("Crash"), { digest: "DIGEST_XYZ" }),
          reset: vi.fn(),
        })
      );

      expect(markup.includes("—")).toBe(false);
      expect(markup.includes("–")).toBe(false);
    });
  });

  describe("app/global-error.tsx (GlobalError)", () => {
    it("renders html and body tags with self-contained fallback styles", () => {
      const resetMock = vi.fn();
      const markup = renderToStaticMarkup(
        createElement(GlobalError, {
          error: new Error("Fatal layout error"),
          reset: resetMock,
        })
      );

      expect(markup).toContain("<html");
      expect(markup).toContain("<body");
      expect(markup).toContain("Application Error");
      expect(markup).toContain("Try again");
      expect(markup).toContain("Go to Home");
      expect(markup).toContain('role="alert"');
    });

    it("displays error digest in global error when present", () => {
      const errorWithDigest = Object.assign(new Error("Fatal"), { digest: "FATAL_999" });
      const markup = renderToStaticMarkup(
        createElement(GlobalError, {
          error: errorWithDigest,
          reset: vi.fn(),
        })
      );

      expect(markup).toContain("Error reference: FATAL_999");
    });

    it("strictly forbids em dashes or en dashes in rendered copy", () => {
      const markup = renderToStaticMarkup(
        createElement(GlobalError, {
          error: Object.assign(new Error("Fatal"), { digest: "FATAL_999" }),
          reset: vi.fn(),
        })
      );

      expect(markup.includes("—")).toBe(false);
      expect(markup.includes("–")).toBe(false);
    });
  });

  describe("app/not-found.tsx (NotFound)", () => {
    it("exports proper page metadata for SEO and tab title", async () => {
      const { metadata } = await import("../not-found");
      expect(metadata.title).toBe("Page Not Found | ApplyLab");
      expect(metadata.description).toBeDefined();
    });

    it("renders 404 heading and navigation actions", () => {
      const markup = renderToStaticMarkup(createElement(NotFound));

      expect(markup).toContain("Page not found");
      expect(markup).toContain("404 Error");
      expect(markup).toContain("Go to Dashboard");
      expect(markup).toContain("Return Home");
      expect(markup).toContain("/pricing");
    });

    it("strictly forbids em dashes or en dashes in rendered copy", () => {
      const markup = renderToStaticMarkup(createElement(NotFound));

      expect(markup.includes("—")).toBe(false);
      expect(markup.includes("–")).toBe(false);
    });
  });
});
