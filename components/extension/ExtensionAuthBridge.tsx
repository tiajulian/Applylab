"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { APPLYLAB_EXTENSION_ID } from "@/lib/extensionBridge";

// requireUser() (lib/requireUser.ts) accepts either a Supabase session cookie or a Bearer
// token — the extension needs the latter, since its background service worker's fetch()
// runs cross-site and browsers withhold SameSite=Lax cookies there. chrome.runtime.sendMessage
// with an extension ID is the documented way for a web page to talk to an extension (see
// "externally_connectable" in extension/manifest.json); the extension's onMessageExternal
// listener (extension/src/background/index.ts) stores whatever token arrives here.
function relayToken(token: string | undefined) {
  if (!token) return;
  const chromeRuntime = (globalThis as { chrome?: { runtime?: { sendMessage?: Function; lastError?: unknown } } })
    .chrome?.runtime;
  if (!chromeRuntime?.sendMessage) return;

  chromeRuntime.sendMessage(
    APPLYLAB_EXTENSION_ID,
    { type: "APPLYLAB_SET_AUTH_TOKEN", token },
    () => {
      void chromeRuntime.lastError; // Swallow "Could not establish connection" when the extension isn't installed.
    }
  );
}

export function ExtensionAuthBridge() {
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => relayToken(data.session?.access_token));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      relayToken(session?.access_token);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return null;
}
