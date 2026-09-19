// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BulletList, EditableField, HighlightSpan, SpellingFixContext, ToolRow } from "./shared";

// getSpellChecker does a real fetch() + dynamic import("nspell") to load the AU dictionary -
// replaced with a fast, deterministic double so these tests don't depend on a network fetch or
// the vendored dictionary files. checkSpelling's own logic is unit-tested directly in
// lib/text/spellcheck.test.ts; here we only need to verify EditableField's UI wiring around it.
vi.mock("@/lib/text/spellcheck", () => ({
  getSpellChecker: vi.fn().mockResolvedValue({}),
  checkSpelling: vi.fn(),
}));
import { checkSpelling } from "@/lib/text/spellcheck";
const mockCheckSpelling = vi.mocked(checkSpelling);

// EditableField uses useIsMobile() (matchMedia) to decide whether to redirect focus into the
// mobile bottom sheet - jsdom doesn't implement matchMedia, so stub it desktop-always-false,
// matching this repo's existing per-file global-mocking convention (see ResumeForm.quota.test.tsx).
// @dnd-kit/core's droppable/draggable measuring uses ResizeObserver, which jsdom doesn't
// implement - matches this repo's existing per-file global-mocking convention.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  mockCheckSpelling.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EditableField", () => {
  it("fires onChange per keystroke and onBlur on blur", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(<EditableField value="Hello" onChange={onChange} onBlur={onBlur} ariaLabel="Test field" />);

    const input = screen.getByLabelText("Test field");
    fireEvent.change(input, { target: { value: "Hello!" } });
    expect(onChange).toHaveBeenCalledWith("Hello!");

    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("renders a textarea when as='textarea'", () => {
    render(<EditableField as="textarea" value="Bullet text" onChange={() => {}} ariaLabel="Bullet" />);
    expect(screen.getByLabelText("Bullet").tagName).toBe("TEXTAREA");
  });

  it("sets data-fc-target and renders a flag glyph that calls onHighlightActivate when flagged", () => {
    const onHighlightActivate = vi.fn();
    render(
      <EditableField
        value="Claim"
        onChange={() => {}}
        targetKey="summary"
        highlight="flagged"
        onHighlightActivate={onHighlightActivate}
        ariaLabel="Summary"
      />
    );
    const input = screen.getByLabelText("Summary");
    expect(input).toHaveAttribute("data-fc-target", "summary");

    fireEvent.click(screen.getByRole("button", { name: /review flagged claim/i }));
    expect(onHighlightActivate).toHaveBeenCalledWith("summary", expect.anything());
  });

  it("does not render a flag glyph when not highlighted", () => {
    render(<EditableField value="Fine" onChange={() => {}} ariaLabel="Fine field" />);
    expect(screen.queryByRole("button", { name: /review flagged claim/i })).not.toBeInTheDocument();
  });

  it("on a phone, focusing the field opens the mobile sheet instead of typing inline", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(<EditableField value="Hello" onChange={onChange} onBlur={onBlur} ariaLabel="Mobile field" />);

    fireEvent.focus(screen.getByLabelText("Mobile field"));

    // The sheet renders its own field with the same accessible name/value - two now exist.
    const sheetField = screen.getAllByLabelText("Mobile field")[1];
    expect(sheetField).toHaveValue("Hello");

    fireEvent.change(sheetField, { target: { value: "Hello there" } });
    expect(onChange).toHaveBeenCalledWith("Hello there");

    // Framer Motion's exit animation means the sheet node isn't removed synchronously in jsdom -
    // what matters here is that closing checkpoints the edit via onBlur.
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("does not check spelling unless spellCheckEnabled is set", async () => {
    mockCheckSpelling.mockReturnValue([{ word: "recieved", suggestions: ["received"] }]);
    render(<EditableField value="Recieved feedback." onChange={() => {}} ariaLabel="No spellcheck field" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: /possible spelling/i })).not.toBeInTheDocument();
  });

  it("highlights a misspelled field with no glyph, and a paid user's click shows suggestions and applies the fix", async () => {
    mockCheckSpelling.mockReturnValue([{ word: "recieved", suggestions: ["received"] }]);
    const onChange = vi.fn();
    render(
      <SpellingFixContext.Provider value={{ canFix: true }}>
        <EditableField
          value="Recieved feedback."
          onChange={onChange}
          ariaLabel="Spellcheck field"
          spellCheckEnabled
          knownWords={new Set()}
        />
      </SpellingFixContext.Provider>
    );

    const field = screen.getByLabelText("Spellcheck field");
    await waitFor(() => expect(field.style.backgroundColor).toContain("rgba(220, 38, 38"), { timeout: 2000 });
    expect(screen.queryByRole("button", { name: /possible spelling/i })).not.toBeInTheDocument();

    fireEvent.click(field);
    fireEvent.click(await waitFor(() => screen.getByRole("button", { name: "received" })));
    expect(onChange).toHaveBeenCalledWith("Received feedback.");
  });

  it("in a textarea, tints only the flagged sentence and opens the popover only when it is clicked", async () => {
    mockCheckSpelling.mockReturnValue([{ word: "recieved", suggestions: ["received"] }]);
    const value = "Good first sentence. I recieved feedback. Fine last one.";
    const { container } = render(
      <EditableField as="textarea" value={value} onChange={() => {}} ariaLabel="Area" spellCheckEnabled knownWords={new Set()} />
    );
    const mark = await waitFor(() => {
      const el = container.querySelector("mark");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    }, { timeout: 2000 });
    expect(mark.textContent).toBe("I recieved feedback.");
    expect(container.querySelectorAll("mark")).toHaveLength(1);
    expect((screen.getByLabelText("Area") as HTMLElement).style.backgroundColor).toBe("transparent");

    const field = screen.getByLabelText("Area") as HTMLTextAreaElement;
    field.setSelectionRange(2, 2); // in the clean first sentence
    fireEvent.click(field);
    expect(screen.queryByText(/SPELLING/)).not.toBeInTheDocument();

    field.setSelectionRange(value.indexOf("recieved") + 2, value.indexOf("recieved") + 2);
    fireEvent.click(field);
    expect(await screen.findByText(/SPELLING/)).toBeInTheDocument();
  });

  it("shows a free user an upgrade prompt instead of the suggestions", async () => {
    mockCheckSpelling.mockReturnValue([{ word: "recieved", suggestions: ["received"] }]);
    render(
      <EditableField value="Recieved feedback." onChange={() => {}} ariaLabel="Free field" spellCheckEnabled knownWords={new Set()} />
    );

    const field = screen.getByLabelText("Free field");
    await waitFor(() => expect(field.style.backgroundColor).toContain("rgba(220, 38, 38"), { timeout: 2000 });
    fireEvent.click(field);

    expect(await screen.findByRole("link", { name: "Upgrade to See Mistakes" })).toHaveAttribute("href", "/upgrade");
    expect(screen.queryByRole("button", { name: "received" })).not.toBeInTheDocument();
  });
});

describe("HighlightSpan editable branch", () => {
  it("renders an EditableField instead of the static tag when editable", () => {
    const onChange = vi.fn();
    render(
      <HighlightSpan targetKey="summary" editable value="Summary text" onChange={onChange} ariaLabel="Summary">
        Summary text
      </HighlightSpan>
    );
    const input = screen.getByLabelText("Summary");
    expect(input.tagName).toBe("INPUT");
    fireEvent.change(input, { target: { value: "New summary" } });
    expect(onChange).toHaveBeenCalledWith("New summary");
  });
});

describe("BulletList editable branch", () => {
  const style = { bulletList: {}, bullet: {} };

  it("renders one editable field per bullet and wires change to the right index", () => {
    const onBulletChange = vi.fn();

    render(
      <BulletList
        bullets={["First", "Second", "Third"]}
        bulletIds={["a", "b", "c"]}
        style={style}
        targetKind="experienceBullet"
        entryIndex={0}
        highlights={{}}
        editable
        onBulletChange={onBulletChange}
      />
    );

    const fields = screen.getAllByLabelText("Bullet point");
    expect(fields).toHaveLength(3);

    fireEvent.change(fields[1], { target: { value: "Second edited" } });
    expect(onBulletChange).toHaveBeenCalledWith(1, "Second edited");
  });

  it("keeps the drag handle and remove button hidden until the bullet is hovered or focused, matching the cutover-review feedback against permanent inline icons", async () => {
    const onBulletRemove = vi.fn();

    render(
      <BulletList
        bullets={["First", "Second"]}
        bulletIds={["a", "b"]}
        style={style}
        targetKind="experienceBullet"
        entryIndex={0}
        highlights={{}}
        editable
        onBulletRemove={onBulletRemove}
      />
    );

    expect(screen.queryByRole("button", { name: "Remove bullet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Drag to reorder" })).not.toBeInTheDocument();

    const secondBulletLi = screen.getAllByLabelText("Bullet point")[1].closest("li")!;
    fireEvent.mouseEnter(secondBulletLi);

    // The floating toolbar mounts, then measures its anchor in a layout effect and re-renders -
    // that second pass isn't guaranteed to land within fireEvent's own act() flush.
    await waitFor(() => expect(screen.getByRole("button", { name: "Drag to reorder" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Remove bullet" }));
    expect(onBulletRemove).toHaveBeenCalledWith(1);

    fireEvent.mouseLeave(secondBulletLi);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove bullet" })).not.toBeInTheDocument());
  });

  it("keeps the toolbar open while a field inside the bullet has focus, even without hover", async () => {
    render(
      <BulletList
        bullets={["First"]}
        bulletIds={["a"]}
        style={style}
        targetKind="experienceBullet"
        entryIndex={0}
        highlights={{}}
        editable
      />
    );

    fireEvent.focus(screen.getByLabelText("Bullet point"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Drag to reorder" })).toBeInTheDocument());
  });

  it("renders static (non-interactive) markup when editable is unset", () => {
    render(<BulletList bullets={["First"]} style={style} targetKind="experienceBullet" entryIndex={0} highlights={{}} />);
    expect(screen.queryByLabelText("Bullet point")).not.toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
  });
});

describe("ToolRow editable branch", () => {
  it("renders the whole tool string as one uniform field when editable", () => {
    const onChange = vi.fn();
    render(<ToolRow tool="Data analysis: SQL, Python" index={0} style={{}} highlights={{}} editable onChange={onChange} />);
    const field = screen.getByLabelText("Tool category");
    expect(field).toHaveValue("Data analysis: SQL, Python");
    fireEvent.change(field, { target: { value: "Data analysis: SQL" } });
    expect(onChange).toHaveBeenCalledWith("Data analysis: SQL");
  });

  it("keeps the bold-prefix split byte-for-byte when not editable", () => {
    render(<ToolRow tool="Data analysis: SQL, Python" index={0} style={{}} highlights={{}} />);
    expect(screen.getByText("Data analysis:")).toBeInTheDocument();
    expect(screen.getByText(/SQL, Python/)).toBeInTheDocument();
  });
});
