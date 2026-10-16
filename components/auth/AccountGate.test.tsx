// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// What the server says the current user is (`auth.getUser`). Tests flip it to simulate signup.
let serverSaysGuest = false;
let serverUnreachable = false;
const showToast = vi.fn();
const refresh = vi.fn();
const assign = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () =>
        serverUnreachable
          ? { data: { user: null }, error: new Error("network") }
          : { data: { user: { is_anonymous: serverSaysGuest, user_metadata: { full_name: "Sam" } } }, error: null },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast }) }));

// Stand-in for the real signup form: just the ways out of it.
vi.mock("@/components/auth/SignupAtGenerateModal", () => ({
  SignupAtGenerateModal: (props: {
    isOpen: boolean;
    title?: string;
    onSuccess: (via: "signup" | "login") => void;
    onClose: () => void;
  }) =>
    props.isOpen ? (
      <div role="dialog">
        <p>{props.title}</p>
        <button onClick={() => props.onSuccess("signup")}>Sign up</button>
        <button onClick={() => props.onSuccess("login")}>Log in</button>
        <button onClick={props.onClose}>Close</button>
      </div>
    ) : null,
}));

const { AccountGateProvider, useAccountGate } = await import("./AccountGate");

const COPY = { title: "Create your free account to check your fit", submitLabel: "Create account" };
const results: boolean[] = [];

function Probe() {
  const { isGuest, requireAccount } = useAccountGate();
  return (
    <>
      <span>{isGuest ? "guest" : "member"}</span>
      <button onClick={async () => results.push(await requireAccount(COPY))}>Use AI</button>
    </>
  );
}

function renderGate(initialIsGuest: boolean) {
  serverSaysGuest = initialIsGuest;
  render(
    <AccountGateProvider initialIsGuest={initialIsGuest}>
      <Probe />
    </AccountGateProvider>
  );
}

const click = (name: string) => act(async () => fireEvent.click(screen.getByRole("button", { name })));

describe("AccountGate", () => {
  beforeEach(() => {
    results.length = 0;
    serverUnreachable = false;
    vi.clearAllMocks();
    vi.stubGlobal("location", { ...window.location, assign });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lets a real account straight through without asking", async () => {
    renderGate(false);
    expect(screen.getByText("member")).toBeInTheDocument();

    await click("Use AI");

    expect(results).toEqual([true]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks a guest to sign up, then carries on with what they clicked", async () => {
    renderGate(true);
    expect(screen.getByText("guest")).toBeInTheDocument();

    await click("Use AI");
    expect(screen.getByRole("dialog")).toHaveTextContent(COPY.title);
    expect(results).toEqual([]);

    serverSaysGuest = false; // the signup upgraded the account
    await click("Sign up");
    expect(results).toEqual([true]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();

    // Asked once only: the next AI action goes straight through.
    await click("Use AI");
    expect(results).toEqual([true, true]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancels the action when a guest closes the signup step", async () => {
    renderGate(true);

    await click("Use AI");
    await click("Close");

    expect(results).toEqual([false]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("doesn't carry on while email confirmation is still pending, and says what to do", async () => {
    renderGate(true);

    await click("Use AI");
    await click("Sign up"); // server still says guest: the email link hasn't been clicked

    expect(results).toEqual([false]);
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/check your email/i), "accent");
    expect(screen.getByText("guest")).toBeInTheDocument();
  });

  it("goes straight through when the server says the guest has since become a real account", async () => {
    renderGate(true);
    serverSaysGuest = false; // e.g. confirmed their email in another tab

    await click("Use AI");

    expect(results).toEqual([true]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("doesn't guess when the server can't be reached: no AI call, and still treated as a guest", async () => {
    renderGate(true);
    serverUnreachable = true;

    await click("Use AI");

    expect(results).toEqual([false]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/went wrong/i), "critical");
    expect(screen.getByText("guest")).toBeInTheDocument();
  });

  it("sends someone who logs into an existing account to their dashboard instead of resuming", async () => {
    renderGate(true);

    await click("Use AI");
    await click("Log in");

    expect(results).toEqual([false]);
    expect(assign).toHaveBeenCalledWith("/dashboard");
  });

  it("does nothing outside a provider (pages only real accounts reach)", async () => {
    render(<Probe />);
    await click("Use AI");
    expect(results).toEqual([true]);
  });
});
