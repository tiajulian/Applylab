import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { TERMS_VERSION } from "@/lib/terms";

let currentUser: { id: string; is_anonymous: boolean } | null = null;
let appUserRow: { onboarded: boolean; accepted_terms_at: string | null; accepted_terms_version: string | null } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: appUserRow }) }) }) }),
  }),
}));

import { updateSession } from "./middleware";

const REPORT = "/resume/6c0bd3da-7d5e-4cf0-9882-8574b9e54786/review";

function signedIn({ onboarded }: { onboarded: boolean }) {
  currentUser = { id: "user-1", is_anonymous: false };
  appUserRow = { onboarded, accepted_terms_at: "2026-10-27T00:00:00Z", accepted_terms_version: TERMS_VERSION };
}

async function visit(path: string, { ticket = false, headers = {} as Record<string, string> } = {}) {
  const request = new NextRequest(`https://applylab.io${path}`, {
    headers: { ...headers, ...(ticket ? { cookie: "score_claim=tok" } : {}) },
  });
  const response = await updateSession(request);
  const location = response.headers.get("location");
  return {
    redirect: location ? new URL(location).pathname : null,
    droppedTicket: /score_claim=;/.test(response.headers.get("set-cookie") ?? ""),
  };
}

describe("updateSession: onboarding and the resume-score report", () => {
  it("lets a new account open a score report before onboarding", async () => {
    signedIn({ onboarded: false });
    expect((await visit(REPORT)).redirect).toBeNull();
  });

  it("still sends a new account to onboarding from any other page", async () => {
    signedIn({ onboarded: false });
    expect((await visit("/dashboard")).redirect).toBe("/onboarding");
    expect((await visit("/resume/6c0bd3da-7d5e-4cf0-9882-8574b9e54786")).redirect).toBe("/onboarding");
    expect((await visit(`${REPORT}/extra`)).redirect).toBe("/onboarding");
  });
});

describe("updateSession: a held resume-score ticket", () => {
  it("is never claimed by middleware, and is dropped once a signed-in user loads an app page", async () => {
    signedIn({ onboarded: true });
    expect(await visit("/dashboard", { ticket: true })).toEqual({ redirect: null, droppedTicket: true });
    expect((await visit("/", { ticket: true })).droppedTicket).toBe(true);
  });

  it("is dropped on redirects too, e.g. a new account being sent to onboarding", async () => {
    signedIn({ onboarded: false });
    expect(await visit("/dashboard", { ticket: true })).toEqual({ redirect: "/onboarding", droppedTicket: true });
  });

  it("survives the scorer's own hand-off: score page, claim, callback, log in", async () => {
    signedIn({ onboarded: true });
    for (const path of ["/resume-score", "/resume-score/claim", "/auth/callback", "/login"]) {
      expect((await visit(path, { ticket: true })).droppedTicket).toBe(false);
    }
  });

  it("survives background requests (API calls, link prefetches)", async () => {
    signedIn({ onboarded: true });
    expect((await visit("/api/marketing/session", { ticket: true })).droppedTicket).toBe(false);
    expect((await visit("/dashboard", { ticket: true, headers: { "next-router-prefetch": "1" } })).droppedTicket).toBe(false);
  });

  it("is kept for a visitor who isn't signed in, and for a guest", async () => {
    currentUser = null;
    expect((await visit("/resume-score", { ticket: true })).droppedTicket).toBe(false);
    currentUser = { id: "guest-1", is_anonymous: true };
    expect((await visit("/onboarding", { ticket: true })).droppedTicket).toBe(false);
  });
});
