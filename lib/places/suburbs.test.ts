import { describe, expect, it } from "vitest";
import { suggestPlaces, type Suburb } from "./suburbs";

const SUBURBS: Suburb[] = [
  ["Kogarah", "NSW", "2217"],
  ["Kogarah Bay", "NSW", "2217"],
  ["Parramatta", "NSW", "2150"],
  ["Richmond", "NSW", "2753"],
  ["Richmond", "VIC", "3121"],
  ["Sydney", "NSW", "2000"],
  ["Victoria Park", "WA", "6100"],
];
const values = (query: string, options?: Parameters<typeof suggestPlaces>[2]) =>
  suggestPlaces(query, SUBURBS, options).map((s) => s.value);

describe("suggestPlaces", () => {
  it("suggests suburbs from a partial name, formatted Suburb, STATE with the postcode", () => {
    expect(values("kog")).toEqual(["Kogarah, NSW", "Kogarah Bay, NSW"]);
    expect(suggestPlaces("kog", SUBURBS)[0].detail).toBe("2217");
  });

  it("tolerates typos", () => {
    expect(values("kograh")).toContain("Kogarah, NSW");
    expect(values("paramatta")).toContain("Parramatta, NSW");
  });

  it("narrows by a typed state, and finds places by postcode", () => {
    expect(values("richmond vic")).toEqual(["Richmond, VIC"]);
    expect(values("Richmond, NSW")).toEqual(["Richmond, NSW"]);
    expect(values("2217")).toEqual(["Kogarah, NSW", "Kogarah Bay, NSW"]);
  });

  it("does not read a half-typed name as a state", () => {
    expect(values("vic")).toContain("Victoria Park, WA");
  });

  it("puts extras first, drops suburbs that duplicate them, and skips chosen values", () => {
    expect(values("syd", { extras: ["Sydney"] })).toEqual(["Sydney"]);
    expect(values("vic", { extras: ["Victoria"] })[0]).toBe("Victoria");
    expect(values("kog", { exclude: ["Kogarah, NSW"] })).toEqual(["Kogarah Bay, NSW"]);
  });

  it("returns nothing for empty input", () => {
    expect(values("  ")).toEqual([]);
  });
});
