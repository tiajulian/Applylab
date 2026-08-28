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

  const secret = process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA";
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
