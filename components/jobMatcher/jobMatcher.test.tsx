// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import type { JobDto, MatchItem } from "@/lib/jobs/client";

const api = vi.hoisted(() => ({
  saveJobProfile: vi.fn(),
  getJobProfile: vi.fn(),
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

const PROFILE = { targetTitles: ["Frontend Developer", "Web Developer"], locations: ["Kogarah"], radiusKm: 50, skillCount: 12, isAuto: true };

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
    expect(screen.getByRole("img", { name: "87% match, strong match" })).toBeInTheDocument();
    // Reasons stay collapsed until asked for.
    expect(screen.queryByText("Title matches Frontend Developer")).toBeNull();
    const why = screen.getByRole("button", { name: /why this matches/i });
    fireEvent.click(why);
    expect(why).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("list", { name: "Why this matches" })).toHaveTextContent("Title matches Frontend Developer");
  });

  it("shows salary and posting date once, with a tick when the salary meets the minimum", () => {
    render(
      <JobCard
        job={job()}
        score={80}
        reasons={["Salary $110k–$130k meets your minimum", "Posted today", "Mentions React, SQL", "Similar to your profile"]}
        saved={false}
        onToggleSave={vi.fn()}
        onApply={vi.fn()}
      />
    );
    expect(screen.getByText("Meets your minimum")).toBeInTheDocument();
    expect(screen.getAllByText(/Posted today/)).toHaveLength(1);
    expect(screen.getByRole("list", { name: "Your skills in this ad" })).toHaveTextContent("ReactSQL");
    fireEvent.click(screen.getByRole("button", { name: /why this matches/i }));
    const why = screen.getByRole("list", { name: "Why this matches" });
    expect(why).toHaveTextContent("Similar to your profile");
    expect(why).not.toHaveTextContent("Salary");
    expect(why).not.toHaveTextContent("Mentions");
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
    expect(await screen.findByText("Add at least one job title")).toBeInTheDocument();
    expect(api.saveJobProfile).not.toHaveBeenCalled();
  });

  it("adds tags with Enter, parses the salary and saves", async () => {
    api.saveJobProfile.mockResolvedValue({});
    const onSaved = vi.fn();
    render(<JobProfileForm initial={EMPTY_PROFILE} onSaved={onSaved} />);

    const titles = screen.getByLabelText(/^Job titles/);
    fireEvent.change(titles, { target: { value: "Chef" } });
    fireEvent.keyDown(titles, { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Minimum salary"), { target: { value: "$85,000" } });
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
  const suggest = (draft: string) => (draft ? [{ value: "Perth" }, { value: "Perth Hills" }] : []);

  it("adds exactly what was typed on Enter when nothing is highlighted", async () => {
    const { TagInput } = await import("./TagInput");
    const onChange = vi.fn();
    render(<TagInput label="Locations" values={[]} onChange={onChange} max={5} suggest={suggest} />);
    const input = screen.getByLabelText(/Locations/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Per" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["Per"]);
  });

  it("adds a suggestion picked with the keyboard or mouse", async () => {
    const { TagInput } = await import("./TagInput");
    const onChange = vi.fn();
    render(<TagInput label="Locations" values={[]} onChange={onChange} max={5} suggest={suggest} />);
    const input = screen.getByLabelText(/Locations/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Per" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(["Perth Hills"]);

    fireEvent.change(input, { target: { value: "Per" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: "Perth" }));
    expect(onChange).toHaveBeenLastCalledWith(["Perth"]);
  });

  it("suggests for the last of several places typed on one line, and keeps the others", async () => {
    const { TagInput } = await import("./TagInput");
    const { splitPlaceList } = await import("@/lib/jobs/locations");
    const onChange = vi.fn();
    const seen: string[] = [];
    const suggest = (draft: string) => {
      seen.push(draft);
      return draft.toLowerCase().startsWith("melb") ? [{ value: "Melbourne" }] : [];
    };
    render(<TagInput label="Places" values={[]} onChange={onChange} max={5} suggest={suggest} commaAdds={false} split={splitPlaceList} />);
    const input = screen.getByLabelText(/Places/);
    fireEvent.change(input, { target: { value: "Sydney, Melb" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: "Melbourne" }), { button: 0 });
    expect(onChange).toHaveBeenLastCalledWith(["Sydney", "Melbourne"]);
    expect(seen).not.toContain("Sydney, Melb");
  });

  it("adds a picked suggestion whole, never re-split", async () => {
    const { TagInput } = await import("./TagInput");
    const { splitPlaceList } = await import("@/lib/jobs/locations");
    const onChange = vi.fn();
    const suggest = (draft: string) => (draft.toLowerCase().startsWith("per") ? [{ value: "Perth, TAS" }] : []);
    render(<TagInput label="Places" values={[]} onChange={onChange} max={5} suggest={suggest} commaAdds={false} split={splitPlaceList} />);
    const input = screen.getByLabelText(/Places/);
    fireEvent.change(input, { target: { value: "per" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: "Perth, TAS" }), { button: 0 });
    expect(onChange).toHaveBeenLastCalledWith(["Perth, TAS"]);
  });

  it("does not add a half-composed IME draft on the Enter that confirms it", async () => {
    const { TagInput } = await import("./TagInput");
    const onChange = vi.fn();
    render(<TagInput label="Titles" values={[]} onChange={onChange} max={5} suggest={() => []} />);
    const input = screen.getByLabelText(/Titles/);
    fireEvent.change(input, { target: { value: "kango" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leaves out values already added before choosing which suggestions to show", async () => {
    const { TagInput } = await import("./TagInput");
    const all = ["SQL", "MySQL", "PostgreSQL"];
    const suggestWithExclude = (draft: string, exclude: readonly string[]) =>
      draft ? all.filter((v) => !exclude.includes(v)).slice(0, 1).map((value) => ({ value })) : [];
    render(<TagInput label="Skills" values={["SQL"]} onChange={vi.fn()} max={5} suggest={suggestWithExclude} />);
    const input = screen.getByLabelText(/Skills/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "sql" } });
    expect(screen.getByRole("option", { name: "MySQL" })).toBeInTheDocument();
  });

  it("closes the list on Escape without closing anything around it", async () => {
    const { TagInput } = await import("./TagInput");
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <TagInput label="Locations" values={[]} onChange={vi.fn()} max={5} suggest={suggest} />
      </div>
    );
    const input = screen.getByLabelText(/Locations/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Per" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(outer).not.toHaveBeenCalled();
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
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "2 matching roles")).toBeInTheDocument();
    // One "Jobs by Adzuna" attribution for the whole list, linked to adzuna.com.au.
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute("href", "https://www.adzuna.com.au");
    expect(screen.getByRole("link", { name: "Adzuna" })).toHaveAttribute("href", "https://www.adzuna.com.au");
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
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "2 matching roles")).toBeInTheDocument();
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
    const titles = await screen.findByRole("list", { name: "Job titles" });
    expect(titles).toHaveTextContent("Frontend DeveloperWeb Developer");
    expect(screen.getByText(/Within 50 km of Kogarah · 12 skills · From your profile and applications/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /adjust/i }));
    expect(onAdjust).toHaveBeenCalledOnce();
  });

  it("describes suburbs by distance and states as a whole", async () => {
    const { ProfileSummaryBar } = await import("./ProfileSummaryBar");
    const bar = (locations: string[], radiusKm: number | null) =>
      render(
        <ToastProvider>
          <ProfileSummaryBar profile={{ ...PROFILE, locations, radiusKm, skillCount: 0 }} onAdjust={vi.fn()} onUseMyProfile={vi.fn()} onTitlesChanged={vi.fn()} />
        </ToastProvider>
      );
    bar(["Kogarah", "Melbourne", "Queensland"], 25);
    expect(screen.getByText(/Within 25 km of Kogarah or Melbourne or anywhere in Queensland/)).toBeInTheDocument();
    cleanup();
    bar(["Kogarah"], null);
    expect(screen.getByText(/Anywhere in Australia/)).toBeInTheDocument();
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
    expect(await screen.findByText("No matching roles yet")).toBeInTheDocument();
  });

  it("adds and removes searched job titles, then reloads the matches", async () => {
    api.getMatches.mockResolvedValue({ hasProfile: true, profile: PROFILE, matches: [match("a", "Chef")], total: 1, page: 1, limit: 20 });
    api.getJobProfile.mockResolvedValue({ profile: { ...EMPTY_PROFILE, targetTitles: PROFILE.targetTitles, skills: ["React"] }, exists: true, isAuto: true });
    api.saveJobProfile.mockResolvedValue({});
    render(
      <ToastProvider>
        <MatchesView onAdjust={vi.fn()} />
      </ToastProvider>
    );

    const search = await screen.findByLabelText("Add a job title to search for");
    fireEvent.change(search, { target: { value: "  Analytics   Engineer " } });
    fireEvent.submit(search.closest("form")!);
    await waitFor(() => expect(api.getMatches).toHaveBeenCalledTimes(2));
    expect(api.saveJobProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ skills: ["React"], targetTitles: ["Frontend Developer", "Web Developer", "Analytics Engineer"] })
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Web Developer" }));
    await waitFor(() => expect(api.getMatches).toHaveBeenCalledTimes(3));
    expect(api.saveJobProfile).toHaveBeenLastCalledWith(expect.objectContaining({ targetTitles: ["Frontend Developer"] }));
  });

  it("keeps at least one searched title", async () => {
    api.getMatches.mockResolvedValue({ hasProfile: true, profile: { ...PROFILE, targetTitles: ["Chef"] }, matches: [], total: 0, page: 1, limit: 20 });
    render(
      <ToastProvider>
        <MatchesView onAdjust={vi.fn()} />
      </ToastProvider>
    );
    expect(await screen.findByRole("list", { name: "Job titles" })).toHaveTextContent("Chef");
    expect(screen.queryByRole("button", { name: "Remove Chef" })).toBeNull();
  });

  it("pages with numbered buttons and marks the current page", async () => {
    const items = Array.from({ length: 20 }, (_, i) => match(`j${i}`, `Role ${i}`));
    api.getMatches.mockResolvedValue({ hasProfile: true, profile: PROFILE, matches: items, total: 45, page: 1, limit: 20 });
    render(
      <ToastProvider>
        <MatchesView onAdjust={vi.fn()} />
      </ToastProvider>
    );
    const nav = await screen.findByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: "Previous page" })).toBeDisabled();
    fireEvent.click(within(nav).getByRole("button", { name: "Page 3" }));
    await waitFor(() => expect(api.getMatches).toHaveBeenLastCalledWith(3, 20, expect.anything()));
  });
});
