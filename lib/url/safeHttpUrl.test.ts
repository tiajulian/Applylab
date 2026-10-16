import { describe, expect, it } from "vitest";
import { MAX_JOB_URL_LENGTH, parseJobUrlField, safeHttpUrl } from "./safeHttpUrl";

describe("safeHttpUrl", () => {
  it("keeps http(s) links", () => {
    expect(safeHttpUrl(" https://www.adzuna.com.au/land/ad/42?se=abc ")).toBe("https://www.adzuna.com.au/land/ad/42?se=abc");
    // Kept exactly: no re-encoding, no added trailing slash.
    expect(safeHttpUrl("https://example.com?a=b|c")).toBe("https://example.com?a=b|c");
    expect(safeHttpUrl("http://example.com/job")).toBe("http://example.com/job");
  });

  it("refuses anything that isn't a plain web link", () => {
    for (const bad of ["javascript:alert(1)", "JavaScript:alert(1)", "https:seek.com.au/job/1", "http:/x.com", "mailto:a@b.com", "data:text/html,hi", "/relative", "not a url", "hello", "", 42, null]) {
      expect(safeHttpUrl(bad)).toBeNull();
    }
  });

  it("adds https:// to a link typed without one", () => {
    expect(safeHttpUrl("seek.com.au/job/123")).toBe("https://seek.com.au/job/123");
    expect(safeHttpUrl("www.seek.com.au:443/job/1")).toBe("https://www.seek.com.au:443/job/1");
  });

  it("drops a link that is too long instead of cutting it", () => {
    expect(safeHttpUrl(`https://example.com/${"a".repeat(MAX_JOB_URL_LENGTH)}`)).toBeNull();
  });

  it("parses a request's job_url: blank or too long is dropped, junk is an error", () => {
    expect(parseJobUrlField("seek.com.au/job/1")).toEqual({ url: "https://seek.com.au/job/1" });
    expect(parseJobUrlField(undefined)).toEqual({ url: null });
    expect(parseJobUrlField("  ")).toEqual({ url: null });
    expect(parseJobUrlField(`https://x.com/${"a".repeat(2001)}`)).toEqual({ url: null });
    expect(parseJobUrlField("hello there")).toHaveProperty("error");
  });
});
