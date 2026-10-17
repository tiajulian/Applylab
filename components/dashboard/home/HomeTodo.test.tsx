// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AttentionItem } from "@/lib/dashboard/attention";

const showToast = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/components/dashboard/FollowupModal", () => ({ FollowupModal: () => null }));
vi.mock("@/components/upgrade/FreeUsesLeft", () => ({ FreeUsesLeft: () => null }));

const { TodoProvider, TodoSection, TodoCountLine } = await import("./HomeTodo");

function item(overrides: Partial<AttentionItem>): AttentionItem {
  return {
    id: "x",
    type: "followup_due",
    urgencyWeight: 1,
    title: "",
    subtitle: "",
    badgeLabel: "",
    badgeVariant: "accent",
    actionLabel: "",
    companyName: "Canva",
    jobTitle: "Engineer",
    ...overrides,
  };
}

const ITEMS = [
  item({ id: "outcome-r1", type: "outcome_needed", title: "How did your panel interview with Canva go?", applicationId: "a1", interviewId: "r1" }),
  item({ id: "outcome-r0", type: "outcome_needed", title: "How did your phone screen with Canva go?", applicationId: "a1", interviewId: "r0" }),
  item({ id: "followup-a1", title: "Follow up with Canva", applicationId: "a1", interviewId: "r1" }),
  item({ id: "followup-a2", title: "Follow up with Atlassian", applicationId: "a2" }),
];

function renderTodo() {
  render(
    <TodoProvider items={ITEMS}>
      <p data-testid="line">
        <TodoCountLine />
      </p>
      <TodoSection />
    </TodoProvider>
  );
}

describe("TodoSection", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true });
    showToast.mockClear();
    refresh.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("'They said no' saves, hides that application's follow-up, and Undo brings it back", async () => {
    renderTodo();
    expect(screen.getByTestId("line")).toHaveTextContent("You have 4 things to do this week.");

    fireEvent.click(screen.getAllByRole("button", { name: "They said no" })[0]);

    expect(screen.getByRole("status")).toHaveTextContent("Saved. We moved it to Closed.");
    // The application is closed: its follow-up and its other interview question go too.
    expect(screen.queryByText("Follow up with Canva")).not.toBeInTheDocument();
    expect(screen.queryByText("How did your phone screen with Canva go?")).not.toBeInTheDocument();
    expect(screen.getByText("Follow up with Atlassian")).toBeInTheDocument();
    expect(screen.getByTestId("line")).toHaveTextContent("You have 1 thing to do this week.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus());
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/a1/interviews/r1/result",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ result: "no" }) })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByText("Follow up with Canva")).toBeInTheDocument();
    expect(screen.getByText("How did your phone screen with Canva go?")).toBeInTheDocument();
    expect(screen.getByTestId("line")).toHaveTextContent("You have 4 things to do this week.");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/applications/a1/interviews/r1/result",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("'Not sure yet' leaves the follow-ups alone", () => {
    renderTodo();
    fireEvent.click(screen.getAllByRole("button", { name: "Not sure yet" })[0]);
    expect(screen.getByText("Follow up with Canva")).toBeInTheDocument();
    expect(screen.getByTestId("line")).toHaveTextContent("You have 3 things to do this week.");
  });

  it("rolls the row back and says so when the save fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    renderTodo();
    fireEvent.click(screen.getAllByRole("button", { name: "Went well" })[0]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Went well" })).toHaveLength(2));
    expect(showToast).toHaveBeenCalledWith("Couldn't save that. Please try again.", "critical");
    expect(screen.getByTestId("line")).toHaveTextContent("You have 4 things to do this week.");
  });

  it("'Went well' only pushes back the follow-up about that same interview", () => {
    renderTodo();
    const [panel, phone] = screen.getAllByRole("button", { name: "Went well" });
    fireEvent.click(phone); // r0: the follow-up is about r1, so it stays
    expect(screen.getByText("Follow up with Canva")).toBeInTheDocument();
    fireEvent.click(panel); // r1: that follow-up waits 3 more days
    expect(screen.queryByText("Follow up with Canva")).not.toBeInTheDocument();
    expect(screen.getByTestId("line")).toHaveTextContent("You have 1 thing to do this week.");
  });

  it("refreshes the list when the interview was already answered elsewhere", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409 });
    renderTodo();
    fireEvent.click(screen.getAllByRole("button", { name: "They said no" })[0]);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith("That interview was already updated, so your list has been refreshed.", "attention");
  });
});
