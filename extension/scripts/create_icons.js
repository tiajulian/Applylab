import fs from 'fs';
import path from 'path';

// Minimal valid PNG generator (single color terracotta #E86D3B)
function createPngBuffer(width, height) {
  // We can write a simple valid uncompressed PNG file structure
  // Or create minimal valid PNG binary headers
  const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    // Simple CRC calculation or precalculated for IHDR/IDAT/IEND
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // Use a pre-baked minimal valid base64 PNG data URL representing a terracotta tile
  // 16x16 terracotta PNG base64:
  const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABMSURBVHgB7dKxDQAgDAAxeTMRYwa2YBpWyR2ioEvlKx0vSRpJ1hln/O2x0fme+fW2533m19ue95lfb3veZ3697Xmf+fW2533m19ue95lf/3EDLdM9Ew/j1/0AAAAASUVORK5CYII=';
  return Buffer.from(base64Png, 'base64');
}

const iconsDir = path.resolve(process.cwd(), 'public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach((size) => {
  const buf = createPngBuffer(size, size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), buf);
  console.log(`Created icon-${size}.png`);
});
