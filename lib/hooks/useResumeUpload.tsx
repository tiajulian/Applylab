"use client";

import { useRef, useState } from "react";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";

// How long a click waits for the captcha before giving up. Generous, because when Cloudflare does
// show a challenge the user has to notice and solve it.
const CAPTCHA_WAIT_MS = 60_000;

export const TIMED_OUT_MESSAGE = "Something went wrong, and the request may have timed out. Please try again.";

/**
 * Reads an uploaded resume file into profile fields via /api/profile/parse, with the captcha that
 * endpoint needs. Render `captchaWidget` for as long as a parse may be waiting on it: it's hidden
 * unless Cloudflare needs a click, and remounted after each use (tokens are single-use).
 */
export function useResumeUpload(onError: (message: string) => void) {
  // The parsed upload, kept so a retry after a later failure doesn't read the file again.
  const parsedRef = useRef<{ file: File; profile: unknown } | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const tokenRef = useRef<string | null>(null);
  const tokenWaitersRef = useRef<Array<(token: string) => void>>([]);

  function handleToken(token: string | null) {
    tokenRef.current = token;
    if (!token) return;
    tokenWaitersRef.current.forEach((resolve) => resolve(token));
    tokenWaitersRef.current = [];
  }

  /** The current captcha token, waiting briefly if the invisible check hasn't finished yet. */
  function takeToken(): Promise<string | null> {
    const ready = tokenRef.current
      ? Promise.resolve(tokenRef.current)
      : new Promise<string | null>((resolve) => {
          tokenWaitersRef.current.push(resolve);
          setTimeout(() => resolve(null), CAPTCHA_WAIT_MS);
        });
    return ready.then((token) => {
      // Single use: remount the widget so the next call gets a fresh one. Not on a timeout, which
      // would throw away a challenge the user may still be solving.
      if (token) {
        tokenRef.current = null;
        setCaptchaKey((key) => key + 1);
      }
      return token;
    });
  }

  /** The file's parsed profile fields. Null (with the error reported) when it can't be read. */
  async function parse(upload: File): Promise<unknown | null> {
    if (parsedRef.current?.file === upload) return parsedRef.current.profile;

    const token = await takeToken();
    if (!token) {
      onError("We couldn't confirm you're not a bot. Please try again.");
      return null;
    }

    const formData = new FormData();
    formData.append("file", upload);
    formData.append("turnstileToken", token);
    const response = await fetch("/api/profile/parse", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.profile) {
      onError(data ? data.error ?? "We couldn't read that file. Try another one." : TIMED_OUT_MESSAGE);
      return null;
    }
    parsedRef.current = { file: upload, profile: data.profile };
    return data.profile;
  }

  const captchaWidget = (
    <TurnstileWidget
      key={captchaKey}
      appearance="interaction-only"
      onVerify={handleToken}
      onExpire={() => handleToken(null)}
      onError={() => handleToken(null)}
    />
  );

  // takeToken is returned too, so a caller's next request can use the same widget rather than
  // mounting a second one (which could put two challenges on screen).
  return { parse, takeToken, captchaWidget };
}
