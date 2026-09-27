// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CoverLetterEditor } from "./CoverLetterEditor";

const showToast = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast }) }));

const contact = { name: "Sam Lee", phone: "", email: "sam@example.com", location: "Sydney", linkedin: "", work_rights: "" };

function renderEditor(canExport: boolean) {
  return render(
    <CoverLetterEditor
      id="cl-1"
      initialTitle="Analyst | Cover Letter"
      initialBody={"Dear Hiring Manager,\n\nHello."}
      initialUpdatedAt="2026-09-21T00:00:00.000Z"
      contact={contact}
      company="Suncorp"
      canExport={canExport}
    />
  );
}

const exportCalls = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/export"));

let anchorClick: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(["x"]), json: async () => ({}) }));
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  anchorClick = vi.fn();
  HTMLAnchorElement.prototype.click = anchorClick as unknown as () => void;
  showToast.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("cover letter download", () => {
  it("shows a Download button in the editor", () => {
    renderEditor(true);
    expect(screen.getByRole("button", { name: "Download cover letter" })).toBeInTheDocument();
  });

  it("downloads a PDF through the export route for a Pro user", async () => {
    renderEditor(true);

    fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /PDF/ }));

    await waitFor(() => expect(anchorClick).toHaveBeenCalled());
    const [url, init] = exportCalls()[0];
    expect(url).toBe("/api/cover-letters/cl-1/export");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ format: "pdf" });
  });

  it("downloads a Word document too", async () => {
    renderEditor(true);

    fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Word/ }));

    await waitFor(() => expect(anchorClick).toHaveBeenCalled());
    expect(JSON.parse((exportCalls()[0][1] as RequestInit).body as string)).toEqual({ format: "docx" });
  });

  it("opens the upgrade prompt instead of downloading for a free user", () => {
    renderEditor(false);

    fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Upgrade to Pro to Export");
    expect(exportCalls()).toHaveLength(0);
  });

  it("opens the upgrade prompt if the server says the feature is locked", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403, json: async () => ({ code: "FEATURE_LOCKED" }) } as Response);
    renderEditor(true);

    fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /PDF/ }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Upgrade to Pro to Export");
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it("shows an error, and does not download, when the export fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "Failed to generate the download" }) } as Response);
    renderEditor(true);

    fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /PDF/ }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Failed to generate the download", "critical"));
    expect(anchorClick).not.toHaveBeenCalled();
    // The button is usable again, not stuck on "Preparing…".
    expect(screen.getByRole("button", { name: "Download cover letter" })).not.toBeDisabled();
  });

  it("saves an unsaved edit before exporting, so the file is never stale", async () => {
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).endsWith("/export")
        ? ({ ok: true, status: 200, blob: async () => new Blob(["x"]), json: async () => ({}) } as Response)
        : ({ ok: true, status: 200, json: async () => ({ updatedAt: "2026-09-21T00:00:01.000Z" }) } as Response)
    );
    renderEditor(true);

    fireEvent.change(screen.getByLabelText("Cover letter text"), { target: { value: "Dear Hiring Manager,\n\nEdited." } });
    fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /PDF/ }));

    await waitFor(() => expect(anchorClick).toHaveBeenCalled());
    const calls = vi.mocked(fetch).mock.calls.map(([url, init]) => [String(url), (init as RequestInit)?.method]);
    const saveIndex = calls.findIndex(([url, method]) => url === "/api/cover-letters/cl-1" && method === "PATCH");
    const exportIndex = calls.findIndex(([url]) => String(url).endsWith("/export"));
    expect(saveIndex).toBeGreaterThanOrEqual(0);
    expect(saveIndex).toBeLessThan(exportIndex);
  });

  it("does not export when the pending edit cannot be saved", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "Failed to save" }) } as Response);
    renderEditor(true);

    fireEvent.change(screen.getByLabelText("Cover letter text"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /PDF/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(exportCalls()).toHaveLength(0);
    expect(anchorClick).not.toHaveBeenCalled();
  });
});
