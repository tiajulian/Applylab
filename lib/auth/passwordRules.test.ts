import { describe, expect, it } from "vitest";
import { ACCOUNT_EXISTS_MESSAGE, friendlyAuthError, passwordProblem } from "./passwordRules";

describe("passwordProblem", () => {
  it("accepts a password with every kind of character", () => {
    expect(passwordProblem("Qz7mVt2p!")).toBeNull();
    expect(passwordProblem("Abcdef1~")).toBeNull();
  });

  it("names exactly what is missing", () => {
    expect(passwordProblem("Qz7mVt2pLk")).toBe("Your password needs a symbol, like ! or #.");
    expect(passwordProblem("abc")).toBe(
      "Your password needs at least 8 characters, an uppercase letter, a number and a symbol, like ! or #."
    );
    expect(passwordProblem("ABCDEFG1!")).toBe("Your password needs a lowercase letter.");
  });

  it("counts length in bytes, like Supabase", () => {
    expect(passwordProblem("Ab1!ééé")).toBeNull(); // 7 characters, 10 bytes
  });

  it("refuses passwords over Supabase's 72-byte limit", () => {
    expect(passwordProblem(`Ab1!${"x".repeat(68)}`)).toBeNull(); // exactly 72
    expect(passwordProblem(`Ab1!${"x".repeat(69)}`)).toMatch(/too long/);
  });

  it("doesn't count characters Supabase doesn't treat as symbols", () => {
    expect(passwordProblem("Abcdefg1 £")).toBe("Your password needs a symbol, like ! or #.");
  });
});

describe("friendlyAuthError", () => {
  it("replaces Supabase's raw password-rule message", () => {
    const raw = "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()";
    expect(friendlyAuthError({ message: raw })).toMatch(/^Your password needs to be stronger\./);
    expect(friendlyAuthError({ message: "Password should be at least 8 characters." })).toMatch(/^Your password needs to be stronger\./);
  });

  it("recognises Supabase's weak_password code whatever the wording", () => {
    expect(friendlyAuthError({ code: "weak_password", message: "Password is known to be weak and easy to guess" })).toMatch(
      /^Your password needs to be stronger\./
    );
  });

  it("says when a password was refused for appearing in a breach", () => {
    expect(friendlyAuthError({ code: "weak_password", message: "Password is known to be weak", reasons: ["pwned"] })).toMatch(
      /appeared in a data breach/
    );
  });

  it("maps an existing-account error to one plain message", () => {
    expect(friendlyAuthError({ code: "user_already_exists", message: "User already registered" })).toBe(ACCOUNT_EXISTS_MESSAGE);
    expect(friendlyAuthError({ code: "email_exists", message: "Email address already registered" })).toBe(ACCOUNT_EXISTS_MESSAGE);
  });

  it("leaves other errors alone", () => {
    expect(friendlyAuthError({ code: "over_email_send_rate_limit", message: "Too many emails" })).toBe("Too many emails");
  });
});
