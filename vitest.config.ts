import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json sets "jsx": "preserve" for Next.js's own compiler, but Vitest's default oxc
  // transform refuses to run on "preserve" (it needs to actually transform JSX itself, since some
  // tests render template components). Force the esbuild transform instead, which we can point at
  // "automatic" regardless of what tsconfig.json says - Next.js's own build reads tsconfig.json
  // unmodified, so this doesn't affect it.
  oxc: false,
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // The jsdom render tests take well under a second alone, but can pass the 5s default when
    // the whole suite runs in parallel on a busy machine (dev servers open). 10s keeps a real hang
    // failing without flaking on load.
    testTimeout: 10000,
  },
});
