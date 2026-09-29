// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import type { JobDto, MatchItem } from "@/lib/jobs/client";

const api = vi.hoisted(() => ({
  saveJobProfile: vi.fn(),
  resetJobProfile: vi.fn(),
  getMatches: vi.fn(),
  addInteraction: vi.fn(),
  removeInteraction: vi.fn(),
}));

vi.mock("@/lib/jobs/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/client")>()),
  ...api,
}));

const { JobCard } = await import("./JobCard");
const { JobProfileForm } = await import("./JobProfileForm");
const { MatchesView } = await import("./MatchesView");
const { ApiError } = await import("@/lib/jobs/client");
const { EMPTY_PROFILE } = await import("@/lib/jobs/profile");

const APPLY_URL = "https://www.adzuna.com.au/land/ad/42?se=abc&utm_medium=api&v=DEF";

function job(overrides: Partial<JobDto> = {}): JobDto {
  return {
    id: "job-1",
    title: "Frontend Developer",
    company: "Acme",
    location: "Sydney",
    salaryMin: 110_000,
    salaryMax: 130_000,
    salaryIsPredicted: false,
    contractType: null,
    contractTime: null,
    snippet: "React role",
    postedAt: new Date().toISOString(),
    applyUrl: APPLY_URL,
    source: "adzuna",
    ...overrides,
  };
}

const PROFILE = { targetTitles: ["Frontend Developer", "Web Developer"], locations: ["Sydney"], skillCount: 12, isAuto: true };

const match = (id: string, title: string): MatchItem => ({ job: job({ id, title }), score: 80, reasons: ["Posted today"], saved: false });

beforeEach(() => {
  vi.clearAllMocks();
  api.addInteraction.mockResolvedValue({ ok: true });
  api.removeInteraction.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("JobCard", () => {
  it("labels a predicted salary as an estimate and shows score and reasons", () => {
    render(<JobCard job={job({ salaryIsPredicted: true })} score={87} reasons={["Title matches Frontend Developer"]} saved={false} onToggleSave={vi.fn()} onApply={vi.fn()} />);
    expect(screen.getByText("$110k–$130k")).toBeInTheDocument();
    expect(screen.getByText("(est.)")).toBeInTheDocument();
    expect(screen.getByText("87% match")).toBeInTheDocument();
    expect(screen.getByText("Title matches Frontend Developer")).toBeInTheDocument();
  });

  it("carries Jobs by Adzuna attribution linked to adzuna.com.au", () => {
    render(<JobCard job={job()} saved={false} onToggleSave={vi.fn()} onApply={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute("href", "https://www.adzuna.com.au");
    expect(screen.getByRole("link", { name: "Adzuna" })).toHaveAttribute("href", "https://www.adzuna.com.au");
  });

  it("applies via redirect_url exactly, in a new tab, and reports the click", () => {
    const onApply = vi.fn();
    render(<JobCard job={job()} saved={false} onToggleSave={vi.fn()} onApply={onApply} />);
    const apply = screen.getByRole("link", { name: /apply/i });
    expect(apply).toHaveAttribute("href", APPLY_URL);
    expect(apply).toHaveAttribute("target", "_blank");
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledOnce();
  });

  it("hides Apply for an expired saved job", () => {
    render(<JobCard job={job()} saved expired onToggleSave={vi.fn()} onApply={vi.fn()} />);
    expect(screen.queryByRole("link", { name: /apply/i })).toBeNull();
    expect(screen.getByText("No longer listed")).toBeInTheDocument();
  });
});

describe("JobProfileForm", () => {
  it("requires a target title before calling the API", async () => {
    render(<JobProfileForm initial={EMPTY_PROFILE} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Update matches" }));
    expect(await screen.findByText("Add at least one target job title")).toBeInTheDocument();
    expect(api.saveJobProfile).not.toHaveBeenCalled();
  });

  it("adds tags with Enter, parses the salary and saves", async () => {
    api.saveJobProfile.mockResolvedValue({});
    const onSaved = vi.fn();
    render(<JobProfileForm initial={EMPTY_PROFILE} onSaved={onSaved} />);

    const titles = screen.getByLabelText(/Target job titles/);
    fireEvent.change(titles, { target: { value: "Chef" } });
    fireEvent.keyDown(titles, { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Minimum salary (AUD per year)"), { target: { value: "$85,000" } });
    fireEvent.click(screen.getByLabelText("Full-time"));
    fireEvent.click(screen.getByRole("button", { name: "Update matches" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.saveJobProfile).toHaveBeenCalledWith(
      expect.objectContaining({ targetTitles: ["Chef"], minSalary: 85000, contractTypes: ["full_time"] })
    );
  });

  it("shows server field errors", async () => {
    api.saveJobProfile.mockRejectedValue(new ApiError("Invalid job profile", 400, { skills: "Add up to 30 skills" }));
    render(<JobProfileForm initial={{ ...EMPTY_PROFILE, targetTitles: ["Chef"] }} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Update matches" }));
    expect(await screen.findByText("Add up to 30 skills")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid job profile");
  });
});

describe("TagInput", () => {
  it("does not add a suggestion that is only a typed prefix of a longer place", async () => {
    const { TagInput } = await import("./TagInput");
    const onChange = vi.fn();
    render(<TagInput label="Locations" values={[]} onChange={onChange} max={5} suggestions={["Perth"]} />);
    const input = screen.getByLabelText(/Locations/);
    // Typed keystrokes arrive as InputEvents with inputType "insertText": "Perth" stays a draft.
    fireEvent.input(input, { target: { value: "Perth" }, inputType: "insertText" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["Perth"]);
  });

  it("adds a suggestion picked from the list straight away", async () => {
    const { TagInput } = await import("./TagInput");
    const onChange = vi.fn();
    render(<TagInput label="Locations" values={[]} onChange={onChange} max={5} suggestions={["Perth"]} />);
    fireEvent.input(screen.getByLabelText(/Locations/), { target: { value: "Perth" }, inputType: "insertReplacementText" });
    expect(onChange).toHaveBeenCalledWith(["Perth"]);
  });
});

describe("MatchesView", () => {
  it("dismisses a job with an undo that restores it in place", async () => {
    api.getMatches.mockResolvedValue({
      hasProfile: true,
      profile: PROFILE,
      matches: [match("a", "Chef"), match("b", "Baker"), match("c", "Barista")],
      total: 3,
      page: 1,
      limit: 20,
    });
    render(
      <ToastProvider>
        <MatchesView onAdjust={vi.fn()} />
      </ToastProvider>
    );

    const baker = (await screen.findByText("Baker")).closest("li")!;
    fireEvent.click(within(baker).getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText("Baker")).toBeNull();
    expect(screen.getByText("2 matches")).toBeInTheDocument();
    expect(api.addInteraction).toHaveBeenCalledWith("b", "dismissed");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(api.removeInteraction).toHaveBeenCalledWith("b", "dismissed"));
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Chef", "Baker", "Barista"]);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("undo waits for the dismiss to be recorded, and a failed dismiss never restores twice", async () => {
    api.getMatches.mockResolvedValue({ hasProfile: true, profile: PROFILE, matches: [match("a", "Chef"), match("b", "Baker")], total: 2, page: 1, limit: 20 });
    let failDismiss!: () => void;
    api.addInteraction.mockImplementation(() => new Promise((_, reject) => (failDismiss = () => reject(new Error("down")))));
    render(
      <ToastProvider>
        <MatchesView onAdjust={vi.fn()} />
      </ToastProvider>
    );

    fireEvent.click(within((await screen.findByText("Baker")).closest("li")!).getByRole("button", { name: /dismiss/i }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(api.removeInteraction).not.toHaveBeenCalled(); // dismiss still in flight

    failDismiss();
    await waitFor(() => expect(screen.getAllByText("Baker")).toHaveLength(1));
    expect(screen.getByText("2 matches")).toBeInTheDocument();
    expect(api.removeInteraction).not.toHaveBeenCalled(); // nothing was recorded, so nothing to undo
  });

  it("only reloads when the location filter actually changes", async () => {
    api.getMatches.mockResolvedValue({ hasProfile: true, profile: PROFILE, matches: [match("a", "Chef")], total: 1, page: 1, limit: 20 });
    render(
      <ToastProvider>
        <MatchesView onAdjust={vi.fn()} />
      </ToastProvider>
    );
    await screen.findByText("Chef");
    const location = screen.getByLabelText("Location");
    fireEvent.blur(location);
    expect(api.getMatches).toHaveBeenCalledTimes(1);

    fireEvent.change(location, { target: { value: "Perth" } });
    fireEvent.submit(location.closest("form")!);
    fireEvent.blur(location);
    await waitFor(() => expect(api.getMatches).toHaveBeenCalledTimes(2));
    expect(api.getMatches).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ location: "Perth" }));
  });

  it("shows what the matches are based on, with Adjust", async () => {
    api.getMatches.mockResolvedValue({ hasProfile: true, profile: PROFILE, matches: [match("a", "Chef")], total: 1, page: 1, limit: 20 });
    const onAdjust = vi.fn();
    render(
      <ToastProvider>
        <MatchesView onAdjust={onAdjust} />
      </ToastProvider>
    );
    expect(await screen.findByText("Frontend Developer, Web Developer")).toBeInTheDocument();
    expect(screen.getByText(/Sydney · 12 skills · Based on your profile and applications/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /adjust/i }));
    expect(onAdjust).toHaveBeenCalledOnce();
  });

  it("switches a customised search back to the user's own profile", async () => {
    api.resetJobProfile.mockResolvedValue({ ok: true });
    api.getMatches.mockResolvedValue({ hasProfile: true, profile: { ...PROFILE, isAuto: false }, matches: [], total: 0, page: 1, limit: 20 });
    render(
      <ToastProvider>
        <MatchesView onAdjust={vi.fn()} />
      </ToastProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: "Use my profile instead" }));
    await waitFor(() => expect(api.getMatches).toHaveBeenCalledTimes(2));
    expect(api.resetJobProfile).toHaveBeenCalledOnce();
  });

  it("asks one question when there is nothing to match on", async () => {
    api.getMatches
      .mockResolvedValueOnce({ hasProfile: false, profile: null, matches: [], total: 0, page: 1, limit: 20 })
      .mockResolvedValue({ hasProfile: true, profile: PROFILE, matches: [match("a", "Nurse role")], total: 1, page: 1, limit: 20 });
    api.saveJobProfile.mockResolvedValue({});
    render(
      <ToastProvider>
        <MatchesView onAdjust={vi.fn()} />
      </ToastProvider>
    );

    expect(await screen.findByText("What job are you looking for?")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filter matches" })).toBeNull();
    const titles = screen.getByLabelText(/Job titles/);
    fireEvent.change(titles, { target: { value: "Nurse" } });
    fireEvent.keyDown(titles, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Show my matches" }));

    expect(await screen.findByText("Nurse role")).toBeInTheDocument();
    // Saved as a starter automatic profile, so the user's own data takes over once it exists.
    expect(api.saveJobProfile).toHaveBeenCalledWith(expect.objectContaining({ targetTitles: ["Nurse"] }), { automatic: true });
  });

  it("shows a retry on load failure", async () => {
    api.getMatches.mockRejectedValueOnce(new Error("Network down")).mockResolvedValue({ hasProfile: true, profile: PROFILE, matches: [], total: 0, page: 1, limit: 20 });
    render(
      <ToastProvider>
        <MatchesView onAdjust={vi.fn()} />
      </ToastProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No matches yet")).toBeInTheDocument();
  });
});
