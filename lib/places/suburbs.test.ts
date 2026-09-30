import { describe, expect, it } from "vitest";
import { suggestPlaces, type Suburb } from "./suburbs";

const SUBURBS: Suburb[] = [
  ["Kogarah", "NSW", "2217"],
  ["Kogarah Bay", "NSW", "2217"],
  ["Parramatta", "NSW", "2150"],
  ["Richmond", "NSW", "2753"],
  ["Richmond", "VIC", "3121"],
  ["Sydney", "NSW", "2000"],
  ["Perth", "WA", "6000"],
  ["Perth", "TAS", "7300"],
  ["Victoria Park", "WA", "6100"],
  ["Mount Victoria", "NSW", "2786"],
  ["Mount Emu", "VIC", "3351"],
  ["Mount Best", "VIC", "3960"],
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

  it("treats a postcode with a state as a postcode search", () => {
    expect(values("2217 nsw")).toEqual(["Kogarah, NSW", "Kogarah Bay, NSW"]);
  });

  it("uses a postcode typed after a name to pick the state", () => {
    expect(values("Richmond 3121")[0]).toBe("Richmond, VIC");
  });

  it("keeps only the best matches, in order, however many match", () => {
    const many: Suburb[] = Array.from({ length: 50 }, (_, i) => [`Kew ${String(i).padStart(2, "0")}`, "VIC", "3101"] as const);
    expect(suggestPlaces("kew", [...many, ["Kew", "VIC", "3101"]]).map((s) => s.value)).toEqual([
      "Kew, VIC", "Kew 00, VIC", "Kew 01, VIC", "Kew 02, VIC", "Kew 03, VIC", "Kew 04, VIC",
    ]);
  });

  it("does not strip a state word off a name that matches as typed", () => {
    expect(values("mount victoria")).toEqual(["Mount Victoria, NSW"]);
  });

  it("does not read a half-typed name as a state", () => {
    expect(values("vic")).toContain("Victoria Park, WA");
  });

  it("puts extras first, drops suburbs that duplicate them, and skips chosen values", () => {
    expect(values("syd", { extras: ["Sydney"], extraStates: { Sydney: "NSW" } })).toEqual(["Sydney"]);
    expect(values("vic", { extras: ["Victoria"] })[0]).toBe("Victoria");
    expect(values("kog", { exclude: ["Kogarah, NSW"] })).toEqual(["Kogarah Bay, NSW"]);
  });

  it("drops only the same-state duplicate of a city, and never in a postcode search", () => {
    const opts = { extras: ["Perth", "Sydney"], extraStates: { Perth: "WA", Sydney: "NSW" } };
    expect(values("perth", opts)).toEqual(["Perth", "Perth, TAS"]);
    expect(values("2000", opts)).toEqual(["Sydney, NSW"]);
  });

  it("puts a state typed as its code first", () => {
    const opts = { extras: ["Western Australia", "New South Wales"] };
    expect(values("wa", opts)[0]).toBe("Western Australia");
    expect(values("NSW", opts)[0]).toBe("New South Wales");
  });

  it("filters extras by a typed state too", () => {
    const opts = { extras: ["Perth"], extraStates: { Perth: "WA" } };
    expect(values("perth tas", opts)).toEqual(["Perth, TAS"]);
  });

  it("returns nothing for empty input", () => {
    expect(values("  ")).toEqual([]);
  });
});
