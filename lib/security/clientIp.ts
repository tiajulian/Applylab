/**
 * Best-effort client IP. Prefers headers Vercel sets itself (a client can't forge them there),
 * then the first x-forwarded-for hop. Returns null only when no proxy header exists at all
 * (local dev / non-Vercel), so callers pick their own fallback rather than sharing one bucket.
 */
export function getClientIp(headers: Pick<Headers, "get">): string | null {
  const raw =
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0];
  return raw?.trim() || null;
}

/**
 * Rate-limit bucket for an IP. IPv6 is collapsed to its /64 so one host can't rotate through its
 * address block to dodge a per-IP limit; IPv4-mapped IPv6 is treated as the plain IPv4.
 */
export function ipRateKey(ip: string): string {
  const mappedV4 = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedV4) return mappedV4[1];
  if (!ip.includes(":")) return ip;

  const [head, tail = ""] = ip.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const missing = Math.max(0, 8 - headGroups.length - tailGroups.length);
  const groups = [...headGroups, ...Array(missing).fill("0"), ...tailGroups];
  return `${groups.slice(0, 4).join(":")}::/64`;
}
