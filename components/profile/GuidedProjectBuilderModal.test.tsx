// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProjectCard } from "./ProjectCard";
import { ToastProvider } from "@/components/ui/Toast";
import { EMPTY_PROFILE_ENTRY } from "@/lib/resume/addEntries";
import type { ProjectEntry } from "@/types";

const { gate } = vi.hoisted(() => ({ gate: vi.fn() }));
vi.mock("@/components/auth/AccountGate", () => ({ useAccountGate: () => ({ requireAccount: gate }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/profile" }));

beforeEach(() => { gate.mockReset(); gate.mockResolvedValue(true); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const project: ProjectEntry = { ...EMPTY_PROFILE_ENTRY.projects(), title: "Food drive", description: "Organised volunteers", outcome: "Filled the pantry", outcome_metric: "40 volunteers" };

function stubApi(fails = false) {
  const fetchMock = vi.fn(async (url: string, _options?: RequestInit) => {
    if (url === "/api/projects/enhance") return { ok: !fails, status: fails ? 502 : 200, json: async () => fails ? { error: "Please try again" } : { bullets: ["Organised volunteers for a food drive."] } };
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function open() {
  const onUpdate = vi.fn();
  const view = render(<ToastProvider><ProjectCard entry={project} index={0} onUpdate={onUpdate} onRemove={() => {}} /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Write with AI" }));
  return { ...view, onUpdate, rerenderProject: (entry: ProjectEntry) => view.rerender(<ToastProvider><ProjectCard entry={entry} index={0} onUpdate={onUpdate} onRemove={() => {}} /></ToastProvider>) };
}

it("saves explicitly cleared outcome and metric fields through the profile card", async () => {
  const fetchMock = stubApi();
  const { onUpdate } = open();
  fireEvent.change(screen.getByLabelText("What happened? (optional)"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("A number, if you have one"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: /Write it up/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Use this" }));
  expect(onUpdate).toHaveBeenCalledWith({ description: "• Organised volunteers for a food drive.", outcome: "", outcome_metric: "" });
  const call = fetchMock.mock.calls.find(([url]) => url === "/api/projects/enhance")!;
  expect(JSON.parse(call[1]!.body as string)).toMatchObject({ result: "", metric: "" });
});

it("reloads newer project facts when returning from a stale suggestion", async () => {
  stubApi();
  const { rerenderProject, onUpdate } = open();
  fireEvent.click(screen.getByRole("button", { name: /Write it up/ }));
  await screen.findByRole("button", { name: "Use this" });
  rerenderProject({ ...project, description: "Made posters", outcome: "Restocked the pantry", outcome_metric: "" });
  expect(screen.getByRole("button", { name: "Use this" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByLabelText("What did you do?")).toHaveValue("Made posters");
  expect(screen.getByLabelText("What happened? (optional)")).toHaveValue("Restocked the pantry");
  expect(screen.getByLabelText("A number, if you have one")).toHaveValue("");
  expect(onUpdate).not.toHaveBeenCalled();
});

it("doesn't start an AI request if the panel closes during the account check", async () => {
  let allow!: (value: boolean) => void;
  gate.mockReturnValueOnce(new Promise<boolean>((resolve) => { allow = resolve; }));
  const fetchMock = stubApi();
  const { unmount } = open();
  fireEvent.click(screen.getByRole("button", { name: /Write it up/ }));
  expect(gate).toHaveBeenCalledTimes(1);
  unmount();
  await act(async () => { allow(true); });
  expect(fetchMock.mock.calls.filter(([url]) => url === "/api/projects/enhance")).toHaveLength(0);
});

it("keeps all answers when the server fails", async () => {
  stubApi(true);
  open();
  fireEvent.change(screen.getByLabelText("What did you do?"), { target: { value: "Made posters" } });
  fireEvent.click(screen.getByRole("button", { name: /Write it up/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
  expect(screen.getByLabelText("What did you do?")).toHaveValue("Made posters");
  expect(screen.getByLabelText("What happened? (optional)")).toHaveValue("Filled the pantry");
});
