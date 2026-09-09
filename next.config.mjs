/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse pulls in pdfjs-dist's legacy build, which breaks when webpack tries to bundle
    // it for the server (throws "Object.defineProperty called on non-object" at import time,
    // taking down the whole /api/profile/parse route). Excluding it from bundling so Node
    // requires it natively at runtime instead.
    //
    // @sparticuz/chromium resolves its bin/ directory via a relative path at runtime, which
    // breaks the same way if webpack relocates it — confirmed in production: "The input
    // directory '.../@sparticuz/chromium/bin' does not exist", the package's own documented
    // symptom for "you forgot to externalize this." puppeteer-core is externalized alongside it
    // per the package's own guidance for serverless Puppeteer + a bundler.
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist", "@sparticuz/chromium", "puppeteer-core"],
    // pdfjs-dist falls back to a "fake worker" that dynamically imports its own
    // pdf.worker.mjs at runtime — a path Next's build-time file tracing can't follow
    // statically, so Vercel's deployed function is missing the file ("Setting up fake worker
    // failed: Cannot find module .../pdf.worker.mjs"). Applied broadly (not scoped to
    // /api/profile/parse) since the file is ~2MB — negligible next to Vercel's function-size
    // limit, so there's no reason to scope it.
    //
    // @sparticuz/chromium's actual binary (bin/*.br, ~67MB total) is loaded via runtime path
    // construction (chromium.executablePath()), same untraceable-by-default problem as the
    // pdfjs worker above — but this one IS scoped, to /api/generate-pdf only, since 67MB on
    // every function would be wasteful. Route-key glob format verified empirically by
    // rebuilding and inspecting the actual .next/server/**/*.nft.json trace manifests: this
    // exact key includes the files in generate-pdf's manifest and only that one.
    outputFileTracingIncludes: {
      "/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
      "/api/generate-pdf/**": ["./node_modules/@sparticuz/chromium/bin/*"],
    },
  },
  async headers() {
    // Nothing in the app renders an iframe or is meant to be framed (verified: no <iframe>
    // usage anywhere in the codebase), so we can deny framing outright rather than merely
    // restricting it. microphone stays enabled for the interview voice recorder
    // (components/interview/VoiceRecorder.tsx uses getUserMedia); everything else sensitive
    // is off since nothing here uses it.
    //
    // This intentionally does NOT set script-src/connect-src/etc. — a full CSP needs an
    // audited allowlist of every third-party origin the app actually calls (Supabase, Stripe,
    // Turnstile, analytics, ...) and live testing against production, which is a separate,
    // larger change. frame-ancestors covers the clickjacking risk on its own.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none';" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
