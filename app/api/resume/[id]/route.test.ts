import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/requireUser", () => ({
  requireUser: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { createClient } from "@/lib/supabase/server";
import { PATCH } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/resume/[id]", () => {
  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthorizedError("Not authenticated"));

    const req = new Request("http://localhost/api/resume/res-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: "modern" }),
    });

    const res = await PATCH(req, { params: { id: "res-1" } });
    expect(res.status).toBe(401);
  });

  it("updates template to any canonical template for free users", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", email: "user@example.com", plan: "free" } as any,
      isAnonymous: false,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "res-1", template: "modern" },
            error: null,
          }),
        }),
      }),
    });

    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    } as any);

    const req = new Request("http://localhost/api/resume/res-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: "modern" }),
    });

    const res = await PATCH(req, { params: { id: "res-1" } });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ template: "modern" }));
  });

  it("canonicalizes legacy template 'ats-safe' to 'clean'", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", email: "user@example.com", plan: "free" } as any,
      isAnonymous: false,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "res-1", template: "clean" },
            error: null,
          }),
        }),
      }),
    });

    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    } as any);

    const req = new Request("http://localhost/api/resume/res-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: "ats-safe" }),
    });

    const res = await PATCH(req, { params: { id: "res-1" } });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ template: "clean" }));
  });

  it("returns 400 for invalid template name", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", email: "user@example.com", plan: "free" } as any,
      isAnonymous: false,
    });

    const req = new Request("http://localhost/api/resume/res-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: "invalid-template-xyz" }),
    });

    const res = await PATCH(req, { params: { id: "res-1" } });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/resume/[id] - Design & Font panel fields", () => {
  function mockAuthed() {
    vi.mocked(requireUser).mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", email: "user@example.com", plan: "free" } as any,
      isAnonymous: false,
    });
  }

  function mockUpdateReturning(data: Record<string, unknown>) {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn().mockReturnValue({ update: mockUpdate }) } as any);
    return mockUpdate;
  }

  const cases: Array<{ field: string; valid: unknown; invalid: unknown }> = [
    { field: "accent_color", valid: "#1e3a8a", invalid: "#ff00ff" },
    { field: "font_choice", valid: "georgia", invalid: "comic_sans" },
    { field: "margin_preset", valid: "compact", invalid: "huge" },
    { field: "spacing_preset", valid: "spacious", invalid: "loose" },
    { field: "line_height_preset", valid: "relaxed", invalid: "double" },
  ];

  for (const { field, valid, invalid } of cases) {
    it(`accepts a curated ${field} value and persists it`, async () => {
      mockAuthed();
      const mockUpdate = mockUpdateReturning({ id: "res-1", [field]: valid });

      const req = new Request("http://localhost/api/resume/res-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: valid }),
      });

      const res = await PATCH(req, { params: { id: "res-1" } });
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ [field]: valid }));
    });

    it(`rejects an uncurated ${field} value`, async () => {
      mockAuthed();
      const req = new Request("http://localhost/api/resume/res-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: invalid }),
      });

      const res = await PATCH(req, { params: { id: "res-1" } });
      expect(res.status).toBe(400);
    });

    it(`accepts null for ${field} as a reset to the template's own default`, async () => {
      mockAuthed();
      const mockUpdate = mockUpdateReturning({ id: "res-1", [field]: null });

      const req = new Request("http://localhost/api/resume/res-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: null }),
      });

      const res = await PATCH(req, { params: { id: "res-1" } });
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ [field]: null }));
    });
  }
});
