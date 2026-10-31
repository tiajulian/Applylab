// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SummaryHelpPanel } from "./SummaryHelpPanel";
import * as FreeUsage from "@/lib/hooks/useFreeUsesLeft";

// The limit message's upgrade buttons use the router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/" }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Answers the summary request with `reply`; the free-uses counter gets an empty answer. */
function stubApi(reply: { status?: number; body: unknown }) {
  const fetchMock = vi.fn(async (url: string, _options?: RequestInit) => {
    if (String(url).endsWith("/summary")) {
      const status = reply.status ?? 200;
      return { ok: status < 400, status, json: async () => reply.body };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function open(props: Partial<Parameters<typeof SummaryHelpPanel>[0]> = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const all = { resumeId: "r1", currentSummary: "", targetTitle: "Office Administrator", onApply, onClose, ...props };
  const view = render(createElement(SummaryHelpPanel, all));
  return { onApply, onClose, rerender: (next: Partial<typeof all>) => view.rerender(createElement(SummaryHelpPanel, { ...all, ...next })) };
}

const summaryCalls = (fetchMock: ReturnType<typeof stubApi>) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/summary"));

describe("SummaryHelpPanel", () => {
  it("offers an upgrade without sending an AI request when the allowance is exhausted", async () => {
    const fetchMock = stubApi({ body: { summary: "Unused" } });
    vi.spyOn(FreeUsage, "useFreeUsesLeft").mockReturnValue(0);
    open();
    fireEvent.click(screen.getByRole("button", { name: /See summary options/ }));
    expect(await screen.findByText("You've used your free summary")).toBeInTheDocument();
    expect(summaryCalls(fetchMock)).toHaveLength(0);
  });
  it("doesn't call the AI until asked, then sends the role and notes", async () => {
    const fetchMock = stubApi({ body: { summary: "Customer-focused retail worker." } });
    open();
    expect(summaryCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByLabelText("Role you're aiming for (optional)")).toHaveValue("Office Administrator");

    fireEvent.change(screen.getByLabelText(/Anything else we should know/), { target: { value: "Moving into admin" } });
    fireEvent.click(screen.getByRole("button", { name: /Write my summary/ }));

    await screen.findByLabelText("Suggested summary (you can edit it)");
    expect(JSON.parse(summaryCalls(fetchMock)[0][1]!.body as string)).toEqual({ currentSummary: "", targetRole: "Office Administrator", notes: "Moving into admin" });
  });

  it("applies the (edited) suggestion only when the user says so", async () => {
    stubApi({ body: { summary: "Customer-focused retail worker." } });
    const { onApply, onClose } = open();
    fireEvent.click(screen.getByRole("button", { name: /Write my summary/ }));
    const box = await screen.findByLabelText("Suggested summary (you can edit it)");
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "Friendly retail worker." } });
    fireEvent.click(screen.getByRole("button", { name: "Use this summary" }));
    expect(onApply).toHaveBeenCalledWith("Friendly retail worker.");
    expect(onClose).toHaveBeenCalled();
  });

  it("'Keep mine' leaves the summary alone", async () => {
    stubApi({ body: { summary: "New one." } });
    const { onApply } = open({ currentSummary: "My own summary." });
    fireEvent.click(screen.getByRole("button", { name: /Improve my summary/ }));
    await screen.findByText("My own summary.");
    fireEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(onApply).not.toHaveBeenCalled();
  });

  it("warns instead of quietly replacing a summary edited while it was being written", async () => {
    stubApi({ body: { summary: "New one." } });
    const { rerender, onApply } = open({ currentSummary: "Old." });
    fireEvent.click(screen.getByRole("button", { name: /Improve my summary/ }));
    await screen.findByLabelText("Suggested summary (you can edit it)");
    rerender({ currentSummary: "Old, then edited." });
    expect(screen.getByRole("alert")).toHaveTextContent("Your summary changed while this was being written");
    expect(screen.queryByRole("button", { name: "Replace anyway" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Role you're aiming for (optional)")).toBeInTheDocument();
  });

  it("keeps the user's notes and asks for more when there isn't enough to go on", async () => {
    stubApi({ body: { needsMoreDetail: true, message: "Add a role, project or qualification first." } });
    open();
    fireEvent.change(screen.getByLabelText(/Anything else we should know/), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: /Write my summary/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Add a role, project or qualification first.");
    expect(screen.getByLabelText(/Anything else we should know/)).toHaveValue("Hi");
  });

  it("shows the upgrade message once the free use is gone", async () => {
    stubApi({ status: 403, body: { code: "FREE_LIMIT_REACHED", error: "Free summary suggestion limit reached" } });
    open();
    fireEvent.click(screen.getByRole("button", { name: /Write my summary/ }));
    expect(await screen.findByText("You've used your free summary")).toBeInTheDocument();
  });

  it("keeps the form and shows the error when the request fails", async () => {
    stubApi({ status: 502, body: { error: "Couldn't write a summary we could check against your resume." } });
    open();
    fireEvent.change(screen.getByLabelText("Role you're aiming for (optional)"), { target: { value: "Receptionist" } });
    fireEvent.click(screen.getByRole("button", { name: /Write my summary/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't write a summary"));
    expect(screen.getByLabelText("Role you're aiming for (optional)")).toHaveValue("Receptionist");
  });
});
