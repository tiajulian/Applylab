// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MetricPrompts } from "./MetricPrompts";
import { METRIC_PROMPTS } from "@/lib/wins/constants";

afterEach(cleanup);

function Harness() {
  const [value, setValue] = useState("");
  return createElement(MetricPrompts, { value, onChange: setValue, outcome: "" });
}

describe("MetricPrompts", () => {
  it("never puts a digit in the metric field when a prompt is tapped", () => {
    render(createElement(Harness));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    for (const prompt of METRIC_PROMPTS) {
      fireEvent.click(screen.getByRole("button", { name: prompt.label }));
      expect(input.value).not.toMatch(/\d/);
      expect(screen.getByText(prompt.question)).toBeInTheDocument();
    }
  });

  it("keeps a figure the candidate typed and only shows the question", () => {
    render(createElement(Harness));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3 weeks to 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Speed" }));
    expect(input.value).toBe("3 weeks to 1");
    expect(screen.getByText("Did something get faster?")).toBeInTheDocument();
  });

  it("selects the blank so typing replaces it, and asks for it to be filled", () => {
    render(createElement(Harness));
    fireEvent.click(screen.getByRole("button", { name: "Speed" }));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("__% faster");
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 2]);
    expect(screen.getByText("Fill in the blank or clear it.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "30% faster" } });
    expect(screen.queryByText("Fill in the blank or clear it.")).not.toBeInTheDocument();
  });
});
