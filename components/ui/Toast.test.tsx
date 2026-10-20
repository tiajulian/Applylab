// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider, useToast } from "./Toast";
// Loaded up front so the test times the provider, not a cold framer-motion transform while the
// whole suite runs. The provider still reaches it through its lazy import.
import "./ToastList";

afterEach(cleanup);

function Trigger() {
  const { showToast } = useToast();
  return createElement("button", { type: "button", onClick: () => showToast("Saved your search.") }, "Save");
}

describe("ToastProvider", () => {
  it("shows a toast once its lazy list loads, then takes it away", async () => {
    render(createElement(ToastProvider, null, createElement(Trigger)));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved your search.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Saved your search.")).not.toBeInTheDocument(), { timeout: 5000 });
  });
});
