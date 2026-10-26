import { readFile } from "node:fs/promises";
import path from "node:path";
import type { HTTPRequest, Page } from "puppeteer-core";

/**
 * Serverless Chromium (@sparticuz/chromium on Vercel) ships with almost no system fonts, so
 * every resume stack (Arial, Georgia, Garamond...) fell back to its one bundled font and the PDF
 * ignored the font picked in the editor. Each system font name used by the templates and the
 * Design panel is mapped here to a metric-compatible open font, declared under the system name
 * itself with `local()` first: a machine that has the real font (local dev on Windows/macOS)
 * keeps using it, and one that doesn't gets the bundled substitute with the same line breaks.
 *
 * The files are read from node_modules (see outputFileTracingIncludes in next.config.mjs) and
 * served to the page by request interception from a fake origin, so the HTML stays small and
 * nothing is fetched over the network.
 */

const FONT_ORIGIN = "https://pdf-fonts.applylab.invalid/";

interface FontFile {
  weight: 400 | 700;
  style: "normal" | "italic";
  /** Path under node_modules. */
  file: string;
}

function fontsource(pkg: string): FontFile[] {
  return ([400, 700] as const).flatMap((weight) =>
    (["normal", "italic"] as const).map((style) => ({
      weight,
      style,
      file: `@fontsource/${pkg}/files/${pkg}-latin-${weight}-${style}.woff2`,
    })),
  );
}

function dejavu(base: string, italicSuffix: string): FontFile[] {
  const dir = "dejavu-fonts-ttf/ttf";
  return [
    { weight: 400, style: "normal", file: `${dir}/${base}.ttf` },
    { weight: 700, style: "normal", file: `${dir}/${base}-Bold.ttf` },
    { weight: 400, style: "italic", file: `${dir}/${base}-${italicSuffix}.ttf` },
    { weight: 700, style: "italic", file: `${dir}/${base}-Bold${italicSuffix}.ttf` },
  ];
}

/** System font name (as written in the CSS stacks) -> metric-compatible substitute files. */
const SUBSTITUTES: { names: string[]; files: FontFile[] }[] = [
  { names: ["Arial", "Helvetica", "Helvetica Neue"], files: fontsource("arimo") },
  { names: ["Times New Roman", "Times"], files: fontsource("tinos") },
  { names: ["Georgia"], files: fontsource("gelasio") },
  { names: ["Garamond"], files: fontsource("eb-garamond") },
  { names: ["Calibri"], files: fontsource("carlito") },
  { names: ["Verdana", "Geneva"], files: dejavu("DejaVuSans", "Oblique") },
  { names: ["Consolas", "Menlo", "Monaco"], files: dejavu("DejaVuSansMono", "Oblique") },
];

// Only these files are ever served, whatever URL the page asks for.
const ALLOWED_FILES = new Set(SUBSTITUTES.flatMap(({ files }) => files.map(({ file }) => file)));

function fontUrl(file: string): string {
  return FONT_ORIGIN + file;
}

/** @font-face rules for every substituted font name that appears in the markup. */
export function pdfFontFaceCss(markup: string): string {
  return SUBSTITUTES.flatMap(({ names, files }) =>
    names
      .filter((name) => markup.includes(name))
      .flatMap((name) =>
        files.map(
          ({ weight, style, file }) =>
            `@font-face { font-family: "${name}"; src: local("${name}"), url("${fontUrl(file)}"); font-weight: ${weight}; font-style: ${style}; }`,
        ),
      ),
  ).join("\n");
}

const fileCache = new Map<string, Promise<Buffer>>();

function readFontFile(file: string): Promise<Buffer> {
  let cached = fileCache.get(file);
  if (!cached) {
    cached = readFile(path.join(process.cwd(), "node_modules", file));
    // Don't cache a failed read: a later render should try again.
    cached.catch(() => fileCache.delete(file));
    fileCache.set(file, cached);
  }
  return cached;
}

/** Serves the substitute font files to this page. Call once per page, before setContent. */
export async function servePdfFonts(page: Page): Promise<void> {
  await page.setRequestInterception(true);
  page.on("request", (request: HTTPRequest) => {
    const url = request.url();
    if (!url.startsWith(FONT_ORIGIN)) {
      void request.continue();
      return;
    }
    const file = url.slice(FONT_ORIGIN.length);
    if (!ALLOWED_FILES.has(file)) {
      void request.abort();
      return;
    }
    readFontFile(file).then(
      (body) =>
        request.respond({
          status: 200,
          contentType: file.endsWith(".ttf") ? "font/ttf" : "font/woff2",
          // Fonts load in CORS mode, and the page's origin differs from this fake one.
          headers: { "Access-Control-Allow-Origin": "*" },
          body,
        }),
      (error) => {
        console.error("PDF font missing", file, error);
        void request.abort();
      },
    );
  });
}

/** Waits for every font the laid-out page uses to finish loading, so page.pdf never prints a fallback. */
export async function waitForPdfFonts(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
