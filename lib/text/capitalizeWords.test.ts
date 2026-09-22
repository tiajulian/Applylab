import { describe, expect, it } from "vitest";
import { capitalizeWords } from "./capitalizeWords";

describe("capitalizeWords", () => {
  it("capitalizes the first letter of an all-lowercase phrase, word by word", () => {
    expect(capitalizeWords("australian citizen")).toBe("Australian Citizen");
    expect(capitalizeWords("ice cream shop worker")).toBe("Ice Cream Shop Worker");
    expect(capitalizeWords("full working rights")).toBe("Full Working Rights");
  });

  it("leaves an already-capitalized word untouched, only fixing the ones that need it", () => {
    expect(capitalizeWords("Ice Cream Shop worker")).toBe("Ice Cream Shop Worker");
  });

  it("never touches a word that already carries an uppercase letter anywhere, even if it starts lowercase", () => {
    // A blind per-letter capitalize would turn these into IOS / MCDONALD'S / EBAY, all wrong.
    expect(capitalizeWords("iOS Developer")).toBe("iOS Developer");
    expect(capitalizeWords("mcDonald's")).toBe("mcDonald's");
    expect(capitalizeWords("eBay seller")).toBe("eBay Seller");
  });

  it("leaves an acronym or already-uppercase word alone", () => {
    expect(capitalizeWords("NSW")).toBe("NSW");
    expect(capitalizeWords("IBM consultant")).toBe("IBM Consultant");
  });

  it("handles empty and whitespace-only input", () => {
    expect(capitalizeWords("")).toBe("");
    expect(capitalizeWords("   ")).toBe("   ");
  });
});
