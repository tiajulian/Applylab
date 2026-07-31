import DOMMatrixPolyfill from "dommatrix";

// pdf-parse (via pdfjs-dist's legacy build) references browser globals like DOMMatrix for
// certain PDFs — depending on embedded fonts/graphics state, not all PDFs — even though we only
// use it for text extraction, never rendering. Node has no DOMMatrix at all, so this must be
// imported before anything imports pdf-parse: ES module static imports evaluate in source order,
// so as long as this is the first import in a file, this side effect runs before pdf-parse's
// module graph does.
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}
