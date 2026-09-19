// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BulletList, EditableField, HighlightSpan, ReviewHighlightContext, ToolRow } from "./shared";
import type { ReviewPassage } from "@/lib/review/types";

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

  it("sets data-fc-target so the review panel can find the field", () => {
    render(<EditableField value="Claim" onChange={() => {}} targetKey="summary" ariaLabel="Summary" />);
    expect(screen.getByLabelText("Summary")).toHaveAttribute("data-fc-target", "summary");
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
});

describe("EditableField review highlights", () => {
  const passage = (over: Partial<ReviewPassage> = {}): ReviewPassage => ({
    blockId: "summary", start: 8, end: 16, severity: "warn", itemIds: ["item-1"], ...over,
  });
  const withPassages = (passages: ReviewPassage[], ui: React.ReactNode, onSelectItem = vi.fn(), selectedItemId: string | null = null) =>
    render(
      <ReviewHighlightContext.Provider value={{ passages: new Map([["summary", passages]]), selectedItemId, onSelectItem }}>
        {ui}
      </ReviewHighlightContext.Provider>
    );
  const value = "We used recieved data.";

  it("marks exactly the passage in a textarea, and nothing without one", () => {
    const { container, unmount } = withPassages([passage({ start: 8, end: 16 })], <EditableField as="textarea" value={value} onChange={() => {}} targetKey="summary" ariaLabel="Area" />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("recieved");
    unmount();

    const plain = render(<EditableField as="textarea" value={value} onChange={() => {}} targetKey="summary" ariaLabel="Area" />);
    expect(plain.container.querySelector("mark")).toBeNull();
  });

  it("underlines the passage (not tint alone) and distinguishes verify from warn by line style", () => {
    const warn = withPassages([passage()], <EditableField as="textarea" value={value} onChange={() => {}} targetKey="summary" ariaLabel="Area" />);
    const warnMark = warn.container.querySelector("mark") as HTMLElement;
    expect(warnMark.style.textDecorationLine).toBe("underline");
    expect(warnMark.style.textDecorationStyle).toBe("wavy");
    warn.unmount();
    const verify = withPassages([passage({ severity: "verify" })], <EditableField as="textarea" value={value} onChange={() => {}} targetKey="summary" ariaLabel="Area" />);
    expect((verify.container.querySelector("mark") as HTMLElement).style.textDecorationStyle).toBe("solid");
  });

  it("selects the card when the caret lands in the passage, and not outside it", () => {
    const onSelectItem = vi.fn();
    withPassages([passage()], <EditableField as="textarea" value={value} onChange={() => {}} targetKey="summary" ariaLabel="Area" />, onSelectItem);
    const field = screen.getByLabelText("Area") as HTMLTextAreaElement;

    field.setSelectionRange(2, 2);
    fireEvent.click(field);
    expect(onSelectItem).not.toHaveBeenCalled();

    field.setSelectionRange(10, 10);
    fireEvent.click(field);
    expect(onSelectItem).toHaveBeenCalledWith("item-1");
  });

  it("tints a whole single-line input and selects its card on click", () => {
    const onSelectItem = vi.fn();
    withPassages([passage({ start: 0, end: 4, severity: "verify" })], <EditableField value="Acme" onChange={() => {}} targetKey="summary" ariaLabel="Company" />, onSelectItem);
    const input = screen.getByLabelText("Company");
    expect(input.style.textDecorationLine).toBe("underline");
    fireEvent.click(input);
    expect(onSelectItem).toHaveBeenCalledWith("item-1");
  });

  it("ignores a stale passage that points past the end of the text", () => {
    const { container } = withPassages([passage({ start: 40, end: 50 })], <EditableField as="textarea" value="Short." onChange={() => {}} targetKey="summary" ariaLabel="Area" />);
    expect(container.querySelector("mark")).toBeNull();
  });

  it("gives the selected passage a stronger tint", () => {
    const off = withPassages([passage()], <EditableField as="textarea" value={value} onChange={() => {}} targetKey="summary" ariaLabel="Area" />);
    const offTint = (off.container.querySelector("mark") as HTMLElement).style.backgroundColor;
    off.unmount();
    const on = withPassages([passage()], <EditableField as="textarea" value={value} onChange={() => {}} targetKey="summary" ariaLabel="Area" />, vi.fn(), "item-1");
    expect((on.container.querySelector("mark") as HTMLElement).style.backgroundColor).not.toBe(offTint);
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
