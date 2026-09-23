import { describe, expect, it } from "vitest";
import {
  insertMarkupAroundSelection,
  isRangeFormatted,
  markedToPlainOffset,
  parseBulletMarkup,
  plainToMarkedOffset,
  sanitizeBulletMarkers,
  serializeBulletRuns,
  stripBulletMarkup,
} from "./bulletMarkup";

describe("parseBulletMarkup", () => {
  it("parses plain text as one unformatted run", () => {
    expect(parseBulletMarkup("Cut report time by 40%.")).toEqual([{ text: "Cut report time by 40%.", bold: false, italic: false }]);
  });

  it("parses bold and italic runs alongside plain text", () => {
    expect(parseBulletMarkup("**Led** a team of *five* engineers")).toEqual([
      { text: "Led", bold: true, italic: false },
      { text: " a team of ", bold: false, italic: false },
      { text: "five", bold: false, italic: true },
      { text: " engineers", bold: false, italic: false },
    ]);
  });

  it("parses a triple-asterisk run as bold+italic together", () => {
    expect(parseBulletMarkup("***critical***")).toEqual([{ text: "critical", bold: true, italic: true }]);
  });

  it("handles bold wrapped around italic (sequential wrapping produces a combined run)", () => {
    // "**" + "*x*" + "**" collapses to "***x***" at the character level - same as typing it directly.
    expect(parseBulletMarkup("***x***")).toEqual([{ text: "x", bold: true, italic: true }]);
  });

  it("is tolerant of an unmatched marker rather than throwing", () => {
    expect(parseBulletMarkup("started **bold and never closed")).toEqual([
      { text: "started ", bold: false, italic: false },
      { text: "bold and never closed", bold: true, italic: false },
    ]);
  });

  it("treats a run of more than 3 asterisks as a marker plus literal asterisks", () => {
    // Leading "****" = marker(3, toggles both) + one literal "*"; trailing "**" then toggles bold
    // back off, leaving the run bold+italic (the italic toggle from the opening marker is never
    // undone).
    expect(parseBulletMarkup("****x**")).toEqual([{ text: "*x", bold: true, italic: true }]);
  });

  it("handles empty input", () => {
    expect(parseBulletMarkup("")).toEqual([]);
  });
});

describe("stripBulletMarkup", () => {
  it("removes all markers, leaving only the semantic text", () => {
    expect(stripBulletMarkup("**Led** a team of *five* ***engineers***")).toBe("Led a team of five engineers");
  });

  it("is a no-op on text with no markers", () => {
    expect(stripBulletMarkup("Cut report time by 40%.")).toBe("Cut report time by 40%.");
  });
});

describe("plainToMarkedOffset / markedToPlainOffset", () => {
  const marked = "**Led** a team of *five* engineers";
  const plain = stripBulletMarkup(marked); // "Led a team of five engineers"

  it("round-trips a position inside a plain run", () => {
    const plainOffset = plain.indexOf("team");
    const markedOffset = plainToMarkedOffset(marked, plainOffset);
    expect(marked.slice(markedOffset, markedOffset + 4)).toBe("team");
    expect(markedToPlainOffset(marked, markedOffset)).toBe(plainOffset);
  });

  it("round-trips a position inside a bold run", () => {
    const plainOffset = plain.indexOf("Led");
    const markedOffset = plainToMarkedOffset(marked, plainOffset);
    expect(marked.slice(markedOffset, markedOffset + 3)).toBe("Led");
    expect(markedToPlainOffset(marked, markedOffset)).toBe(plainOffset);
  });

  it("maps the end of the plain text to the end of the marked text", () => {
    expect(plainToMarkedOffset(marked, plain.length)).toBe(marked.length);
    expect(markedToPlainOffset(marked, marked.length)).toBe(plain.length);
  });

  it("maps the plain text's own start/end positions to where that text actually sits in the marked string", () => {
    // Plain offset 0 is the very first real character ("L" of "Led"), which sits at marked offset
    // 2 - right after the leading "**". Marked offset 0 is itself inside that opening marker (not
    // addressable text), so it snaps to the nearer run's boundary: plain offset 0.
    expect(plainToMarkedOffset(marked, 0)).toBe(2);
    expect(markedToPlainOffset(marked, 0)).toBe(0);
  });

  it("with bias 'end', lands after a run's closing marker instead of before it when a range ends flush with a formatted run", () => {
    // A [start, end) range spanning "Led" with the default "start" bias on both ends would land
    // its end position *before* "**"'s closing marker (right after "Led"'s own text) - correct for
    // a start, but for an end it leaves the closing "**" dangling outside the slice. "end" bias
    // instead lands after the transition, so the slice includes it.
    const plainStart = plain.indexOf("Led");
    const plainEnd = plainStart + "Led".length;
    const startBiasEnd = plainToMarkedOffset(marked, plainEnd, "start");
    const endBiasEnd = plainToMarkedOffset(marked, plainEnd, "end");
    expect(marked.slice(0, startBiasEnd)).toBe("**Led"); // dangling opening marker, no closing one
    expect(marked.slice(0, endBiasEnd)).toBe("**Led**"); // balanced
  });

  it("with bias 'end', behaves exactly like 'start' when the offset is not on a run boundary", () => {
    const plainOffset = plain.indexOf("team") + 2;
    expect(plainToMarkedOffset(marked, plainOffset, "end")).toBe(plainToMarkedOffset(marked, plainOffset, "start"));
  });

  it("with bias 'end', still maps the very end of the plain text to the end of the marked text", () => {
    expect(plainToMarkedOffset(marked, plain.length, "end")).toBe(marked.length);
  });
});

describe("sanitizeBulletMarkers", () => {
  it("removes literal asterisks a model might emit, without touching the rest of the text", () => {
    expect(sanitizeBulletMarkers("Grew signups 3x* over the quarter")).toBe("Grew signups 3x over the quarter");
    expect(sanitizeBulletMarkers("**Led** a team")).toBe("Led a team");
    expect(sanitizeBulletMarkers("No markers here")).toBe("No markers here");
  });
});

describe("serializeBulletRuns", () => {
  it("round-trips parseBulletMarkup for plain, bold, italic and combined runs", () => {
    for (const marked of ["Cut report time by 40%.", "**Led** a team of *five* engineers", "***critical*** launch", "a *bold and italic zone* b"]) {
      expect(serializeBulletRuns(parseBulletMarkup(marked))).toBe(marked);
    }
  });

  it("never emits an ambiguous adjacent marker run between two differently-styled runs with no plain-text gap", () => {
    // The exact adjacency this function exists to get right: an italic run ending exactly where a
    // bold+italic run begins, with nothing between them - a naive per-run wrap would emit "*" then
    // "***" back to back ("****"), which parses back as something else entirely.
    const runs = [
      { text: "bold and ", bold: false, italic: true },
      { text: "italic zone", bold: true, italic: true },
    ];
    const text = serializeBulletRuns(runs);
    expect(parseBulletMarkup(text)).toEqual(runs);
  });

  it("skips an empty run without emitting a stray marker pair", () => {
    expect(serializeBulletRuns([{ text: "a", bold: false, italic: false }, { text: "", bold: true, italic: false }, { text: "b", bold: false, italic: false }])).toBe("ab");
  });
});

describe("isRangeFormatted", () => {
  const marked = "**Led** a team of *five* engineers"; // plain: "Led a team of five engineers"

  it("is true when the whole range is bold", () => {
    expect(isRangeFormatted(marked, 0, 3, "bold")).toBe(true); // "Led"
  });

  it("is false when only part of the range is bold", () => {
    expect(isRangeFormatted(marked, 0, 5, "bold")).toBe(false); // "Led a" - "Led" bold, " a" not
  });

  it("is false for a different attribute than the one applied", () => {
    expect(isRangeFormatted(marked, 0, 3, "italic")).toBe(false); // "Led" is bold, not italic
  });

  it("is false for a collapsed range", () => {
    expect(isRangeFormatted(marked, 3, 3, "bold")).toBe(false);
  });
});

describe("insertMarkupAroundSelection", () => {
  it("wraps a plain-text selection in bold", () => {
    const result = insertMarkupAroundSelection("Led a team of five", 0, 3, "bold");
    expect(result.text).toBe("**Led** a team of five");
    expect(parseBulletMarkup(result.text)[0]).toEqual({ text: "Led", bold: true, italic: false });
  });

  it("wraps a mid-string selection in italic", () => {
    const text = "Led a team of five engineers";
    const start = text.indexOf("five");
    const result = insertMarkupAroundSelection(text, start, start + 4, "italic");
    expect(result.text).toBe("Led a team of *five* engineers");
  });

  it("toggles bold off when the whole selection is already bold", () => {
    const bolded = insertMarkupAroundSelection("Led a team", 0, 3, "bold").text;
    const unbolded = insertMarkupAroundSelection(bolded, 0, 3, "bold");
    expect(unbolded.text).toBe("Led a team");
  });

  it("applies bold to the whole selection (not toggling off) when only part of it is already bold", () => {
    // "Led" is bold, selection is "Led a" (partially bold) - clicking Bold should make the WHOLE
    // selection bold, not strip the existing bold from "Led" (standard WYSIWYG toggle semantics).
    const partiallyBold = insertMarkupAroundSelection("Led a team", 0, 3, "bold").text; // "**Led** a team"
    const result = insertMarkupAroundSelection(partiallyBold, 0, 5, "bold"); // select "Led a"
    expect(parseBulletMarkup(result.text)).toEqual([
      { text: "Led a", bold: true, italic: false },
      { text: " team", bold: false, italic: false },
    ]);
  });

  it("applies bold to a selection that starts mid-way through an existing italic run, without corrupting either marker", () => {
    const withItalic = "a *bold and italic zone* b";
    const plain = stripBulletMarkup(withItalic); // "a bold and italic zone b"
    // Select "italic zone" only, which starts and ends inside the existing italic run.
    const plainStart = plain.indexOf("italic zone");
    const result = insertMarkupAroundSelection(withItalic, plainStart, plainStart + "italic zone".length, "bold");
    expect(parseBulletMarkup(result.text)).toEqual([
      { text: "a ", bold: false, italic: false },
      { text: "bold and ", bold: false, italic: true },
      { text: "italic zone", bold: true, italic: true },
      { text: " b", bold: false, italic: false },
    ]);
    // Round-trips: the plain text itself is unchanged by a formatting-only edit.
    expect(stripBulletMarkup(result.text)).toBe(plain);
  });

  it("merges an already-bold selection with adjacent bold text rather than fragmenting markers", () => {
    // Selecting "Led a" and bolding it, where "Led" was already bold, should produce one bold run,
    // not "**Led****  a**"-style fragments.
    const result = insertMarkupAroundSelection("**Led** a team", stripBulletMarkup("**Led** a team").indexOf("Led"), stripBulletMarkup("**Led** a team").indexOf("Led") + 5, "bold");
    expect(result.text).toBe("**Led a** team");
  });

  it("supports bold and italic together on the same selection", () => {
    const bolded = insertMarkupAroundSelection("critical launch", 0, 8, "bold").text;
    const both = insertMarkupAroundSelection(bolded, 0, 8, "italic");
    expect(parseBulletMarkup(both.text)[0]).toEqual({ text: "critical", bold: true, italic: true });
  });

  it("is a no-op on a collapsed selection", () => {
    const result = insertMarkupAroundSelection("Led a team", 3, 3, "bold");
    expect(result.text).toBe("Led a team");
  });

  it("returns the same plain-text start/end so the caller can restore selection after re-rendering", () => {
    const result = insertMarkupAroundSelection("Led a team", 0, 3, "bold");
    expect(result.start).toBe(0);
    expect(result.end).toBe(3);
  });

  it("clamps out-of-range offsets instead of throwing", () => {
    const result = insertMarkupAroundSelection("short", 0, 999, "bold");
    expect(result.text).toBe("**short**");
  });
});
