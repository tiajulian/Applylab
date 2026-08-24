import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

function copyManifestAndIcons() {
  return {
    name: 'copy-manifest-and-icons',
    closeBundle() {
      if (fs.existsSync('manifest.json')) {
        fs.copyFileSync('manifest.json', 'dist/manifest.json');
      }
      if (fs.existsSync('public/icons')) {
        const destDir = 'dist/icons';
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        const files = fs.readdirSync('public/icons');
        for (const file of files) {
          fs.copyFileSync(`public/icons/${file}`, `${destDir}/${file}`);
        }
      }
    }
  };
}

// Background (declared "type": "module" in manifest.json, so ESM output
// with import statements is fine) and the sidepanel HTML entry (Vite
// injects <script type="module"> automatically) are built together here.
// The content script is built separately by vite.config.content.ts — it
// can't share this build because Chrome loads content_scripts as classic
// (non-module) scripts, so any `import` statement in that file throws
// "Cannot use import statement outside a module" at runtime. Bundling it
// alongside other entries let Rollup hoist code shared with sidepanel
// (src/utils/australianTaxonomy.ts) into an ESM chunk that content/index.js
// then tried to `import`, which is exactly what broke on every page.
export default defineConfig({
  plugins: [copyManifestAndIcons()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background/index.js';
          return '[name]/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
