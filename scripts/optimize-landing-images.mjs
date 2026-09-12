// One-off script to fix two oversized/broken static assets found during a Lighthouse pass on the
// landing page (see components/landing/AutofillVideoShowcase.tsx and components/marketing/LogoMark.tsx):
//   - public/logo-icon.png was a 501x512 source PNG displayed at 38x38 (76x76 @2x) - ~44x oversized.
//   - public/images/autofill-demo-poster.webp was not actually WebP at all: its bytes are identical
//     to the .jpg (same 429418-byte size, same JPEG magic bytes), just copy-renamed with a .webp
//     extension - so it was shipping as a mislabeled, uncompressed JPEG.
// Not part of the app's runtime - run once (`node scripts/optimize-landing-images.mjs`) after
// swapping in a new source asset for either of these two files.
import sharp from "sharp";
import { statSync } from "fs";

function kb(bytes) {
  return (bytes / 1024).toFixed(1) + " KiB";
}

async function report(label, path) {
  console.log(`${label}: ${kb(statSync(path).size)}`);
}

async function main() {
  // Logo mark: displayed at 38x38 everywhere it's used (components/marketing/LogoMark.tsx) - 76x76
  // covers 2x retina. Palette mode (8-bit indexed) is a large additional win for a flat-color icon.
  await sharp("public/logo-icon.png")
    .resize(76, 76)
    .png({ compressionLevel: 9, palette: true })
    .toFile("public/logo-icon.optimized.png");

  // Poster: displayed at up to ~630px CSS width (Container "marketing" max-width 1140px, 7/12
  // columns, minus padding) - 1280px covers 2x retina with a little headroom for wider layouts.
  const posterPipeline = () => sharp("public/images/autofill-demo-poster.jpg").resize({ width: 1280, withoutEnlargement: true });

  await posterPipeline().webp({ quality: 72 }).toFile("public/images/autofill-demo-poster.optimized.webp");
  await posterPipeline().jpeg({ quality: 75, mozjpeg: true }).toFile("public/images/autofill-demo-poster.optimized.jpg");

  await report("logo-icon.png (before)", "public/logo-icon.png");
  await report("logo-icon.png (after)", "public/logo-icon.optimized.png");
  await report("autofill-demo-poster.webp (before, actually JPEG)", "public/images/autofill-demo-poster.webp");
  await report("autofill-demo-poster.webp (after, real WebP)", "public/images/autofill-demo-poster.optimized.webp");
  await report("autofill-demo-poster.jpg (before)", "public/images/autofill-demo-poster.jpg");
  await report("autofill-demo-poster.jpg (after)", "public/images/autofill-demo-poster.optimized.jpg");
}

main();
