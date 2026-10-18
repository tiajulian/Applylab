// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const showToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast }) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { useApplyFollowUp } = await import("./ApplyFollowUp");

const TARGET = { title: "Venue Manager", company: "Open Pantry", url: "https://www.adzuna.com.au/land/ad/1", resumeId: "res-1" };

function Harness({ onAdded }: { onAdded?: () => void }) {
  const { startApply, cancel, prompt } = useApplyFollowUp({ onAdded });
  return (
    <>
      <button onClick={() => startApply(TARGET)}>Apply</button>
      <button onClick={cancel}>Cancel</button>
      {prompt}
    </>
  );
}

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("useApplyFollowUp", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    showToast.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setVisibility("visible");
  });

  it("asks only after the person leaves for the ad and comes back", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    setVisibility("visible"); // never left: no question
    expect(screen.queryByRole("dialog")).toBeNull();

    setVisibility("hidden");
    setVisibility("visible");
    expect(screen.getByRole("dialog")).toHaveTextContent("Did you apply?");
    expect(screen.getByRole("dialog")).toHaveTextContent("Venue Manager at Open Pantry");
  });

  it("adds the job, with its link and resume, to Applications in one tap", async () => {
    const onAdded = vi.fn();
    render(<Harness onAdded={onAdded} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    setVisibility("hidden");
    setVisibility("visible");
    fireEvent.click(screen.getByRole("button", { name: "Yes, add it" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledOnce());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/applications");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      company_name: "Open Pantry",
      job_title: "Venue Manager",
      job_url: TARGET.url,
      resume_id: "res-1",
      status: "applied",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the add form when the listing has no company to save it under", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ needs_details: true }) } as Response);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    setVisibility("hidden");
    setVisibility("visible");
    fireEvent.click(screen.getByRole("button", { name: "Yes, add it" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/applications?add=1&title=Venue+Manager&url=${encodeURIComponent(TARGET.url)}&resume=res-1`
      )
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("goes away on Not yet, and asks only once per Apply", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    setVisibility("hidden");
    setVisibility("visible");
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    setVisibility("hidden");
    setVisibility("visible");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("doesn't ask once the job was tracked another way", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    setVisibility("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    setVisibility("visible");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("doesn't ask when coming back long after the click", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    setVisibility("hidden");
    now.mockReturnValue(1_000_000 + 31 * 60 * 1000);
    setVisibility("visible");
    expect(screen.queryByRole("dialog")).toBeNull();
    now.mockRestore();
  });
});
