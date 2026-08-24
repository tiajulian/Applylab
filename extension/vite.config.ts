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

export default defineConfig({
  plugins: [copyManifestAndIcons()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background/index.js';
          if (chunkInfo.name === 'content') return 'content/index.js';
          return '[name]/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});

