import { describe, it, expect } from "vitest";
import { getClientIp, ipRateKey } from "./clientIp";

const h = (o: Record<string, string>) => new Headers(o);

describe("getClientIp", () => {
  it("prefers Vercel-set headers over a spoofable x-forwarded-for", () => {
    expect(getClientIp(h({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "9.9.9.9" }))).toBe("1.1.1.1");
  });
  it("falls back to the first x-forwarded-for hop, then null", () => {
    expect(getClientIp(h({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(getClientIp(h({}))).toBeNull();
  });
});

describe("ipRateKey", () => {
  it("leaves IPv4 alone and unwraps IPv4-mapped IPv6", () => {
    expect(ipRateKey("1.2.3.4")).toBe("1.2.3.4");
    expect(ipRateKey("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });
  it("collapses IPv6 to its /64", () => {
    expect(ipRateKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(ipRateKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });
});
