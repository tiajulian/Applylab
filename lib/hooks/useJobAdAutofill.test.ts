// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const { useJobAdAutofill } = await import("./useJobAdAutofill");

const AD = "Customer Service Coordinator at Bright Logistics, Parramatta NSW. Full-time.";

describe("useJobAdAutofill", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gives fillFromAd the title from a read of the same ad that's still running", async () => {
    vi.useFakeTimers();
    let respond: (value: unknown) => void = () => {};
    const fetchMock = vi.fn(() => new Promise((resolve) => (respond = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    const setJobTitle = vi.fn();
    const { result } = renderHook(() => useJobAdAutofill({ setJobTitle, setCompanyName: vi.fn() }));

    // Leaving the textarea starts the autofill read after its debounce.
    act(() => result.current.handleJobDescriptionBlur({ target: { value: AD } } as React.FocusEvent<HTMLTextAreaElement>));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The click asks for the title while that read is still out.
    const filled = result.current.fillFromAd(AD);
    respond({ ok: true, json: async () => ({ title: "Customer Service Coordinator", company: "Bright Logistics" }) });

    await expect(filled).resolves.toEqual({ title: "Customer Service Coordinator", company: "Bright Logistics" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setJobTitle).toHaveBeenCalledWith("Customer Service Coordinator");
  });
});
