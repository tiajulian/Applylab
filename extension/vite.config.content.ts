import { defineConfig } from 'vite';
import { resolve } from 'path';

// Content scripts are injected by Chrome as classic (non-module) scripts —
// manifest.json's content_scripts.js entries have no "type": "module"
// option (unlike the background service worker). This build has a single
// entry point and format: 'iife', so Rollup inlines every dependency
// (including src/utils/australianTaxonomy.ts) directly into the output
// instead of splitting it into a chunk pulled in via `import`. Kept as a
// separate config from vite.config.ts specifically so this entry never
// shares chunks with the ESM background/sidepanel build.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        format: 'iife',
        entryFileNames: 'content/index.js',
      },
    },
  },
});
