import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    UnauthorizedError,
    requireUser: vi.fn(),
    letter: { current: null as unknown },
    updateSpy: vi.fn(),
    eqSpy: vi.fn(),
    generatePdf: vi.fn(),
    generateDocx: vi.fn(),
    releaseSlot: vi.fn(),
  };
});

vi.mock("@/lib/requireUser", () => ({ requireUser: mocks.requireUser, UnauthorizedError: mocks.UnauthorizedError }));
vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  acquireHeavySlots: vi.fn().mockResolvedValue({ release: mocks.releaseSlot }),
}));
vi.mock("@/lib/pdf/generatePDF", () => ({ generateCoverLetterPDF: mocks.generatePdf }));
vi.mock("@/lib/export/coverLetterDocx", () => ({ generateCoverLetterDocx: mocks.generateDocx }));

vi.mock("@/lib/supabase/server", () => {
  const readChain = () => {
    const node: Record<string, unknown> = {};
    for (const method of ["select", "is"]) node[method] = () => node;
    node.eq = (column: string, value: unknown) => {
      mocks.eqSpy(column, value);
      return node;
    };
    node.maybeSingle = () => Promise.resolve({ data: mocks.letter.current });
    return node;
  };
  const writeChain = (values: unknown) => {
    mocks.updateSpy(values);
    const node: Record<string, unknown> = {};
    node.eq = () => node;
    node.then = (resolve: (v: unknown) => void) => resolve({ error: null });
    return node;
  };
  return {
    createClient: () => ({ from: () => readChain() }),
    createServiceRoleClient: () => ({ from: () => ({ update: writeChain }) }),
  };
});

const LETTER = {
  title: "Analyst - Suncorp | Cover Letter",
  company: "Suncorp",
  content: { contact: { name: "Sam Lee", email: "sam@example.com" }, body: "Dear Hiring Manager,\n\nHello.\n\nKind regards,\nSam" },
};
const params = { params: { id: "cl-1" } };

function post(body: unknown) {
  return new Request("http://localhost/api/cover-letters/cl-1/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function load() {
  vi.resetModules();
  return (await import("./route")).POST;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.letter.current = LETTER;
  mocks.requireUser.mockResolvedValue({ authUserId: "u1", appUser: { id: "u1", plan: "pro" } });
  mocks.generatePdf.mockResolvedValue(Buffer.from("pdf-bytes"));
  mocks.generateDocx.mockResolvedValue(Buffer.from("docx-bytes"));
});

describe("POST /api/cover-letters/[id]/export", () => {
  it("returns the letter as a PDF for a Pro user, and marks it downloaded", async () => {
    const POST = await load();
    const response = await POST(post({ format: "pdf" }), params);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Analyst - Suncorp Cover Letter.pdf"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("pdf-bytes");
    expect(mocks.generatePdf).toHaveBeenCalledWith(LETTER.content.body, expect.objectContaining({ name: "Sam Lee" }), "Suncorp");
    // Only `status`: touching updated_at would break the editor's autosave version check.
    expect(mocks.updateSpy).toHaveBeenCalledWith({ status: "downloaded" });
    expect(mocks.releaseSlot).toHaveBeenCalled();
  });

  it("returns the letter as a Word document", async () => {
    const POST = await load();
    const response = await POST(post({ format: "docx" }), params);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("wordprocessingml");
    expect(mocks.generateDocx).toHaveBeenCalledWith(LETTER.content.body, expect.anything(), "Suncorp");
    expect(mocks.generatePdf).not.toHaveBeenCalled();
  });

  it("refuses free users with a locked-feature response, before touching the letter", async () => {
    mocks.requireUser.mockResolvedValue({ authUserId: "u1", appUser: { id: "u1", plan: "free" } });
    const POST = await load();
    const response = await POST(post({ format: "pdf" }), params);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("FEATURE_LOCKED");
    expect(mocks.generatePdf).not.toHaveBeenCalled();
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it("looks the letter up by the signed-in user, so another user's letter is a 404", async () => {
    mocks.letter.current = null;
    const POST = await load();
    const response = await POST(post({ format: "pdf" }), params);

    expect(response.status).toBe(404);
    expect(mocks.eqSpy).toHaveBeenCalledWith("user_id", "u1");
    expect(mocks.generatePdf).not.toHaveBeenCalled();
  });

  it("rejects an unknown format", async () => {
    const POST = await load();
    expect((await POST(post({ format: "txt" }), params)).status).toBe(400);
    expect((await POST(post({}), params)).status).toBe(400);
  });

  it("will not export an empty letter", async () => {
    mocks.letter.current = { ...LETTER, content: { contact: {}, body: "   " } };
    const POST = await load();
    const response = await POST(post({ format: "pdf" }), params);

    expect(response.status).toBe(400);
    expect(mocks.generatePdf).not.toHaveBeenCalled();
  });

  it("401s when logged out", async () => {
    mocks.requireUser.mockRejectedValue(new mocks.UnauthorizedError());
    const POST = await load();
    expect((await POST(post({ format: "pdf" }), params)).status).toBe(401);
  });

  it("releases the PDF slot and returns a 500 when generation fails", async () => {
    mocks.generatePdf.mockRejectedValue(new Error("chromium crashed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const POST = await load();
    const response = await POST(post({ format: "pdf" }), params);

    expect(response.status).toBe(500);
    expect(mocks.releaseSlot).toHaveBeenCalled();
    expect(mocks.updateSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
