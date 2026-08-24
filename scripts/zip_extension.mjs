import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function zipDirectory(sourceDir, outPath) {
  const zip = new JSZip();

  function addFiles(dirPath, zipFolder) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const subFolder = zipFolder.folder(file);
        addFiles(fullPath, subFolder);
      } else {
        const content = fs.readFileSync(fullPath);
        zipFolder.file(file, content);
      }
    }
  }

  addFiles(sourceDir, zip);

  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(outPath, content);
  console.log(`Successfully created ZIP bundle at ${outPath} (${(content.length / 1024).toFixed(1)} KB)`);
}

const source = path.resolve(rootDir, 'extension/dist');
const destination = path.resolve(rootDir, 'public/downloads/applylab-extension.zip');

if (fs.existsSync(source)) {
  zipDirectory(source, destination).catch(err => {
    console.error('Error zipping extension directory:', err);
    process.exit(1);
  });
} else {
  console.error(`Source directory ${source} does not exist. Run "npm run build" in extension first.`);
  process.exit(1);
}
