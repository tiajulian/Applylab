import { describe, it, expect } from "vitest";
import { isCrossSiteApiMutation } from "./originCheck";

const base = {
  method: "POST",
  pathname: "/api/resume/123",
  origin: "https://app.example.com" as string | null,
  requestOrigin: "https://app.example.com",
  appUrl: "https://app.example.com",
};

describe("isCrossSiteApiMutation", () => {
  it("allows a same-origin POST", () => {
    expect(isCrossSiteApiMutation(base)).toBe(false);
  });

  it("blocks a POST from another site", () => {
    expect(isCrossSiteApiMutation({ ...base, origin: "https://evil.example" })).toBe(true);
  });

  it.each(["PUT", "PATCH", "DELETE"])("blocks a cross-site %s", (method) => {
    expect(isCrossSiteApiMutation({ ...base, method, origin: "https://evil.example" })).toBe(true);
  });

  it("allows safe methods from any origin", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(isCrossSiteApiMutation({ ...base, method, origin: "https://evil.example" })).toBe(false);
    }
  });

  it("allows requests with no Origin header (curl, Stripe webhook)", () => {
    expect(isCrossSiteApiMutation({ ...base, origin: null })).toBe(false);
  });

  it("allows the configured app URL when it differs from the request host", () => {
    expect(
      isCrossSiteApiMutation({ ...base, origin: "https://www.example.com", appUrl: "https://www.example.com/" })
    ).toBe(false);
  });

  it("blocks an unparseable app URL match attempt", () => {
    expect(isCrossSiteApiMutation({ ...base, origin: "https://evil.example", appUrl: "not a url" })).toBe(true);
  });

  it("ignores non-API paths", () => {
    expect(isCrossSiteApiMutation({ ...base, pathname: "/login", origin: "https://evil.example" })).toBe(false);
  });

  it("allows the extension only on its own routes", () => {
    const ext = "chrome-extension://abcdef";
    expect(isCrossSiteApiMutation({ ...base, pathname: "/api/applications", origin: ext })).toBe(false);
    expect(isCrossSiteApiMutation({ ...base, pathname: "/api/copilot/generate-answer", origin: ext })).toBe(false);
    expect(isCrossSiteApiMutation({ ...base, pathname: "/api/resumes/abc/pdf-blob", origin: ext })).toBe(false);
    expect(isCrossSiteApiMutation({ ...base, pathname: "/api/account/delete", origin: ext })).toBe(true);
    expect(isCrossSiteApiMutation({ ...base, pathname: "/api/admin/users", origin: ext })).toBe(true);
  });
});
