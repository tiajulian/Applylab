// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SuggestInput } from "./SuggestInput";

const suggest = (q: string) => (q ? [{ value: "Data Analyst" }, { value: "Data Engineer" }] : []);

function Harness({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <SuggestInput
      label="Job title"
      value={value}
      suggest={suggest}
      onValueChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

afterEach(cleanup);

describe("SuggestInput", () => {
  it("opens on typing and fills the field with a picked suggestion", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Job title");
    fireEvent.focus(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "da" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: "Data Engineer" }));
    expect(onChange).toHaveBeenLastCalledWith("Data Engineer");
    expect(input).toHaveValue("Data Engineer");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes only the list on Escape, not a dialog listening on the document", () => {
    const dialogEscape = vi.fn();
    document.addEventListener("keydown", dialogEscape);
    render(<Harness onChange={() => {}} />);
    const input = screen.getByLabelText("Job title");
    fireEvent.change(input, { target: { value: "da" } });
    fireEvent.keyDown(input, { key: "Escape" });
    document.removeEventListener("keydown", dialogEscape);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(dialogEscape).not.toHaveBeenCalled();
  });

  it("does not let a hovered option take over Enter", () => {
    render(<Harness onChange={() => {}} />);
    const input = screen.getByLabelText("Job title");
    fireEvent.change(input, { target: { value: "da" } });
    fireEvent.mouseEnter(screen.getByRole("option", { name: "Data Engineer" }));
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("da");
  });

  it("keeps typed text on Enter unless a suggestion is highlighted", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Job title");
    fireEvent.change(input, { target: { value: "da" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("da");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("Data Analyst");
  });
});
