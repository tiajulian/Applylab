import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findPlaceName, parsePlace, placeReadings, resolvePoints, stateFromPostcode } from "@/lib/jobs/places";
import { fakeSupabase } from "@/lib/jobs/testing/fakeSupabase";

const RICHMONDS = [
  { name: "Richmond", name_key: "richmond", state_code: "VIC", lat: -37.82, lng: 145.0 },
  { name: "Richmond", name_key: "richmond", state_code: "NSW", lat: -33.6, lng: 150.75 },
];
const client = (rows: object[]) => fakeSupabase({ au_places: [{ data: rows }] });
const sb = (fake: ReturnType<typeof fakeSupabase>) => fake.client as unknown as SupabaseClient;

describe("parsePlace", () => {
  it.each([
    ["Kogarah", { name: "Kogarah", state: null }],
    ["kogarah 2217", { name: "kogarah", state: "NSW" }],
    ["Richmond 3121", { name: "Richmond", state: "VIC" }],
    ["Richmond VIC 3121", { name: "Richmond", state: "VIC" }],
    ["North Sydney NSW 2060", { name: "North Sydney", state: "NSW" }],
    ["Parramatta, New South Wales", { name: "Parramatta", state: "NSW" }],
    ["Victoria Park, WA", { name: "Victoria Park", state: "WA" }],
    ["Victoria Park", { name: "Victoria Park", state: null }],
    ["Wagga Wagga", { name: "Wagga Wagga", state: null }],
    ["Victoria", { name: "", state: "VIC" }],
  ])("%s", (raw, expected) => expect(parsePlace(raw)).toEqual(expected));
});

describe("placeReadings", () => {
  it("offers the whole name first when a state word follows only a space", () => {
    expect(placeReadings("Mount Victoria")).toEqual([
      { name: "Mount Victoria", state: null },
      { name: "Mount", state: "VIC" },
    ]);
    expect(placeReadings("Richmond VIC 3121")[0]).toEqual({ name: "Richmond VIC", state: "VIC" });
  });

  it("treats a state after a comma, or a bare state, as the state only", () => {
    expect(placeReadings("Victoria Park, WA")).toEqual([{ name: "Victoria Park", state: "WA" }]);
    expect(placeReadings("Victoria")).toEqual([{ name: "", state: "VIC" }]);
  });
});

describe("stateFromPostcode", () => {
  it.each([
    [2217, "NSW"],
    [2600, "ACT"],
    [3121, "VIC"],
    [4000, "QLD"],
    [800, "NT"],
    [6000, "WA"],
    [7000, "TAS"],
    [5000, "SA"],
  ])("%i -> %s", (postcode, state) => expect(stateFromPostcode(postcode)).toBe(state));
});

describe("resolvePoints", () => {
  it("uses the state from the text or postcode to pick between same-named places", async () => {
    const fake = client(RICHMONDS);
    await expect(resolvePoints(sb(fake), ["Richmond 3121"])).resolves.toEqual({ points: [{ lat: -37.82, lng: 145.0 }], unresolved: [] });
    expect(fake.calls.find((c) => c.method === "in")?.args).toEqual(["name_key", ["richmond"]]);
  });

  it("keeps every same-named place without a hint, and returns states and unknown places for name matching", async () => {
    const { points, unresolved } = await resolvePoints(sb(client(RICHMONDS)), ["Richmond", "Nowhere", "Victoria"]);
    expect(points).toHaveLength(2);
    expect(unresolved).toEqual(["Nowhere", "Victoria"]);
  });

  it("finds a town whose name ends in a state word", async () => {
    const mountVictoria = [{ name: "Mount Victoria", name_key: "mount victoria", state_code: "NSW", lat: -33.59, lng: 150.26 }];
    const fake = client(mountVictoria);
    await expect(resolvePoints(sb(fake), ["Mount Victoria"])).resolves.toEqual({ points: [{ lat: -33.59, lng: 150.26 }], unresolved: [] });
    expect(fake.calls.find((c) => c.method === "in")?.args).toEqual(["name_key", ["mount victoria", "mount"]]);
    await expect(findPlaceName(sb(client(mountVictoria)), "Mount Victoria")).resolves.toBe("Mount Victoria");
  });

  it("does no lookup for an empty list", async () => {
    const fake = client([]);
    await expect(resolvePoints(sb(fake), [])).resolves.toEqual({ points: [], unresolved: [] });
    expect(fake.calls).toHaveLength(0);
  });
});

describe("findPlaceName", () => {
  it("returns the known place, keeping a given state and never guessing one", async () => {
    const kogarah = [{ name: "Kogarah", name_key: "kogarah", state_code: "NSW", lat: -33.97, lng: 151.14 }];
    await expect(findPlaceName(sb(client(kogarah)), "kogarah 2217")).resolves.toBe("Kogarah NSW");
    await expect(findPlaceName(sb(client(kogarah)), "Kogarah")).resolves.toBe("Kogarah");
    await expect(findPlaceName(sb(client(RICHMONDS)), "Richmond")).resolves.toBe("Richmond");
    await expect(findPlaceName(sb(client([])), "Nowhere")).resolves.toBeNull();
  });
});
