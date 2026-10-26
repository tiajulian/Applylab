/**
 * Verifies a Cloudflare Turnstile CAPTCHA response token against the Cloudflare siteverify endpoint.
 * Defaults to Cloudflare's standard test secret key for local development and CI if not configured.
 */
export async function verifyTurnstileToken(
  token?: string | null,
  remoteIp?: string
): Promise<boolean> {
  if (!token || typeof token !== "string" || !token.trim()) {
    return false;
  }

  // The test secret always passes, so production refuses every token rather than fall back to it.
  const secret =
    process.env.TURNSTILE_SECRET_KEY ||
    (process.env.NODE_ENV === "production" ? null : "1x0000000000000000000000000000000AA");
  if (!secret) {
    console.error("verifyTurnstileToken: TURNSTILE_SECRET_KEY is not set, rejecting the token");
    return false;
  }
  const body = new URLSearchParams({
    secret,
    response: token.trim(),
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error("verifyTurnstileToken error", error);
    return false;
  }
}
