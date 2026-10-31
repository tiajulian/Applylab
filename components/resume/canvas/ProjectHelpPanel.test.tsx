// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import { ProjectHelpPanel } from "./ProjectHelpPanel";
import type { ResumeProjectEntry } from "@/types";

// The limit message's upgrade buttons use the router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/" }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubApi(reply: { status?: number; body: unknown }) {
  const fetchMock = vi.fn(async (url: string, _options?: RequestInit) => {
    if (String(url) === "/api/projects/enhance") {
      const status = reply.status ?? 200;
      return { ok: status < 400, status, json: async () => reply.body };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const project = (bullets: string[] = []): ResumeProjectEntry => ({ title: "Food drive", context: "Volunteer", year: "2024", bullets });

function open(entry = project()) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  const view = render(createElement(ToastProvider, null, createElement(ProjectHelpPanel, { project: entry, onAdd, onClose })));
  return { onAdd, onClose, rerender: (next: ResumeProjectEntry) => view.rerender(createElement(ToastProvider, null, createElement(ProjectHelpPanel, { project: next, onAdd, onClose }))) };
}

const enhanceCalls = (fetchMock: ReturnType<typeof stubApi>) => fetchMock.mock.calls.filter(([url]) => String(url) === "/api/projects/enhance");

describe("ProjectHelpPanel", () => {
  it("needs 'what did you do' before spending a use", () => {
    const fetchMock = stubApi({ body: { bullets: ["x"] } });
    open();
    fireEvent.click(screen.getByRole("button", { name: /Write bullets/ }));
    expect(screen.getByText("Tell us what you did first.")).toBeInTheDocument();
    expect(enhanceCalls(fetchMock)).toHaveLength(0);
  });

  it("sends the answers with the project's details and adds only the ticked bullets", async () => {
    const fetchMock = stubApi({ body: { bullets: ["Organised 12 volunteers", "Made posters in Canva"] } });
    const { onAdd } = open();
    fireEvent.change(screen.getByLabelText("What did you do?"), { target: { value: "Organised 12 volunteers, made posters" } });
    fireEvent.click(screen.getByRole("button", { name: /Write bullets/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Made posters in Canva" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 bullet" }));

    expect(JSON.parse(enhanceCalls(fetchMock)[0][1]!.body as string)).toMatchObject({
      title: "Food drive",
      context: "Volunteer",
      timeframe: "2024",
      whatYouDid: "Organised 12 volunteers, made posters",
    });
    expect(onAdd).toHaveBeenCalledWith(["Organised 12 volunteers"], false);
  });

  it("starts from the project's bullets and replaces them by default", async () => {
    stubApi({ body: { bullets: ["Ran the food drive"] } });
    const { onAdd } = open(project(["ran it"]));
    expect(screen.getByLabelText("What did you do?")).toHaveValue("ran it");
    fireEvent.click(screen.getByRole("button", { name: /Write bullets/ }));
    expect(await screen.findByLabelText("Replace this project's current bullets")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Add 1 bullet" }));
    expect(onAdd).toHaveBeenCalledWith(["Ran the food drive"], true);
  });

  it("shows the server's message and keeps the answers when it fails", async () => {
    stubApi({ status: 502, body: { error: "Couldn't write bullets from that. Try adding a bit more about what you did." } });
    open();
    fireEvent.change(screen.getByLabelText("What did you do?"), { target: { value: "stuff" } });
    fireEvent.click(screen.getByRole("button", { name: /Write bullets/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't write bullets from that");
    expect(screen.getByLabelText("What did you do?")).toHaveValue("stuff");
  });

  it("shows the upgrade message once free uses are gone", async () => {
    stubApi({ status: 403, body: { code: "FREE_LIMIT_REACHED" } });
    open(project(["ran it"]));
    fireEvent.click(screen.getByRole("button", { name: /Write bullets/ }));
    expect(await screen.findByText("You've used your free project help")).toBeInTheDocument();
  });

  it("protects notes entered in the contribution field on close", async () => {
    stubApi({ body: { bullets: ["Organised volunteers"] } });
    const { onClose } = open();
    fireEvent.change(screen.getByLabelText("What did you do?"), { target: { value: "Organised volunteers" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Keep editing" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("doesn't replace project edits made after requesting help", async () => {
    stubApi({ body: { bullets: ["Organised volunteers"] } });
    const { onAdd, rerender } = open(project(["Helped out"]));
    fireEvent.click(screen.getByRole("button", { name: /Write bullets/ }));
    await screen.findByLabelText("Replace this project's current bullets");
    rerender(project(["My newer bullet"]));
    expect(screen.getByRole("alert")).toHaveTextContent("Your project changed since you asked");
    expect(screen.queryByRole("button", { name: "Add 1 bullet" })).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByLabelText("What did you do?")).toHaveValue("My newer bullet");
  });
});
