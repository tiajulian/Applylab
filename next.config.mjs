/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse pulls in pdfjs-dist's legacy build, which breaks when webpack tries to bundle
    // it for the server (throws "Object.defineProperty called on non-object" at import time,
    // taking down the whole /api/profile/parse route). Excluding it from bundling so Node
    // requires it natively at runtime instead.
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
    // pdfjs-dist falls back to a "fake worker" that dynamically imports its own
    // pdf.worker.mjs at runtime — a path Next's build-time file tracing can't follow
    // statically, so Vercel's deployed function is missing the file ("Setting up fake worker
    // failed: Cannot find module .../pdf.worker.mjs"). Force it into every route's bundle.
    // Applied broadly (not scoped to /api/profile/parse) since the exact route-key glob format
    // for App Router handlers on this Next version isn't worth risking a typo over — the file
    // is ~2MB, negligible next to Vercel's function-size limit.
    outputFileTracingIncludes: {
      "/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    },
  },
};

export default nextConfig;
