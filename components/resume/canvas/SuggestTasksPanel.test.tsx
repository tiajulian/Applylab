// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import { SuggestTasksPanel } from "./SuggestTasksPanel";
import type { ResumeExperienceEntry, RoleDutyItem } from "@/types";

// The limit message's upgrade buttons use the router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/" }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const role: ResumeExperienceEntry = {
  job_title: "Barista",
  company: "Bean Co",
  company_description: "",
  location: "",
  start_date: "",
  end_date: "",
  bullets: ["Made coffee"],
};

const item = (id: string, duty_text: string, extra: Partial<RoleDutyItem> = {}) =>
  ({ id, suggestion_id: "s1", duty_text, user_edited_text: null, user_state: "pending", category: null, tools: [], stakeholders: [], ...extra }) as RoleDutyItem;
const batch = (...items: RoleDutyItem[]) => ({ ok: true, body: { suggestion: { id: "s1" }, items } });

/** Routes the panel's requests: the free lookup of saved ideas (GET), writing ideas (POST),
 * confirming a task (PATCH), and the free-uses counter. */
function stubApi({ saved = [], posts = [] }: { saved?: RoleDutyItem[]; posts?: Array<{ ok: boolean; body: unknown }> }) {
  const queue = [...posts];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (String(url).startsWith("/api/role-duties?") && method === "GET") {
      return { ok: true, json: async () => (saved.length ? { suggestion: { id: "s1" }, items: saved } : { suggestion: null, items: [] }) };
    }
    if (String(url) === "/api/role-duties" && method === "POST") {
      const next = queue.shift() ?? batch();
      return { ok: next.ok, json: async () => next.body };
    }
    if (method === "PATCH") return { ok: true, json: async () => ({ item: null }) };
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function open() {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  render(createElement(ToastProvider, null, createElement(SuggestTasksPanel, { role, onAdd, onClose })));
  return { onAdd, onClose };
}

const callsWith = (fetchMock: ReturnType<typeof vi.fn>, method: string) => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);

describe("SuggestTasksPanel", () => {
  it("shows ideas already saved for the title straight away, without spending a free use", async () => {
    const fetchMock = stubApi({ saved: [item("1", "Opened the store"), item("2", "Made coffee"), item("3", "Rude to customers", { user_state: "rejected" })] });
    open();
    expect(await screen.findByRole("checkbox", { name: "Opened the store" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: /Made coffee/ })).toBeDisabled();
    expect(screen.getByText("On resume")).toBeInTheDocument();
    // Tasks the candidate turned down on their profile aren't offered again.
    expect(screen.queryByText("Rude to customers")).not.toBeInTheDocument();
    expect(callsWith(fetchMock, "POST")).toHaveLength(0);
  });

  it("with nothing saved, waits for a click before writing new ideas - and asks only once", async () => {
    const fetchMock = stubApi({ posts: [batch(item("1", "Opened the store"))] });
    open();
    const show = await screen.findByRole("button", { name: /Show task ideas/ });
    expect(callsWith(fetchMock, "POST")).toHaveLength(0);
    fireEvent.click(show);
    fireEvent.click(show);
    expect(await screen.findByText("Opened the store")).toBeInTheDocument();
    expect(callsWith(fetchMock, "POST")).toHaveLength(1);
    expect(JSON.parse(callsWith(fetchMock, "POST")[0][1].body)).toMatchObject({ jobTitle: "Barista", company: "Bean Co", regenerate: false });
  });

  it("adds the ticked tasks in list order and records them as done", async () => {
    const fetchMock = stubApi({ saved: [item("1", "Opened the store"), item("2", "Trained new staff")] });
    const { onAdd, onClose } = open();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Trained new staff" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Opened the store" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 2 tasks" }));
    expect(onAdd).toHaveBeenCalledWith(["Opened the store", "Trained new staff"]);
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(callsWith(fetchMock, "PATCH")).toHaveLength(2));
    expect(String(callsWith(fetchMock, "PATCH")[0][0])).toBe("/api/role-duties/s1/items/1");
  });

  it("counts only what actually lands - two ideas worded alike become one bullet", async () => {
    stubApi({ saved: [item("1", "Prepared monthly reports."), item("2", "prepared monthly reports")] });
    const { onAdd } = open();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Prepared monthly reports." }));
    fireEvent.click(screen.getByRole("checkbox", { name: "prepared monthly reports" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 2 tasks" }));
    expect(onAdd).toHaveBeenCalledWith(["Prepared monthly reports."]);
    expect(await screen.findByText(/Added 1 task to Barista/)).toBeInTheDocument();
  });

  it("filters by type of task", async () => {
    stubApi({ saved: [item("1", "Served customers", { category: "Customers" }), item("2", "Cleaned machines", { category: "Equipment" })] });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Equipment" }));
    expect(screen.queryByText("Served customers")).not.toBeInTheDocument();
    expect(screen.getByText("Cleaned machines")).toBeInTheDocument();
  });

  it("shows the limit message when free suggestions have run out", async () => {
    stubApi({ posts: [{ ok: false, body: { error: "limit", code: "FREE_LIMIT_REACHED" } }] });
    open();
    fireEvent.click(await screen.findByRole("button", { name: /Show task ideas/ }));
    expect(await screen.findByText("You've used your free task suggestions")).toBeInTheDocument();
  });

  it("offers Try again after an error, and More ideas asks for a fresh batch", async () => {
    const fetchMock = stubApi({
      posts: [{ ok: false, body: { error: "Server busy" } }, batch(item("1", "Opened the store")), batch(item("1", "Opened the store"), item("2", "Counted the till"))],
    });
    open();
    fireEvent.click(await screen.findByRole("button", { name: /Show task ideas/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Opened the store")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /More ideas/ }));
    expect(await screen.findByText("Counted the till")).toBeInTheDocument();
    expect(JSON.parse(callsWith(fetchMock, "POST")[2][1].body)).toMatchObject({ regenerate: true });
  });

  it("asks before closing with tasks ticked, and a click back in the list carries on", async () => {
    stubApi({ saved: [item("1", "Opened the store", { category: "Store" }), item("2", "Cleaned machines", { category: "Equipment" })] });
    const { onClose } = open();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Opened the store" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Close without adding?")).toBeInTheDocument();
    // Picking a filter chip is a click, not a change - it still means they're carrying on.
    fireEvent.click(screen.getByRole("button", { name: "Store" }));
    expect(screen.queryByText("Close without adding?")).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalled();
  });
});
