// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CoverLetterPreview } from "./CoverLetterPreview";
import type { ResumeContact } from "@/types";

const contact: ResumeContact = {
  name: "Tia Julian", phone: "0400 000 000", email: "tia@example.com", location: "Sydney, NSW", linkedin: "", work_rights: "",
};

// The Reveal wrapper fades the letter in as it scrolls into view; the test environment has no observer.
class InstantIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", InstantIntersectionObserver);
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(over: Partial<Parameters<typeof CoverLetterPreview>[0]> = {}) {
  const props = {
    resumeId: "r1", initialCoverLetter: "Dear Hiring Manager,\n\nI would love to join your team.", contact,
    companyName: "Woolworths Group" as string | null, isPaidPlan: true, isUnlocked: true, downloadingFormat: null, onDownload: vi.fn(), onDownloadLocked: vi.fn(), ...over,
  };
  render(<CoverLetterPreview {...props} />);
  return props;
}
const letter = () => screen.getByLabelText("Cover letter text") as HTMLTextAreaElement;
const patches = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PATCH");
const chooseDownload = (name: RegExp) => {
  fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
  fireEvent.click(screen.getByRole("menuitem", { name }));
};

describe("CoverLetterPreview", () => {
  it("is one sheet of paper: the header from the profile, then the editable letter, and no extra chrome on it", () => {
    setup();
    expect(screen.getByText("Tia Julian")).toBeInTheDocument();
    expect(screen.getByText(/Sydney, NSW/)).toBeInTheDocument();
    expect(letter()).toHaveValue("Dear Hiring Manager,\n\nI would love to join your team.");
    const paper = letter().parentElement as HTMLElement;
    expect(paper.className).toContain("bg-white");
    expect(paper.className).toContain("min-h-[297mm]");
    // The paper matches the PDF, so the "edit your profile" hint lives above it, never on it.
    expect(paper.textContent).not.toMatch(/profile/i);
    expect(screen.getByRole("link", { name: "profile" })).toHaveAttribute("href", "/profile");
  });

  describe("address block", () => {
    const block = () => document.querySelector("[data-recipient]");

    it("shows who the letter is addressed to, between the date and the letter", () => {
      setup({ initialCoverLetter: "Dear Hiring Manager,\n\nHello." });
      expect(block()).toHaveTextContent("Hiring Manager");
      expect(block()).toHaveTextContent("Woolworths Group");
      const date = screen.getByText(/^\d{1,2} \w+ \d{4}$/);
      expect(date.compareDocumentPosition(block() as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect((block() as Node).compareDocumentPosition(letter()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("drops the Hiring Manager line when the letter is addressed to a named person", () => {
      setup({ initialCoverLetter: "Dear Sarah,\n\nHello." });
      expect(block()).toHaveTextContent("Woolworths Group");
      expect(block()).not.toHaveTextContent("Hiring Manager");
    });

    it("follows the greeting as the person edits it", () => {
      setup({ initialCoverLetter: "Dear Hiring Manager,\n\nHello." });
      expect(block()).toHaveTextContent("Hiring Manager");
      fireEvent.change(letter(), { target: { value: "Dear Sarah,\n\nHello." } });
      expect(block()).not.toHaveTextContent("Hiring Manager");
    });

    it("is absent when there is nobody to address", () => {
      setup({ initialCoverLetter: "Dear Sarah,\n\nHello.", companyName: null });
      expect(block()).toBeNull();
    });
  });

  it("lets the person edit the letter, and autosaves it", async () => {
    setup();
    fireEvent.change(letter(), { target: { value: "Dear team, hello." } });
    expect(letter()).toHaveValue("Dear team, hello.");
    await waitFor(() => expect(patches()).toHaveLength(1), { timeout: 3000 });
    const [url, init] = patches()[0] as [string, RequestInit];
    expect(url).toBe("/api/resume/r1");
    expect(JSON.parse(init.body as string)).toEqual({ cover_letter_content: "Dear team, hello." });
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
  });

  it("focuses the letter when the paper's margin or header is clicked", () => {
    setup();
    fireEvent.click(screen.getByText("Tia Julian"));
    expect(letter()).toHaveFocus();
  });

  it("leaves the selection alone when the person is selecting header text to copy it", () => {
    setup();
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Tia" } as unknown as Selection);
    fireEvent.click(screen.getByText("Tia Julian"));
    expect(letter()).not.toHaveFocus();
    vi.restoreAllMocks();
  });

  describe("download", () => {
    it("offers PDF and Word, and calls the download handler", async () => {
      const props = setup();
      chooseDownload(/PDF/);
      await waitFor(() => expect(props.onDownload).toHaveBeenCalledWith("pdf"));
      chooseDownload(/Word/);
      await waitFor(() => expect(props.onDownload).toHaveBeenCalledWith("docx"));
    });

    it("saves an unsaved edit FIRST, so the file is never made from stale text", async () => {
      const props = setup();
      fireEvent.change(letter(), { target: { value: "A fresh edit." } });
      chooseDownload(/PDF/);
      await waitFor(() => expect(props.onDownload).toHaveBeenCalledTimes(1));
      expect(patches()).toHaveLength(1);
      expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan((props.onDownload as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]);
    });

    it("does not save again when nothing changed", async () => {
      const props = setup();
      chooseDownload(/PDF/);
      await waitFor(() => expect(props.onDownload).toHaveBeenCalled());
      expect(patches()).toHaveLength(0);
    });

    it("does not download, and says so, when the save fails", async () => {
      fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Network down" }) });
      const props = setup();
      fireEvent.change(letter(), { target: { value: "Unsaved words." } });
      chooseDownload(/PDF/);
      await waitFor(() => expect(screen.getByText("Network down")).toBeInTheDocument());
      expect(props.onDownload).not.toHaveBeenCalled();
    });

    it("sends a locked free user to the upgrade flow instead of opening the menu", () => {
      const props = setup({ isPaidPlan: false, isUnlocked: false });
      fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
      expect(props.onDownloadLocked).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("is disabled while a download is being prepared", () => {
      setup({ downloadingFormat: "pdf" });
      expect(screen.getByRole("button", { name: "Download cover letter" })).toBeDisabled();
      expect(screen.getByText("Preparing…")).toBeInTheDocument();
    });

    it("closes the menu with Escape", async () => {
      setup();
      fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });
  });
});
