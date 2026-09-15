// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BulletList, EditableField, HighlightSpan, ToolRow } from "./shared";

// EditableField uses useIsMobile() (matchMedia) to decide whether to redirect focus into the
// mobile bottom sheet - jsdom doesn't implement matchMedia, so stub it desktop-always-false,
// matching this repo's existing per-file global-mocking convention (see ResumeForm.quota.test.tsx).
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

  it("renders one editable field per bullet and wires move/remove/change callbacks to the right index", () => {
    const onBulletChange = vi.fn();
    const onBulletRemove = vi.fn();
    const onBulletMove = vi.fn();

    render(
      <BulletList
        bullets={["First", "Second", "Third"]}
        style={style}
        targetKind="experienceBullet"
        entryIndex={0}
        highlights={{}}
        editable
        onBulletChange={onBulletChange}
        onBulletRemove={onBulletRemove}
        onBulletMove={onBulletMove}
      />
    );

    const fields = screen.getAllByLabelText("Bullet point");
    expect(fields).toHaveLength(3);

    fireEvent.change(fields[1], { target: { value: "Second edited" } });
    expect(onBulletChange).toHaveBeenCalledWith(1, "Second edited");

    const removeButtons = screen.getAllByRole("button", { name: /remove bullet/i });
    fireEvent.click(removeButtons[2]);
    expect(onBulletRemove).toHaveBeenCalledWith(2);

    const moveDownButtons = screen.getAllByRole("button", { name: /move bullet down/i });
    fireEvent.click(moveDownButtons[0]);
    expect(onBulletMove).toHaveBeenCalledWith(0, 1);

    // First bullet's "move up" and last bullet's "move down" are disabled.
    const moveUpButtons = screen.getAllByRole("button", { name: /move bullet up/i });
    expect(moveUpButtons[0]).toBeDisabled();
    expect(moveDownButtons[2]).toBeDisabled();
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
