// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import { AddEntryDialog } from "./AddEntryDialog";
import { EMPTY_PROFILE_ENTRY, type ProfileLibrary } from "@/lib/resume/addEntries";
import type { ResumeContent } from "@/types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const resume: ResumeContent = {
  contact: { name: "", phone: "", email: "", location: "", linkedin: "", work_rights: "" },
  target_titles: [],
  summary: "",
  skills: [],
  tools: [],
  experience: [{ job_title: "Retail Assistant", company: "Kmart", company_description: "", location: "", start_date: "2021", end_date: "2023", bullets: [] }],
  projects: [],
  education: [],
  referees: [],
};

const role = (job_title: string, company: string) => ({ ...EMPTY_PROFILE_ENTRY.experience(), job_title, company });
const library = (work_experience = [role("Barista", "Bean Co"), role("Retail Assistant", "Kmart")]): ProfileLibrary => ({
  work_experience,
  projects: [],
  education: [],
  referees: [],
});

function open(props: Partial<Parameters<typeof AddEntryDialog>[0]> = {}) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  render(
    createElement(ToastProvider, null, createElement(AddEntryDialog, { section: "experience", library: library(), resume, onAdd, onClose, ...props }))
  );
  return { onAdd, onClose };
}

describe("AddEntryDialog", () => {
  it("opens on the profile tab and marks what's already on the resume", () => {
    open();
    expect(screen.getByRole("tab", { name: "From my profile" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("checkbox", { name: /Retail Assistant/ })).toBeDisabled();
    expect(screen.getByText("On resume")).toBeInTheDocument();
  });

  it("adds the ticked profile entries in one go", () => {
    const { onAdd, onClose } = open();
    fireEvent.click(screen.getByRole("checkbox", { name: /Barista/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 role" }));
    expect(onAdd).toHaveBeenCalledWith([expect.objectContaining({ job_title: "Barista" })]);
    expect(onClose).toHaveBeenCalled();
  });

  it("hides the tabs and shows the form when the profile has nothing left to add", () => {
    open({ library: library([role("Retail Assistant", "Kmart")]) });
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Job title")).toHaveFocus();
  });

  it("needs only a job title, and saves the new role to the profile by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const { onAdd } = open({ library: library([]) });

    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add a job title first.");
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Warehouse Assistant" } });
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    expect(onAdd).toHaveBeenCalledWith([expect.objectContaining({ job_title: "Warehouse Assistant" })]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ section: "work_experience", entry: { job_title: "Warehouse Assistant" } });
  });

  it("'Save and add another' keeps the pop-up open with a cleared form", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: true }) }));
    const { onAdd, onClose } = open({ library: library([]) });
    fireEvent.click(screen.getByLabelText(/Also save to my profile/));
    fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Barista" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and add another" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Added: Barista")).toBeInTheDocument();
    expect(screen.getByLabelText("Job title")).toHaveValue("");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks before closing once something's been typed", () => {
    const { onClose } = open({ library: library([]) });
    fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Barista" } });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Close without adding?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes straight away when nothing's been entered", () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("is marked so the canvas keeps its selection while it's open", () => {
    open();
    expect(screen.getByRole("dialog").closest("[data-selection-keep]")).not.toBeNull();
  });
});
