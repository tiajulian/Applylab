// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommaListField } from "./CommaListField";
import { COMPANY_CATALOG } from "@/lib/catalogs/companies";
import { DEGREE_CATALOG, INSTITUTION_CATALOG } from "@/lib/catalogs/education";
import { STAKEHOLDER_CATALOG } from "@/lib/catalogs/stakeholders";
import { WORK_RIGHTS_CATALOG } from "@/lib/catalogs/workRights";

afterEach(cleanup);

const CATALOG = ["SQL", "Stakeholder Management", "Stakeholder Engagement", "Excel"];

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <CommaListField multiline label="Skills" catalog={CATALOG} value={value} onValueChange={setValue} />;
}

describe("CommaListField", () => {
  it("suggests for the item after the last comma and completes it", () => {
    render(<Harness />);
    const field = screen.getByLabelText("Skills");
    fireEvent.change(field, { target: { value: "SQL, stakeh" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: "Stakeholder Management" }));
    expect(field).toHaveValue("SQL, Stakeholder Management, ");
  });

  it("suggests for the item the cursor is in, and replaces only that item", () => {
    render(<Harness initial="SQL, ex, Power BI" />);
    const field = screen.getByLabelText("Skills") as HTMLTextAreaElement;
    // Typing the "c" of "exc" mid-list: the cursor ends up after it, not at the end.
    // jsdom puts the cursor at the end on a programmatic change; a browser leaves it after the "c".
    Object.defineProperty(field, "selectionStart", { configurable: true, get: () => 8 });
    fireEvent.change(field, { target: { value: "SQL, exc, Power BI" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: "Excel" }));
    expect(field).toHaveValue("SQL, Excel, Power BI");
  });

  it("drops the separator a pick leaves once the field is left", () => {
    render(<Harness />);
    const field = screen.getByLabelText("Skills");
    fireEvent.change(field, { target: { value: "stakeh" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: "Stakeholder Management" }));
    expect(field).toHaveValue("Stakeholder Management, ");
    // Focus moving elsewhere on the page (jsdom reports the page as unfocused by default).
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    fireEvent.blur(field);
    hasFocus.mockRestore();
    expect(field).toHaveValue("Stakeholder Management");
  });

  it("keeps the separator when the whole window loses focus", () => {
    render(<Harness initial="Excel, " />);
    const field = screen.getByLabelText("Skills");
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    fireEvent.blur(field);
    hasFocus.mockRestore();
    expect(field).toHaveValue("Excel, ");
  });

  it("does not suggest items already in the list", () => {
    render(<Harness />);
    const field = screen.getByLabelText("Skills");
    fireEvent.change(field, { target: { value: "SQL, s" } });
    expect(screen.queryByRole("option", { name: "SQL" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Stakeholder Management" })).toBeInTheDocument();
  });

  it("leaves Enter alone when nothing is highlighted", () => {
    render(<Harness />);
    const field = screen.getByLabelText("Skills");
    fireEvent.change(field, { target: { value: "stakeh" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(field).toHaveValue("stakeh");
  });
});

describe("catalogs", () => {
  it.each([
    ["companies", COMPANY_CATALOG],
    ["institutions", INSTITUTION_CATALOG],
    ["degrees", DEGREE_CATALOG],
    ["stakeholders", STAKEHOLDER_CATALOG],
    ["work rights", WORK_RIGHTS_CATALOG],
  ])("%s has no duplicates", (_, catalog) => {
    const lower = catalog.map((v) => v.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});
