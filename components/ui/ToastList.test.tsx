// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { StrictMode, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { TOAST_DURATION_MS, ToastList, type ToastItem } from "./ToastList";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const toast: ToastItem = { id: 1, message: "Too many profile changes.", variant: "critical" };

describe("ToastList", () => {
  it("times a toast from when it is shown", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    render(createElement(ToastList, { toasts: [toast], onExpire }));
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(onExpire).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onExpire).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("still expires toasts under Strict Mode's double mount", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    render(createElement(StrictMode, null, createElement(ToastList, { toasts: [toast], onExpire })));
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    expect(onExpire).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("starts one timer per toast across re-renders, and clears them on unmount", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const { rerender, unmount } = render(createElement(ToastList, { toasts: [toast], onExpire }));
    act(() => vi.advanceTimersByTime(1000));
    rerender(createElement(ToastList, { toasts: [toast, { ...toast, id: 2 }], onExpire }));
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1000));
    expect(onExpire).toHaveBeenCalledExactlyOnceWith(1);
    unmount();
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
