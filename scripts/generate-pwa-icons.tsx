/**
 * Generate PNG icons for the web app manifest (Android / installability).
 * Run: node --import tsx scripts/generate-pwa-icons.tsx
 *
 * Source: src/app/icon.png (chef hat). Also refreshes apple-icon + favicon.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src", "app", "icon.png");
const outDir = join(root, "public", "icons");
const appDir = join(root, "src", "app");

async function writePng(path: string, size: number) {
  await sharp(source)
    .ensureAlpha()
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(path);
  console.log(`Wrote ${path}`);
}

async function pngBuffer(size: number) {
  return sharp(source)
    .ensureAlpha()
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();
}

function icoFromPngs(pngs: Buffer[], sizes: number[]) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const parts: Buffer[] = [header, dir];
  for (let i = 0; i < count; i++) {
    const png = pngs[i]!;
    const size = sizes[i]!;
    const entry = dir.subarray(i * 16, i * 16 + 16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    parts.push(png);
    offset += png.length;
  }
  return Buffer.concat(parts);
}

async function main() {
  // Ensure source exists (committed as app icon)
  readFileSync(source);

  mkdirSync(outDir, { recursive: true });
  await writePng(join(outDir, "icon-192.png"), 192);
  await writePng(join(outDir, "icon-512.png"), 512);
  await writePng(join(appDir, "apple-icon.png"), 180);

  const sizes = [16, 32, 48];
  const ico = icoFromPngs(
    await Promise.all(sizes.map((size) => pngBuffer(size))),
    sizes,
  );
  writeFileSync(join(appDir, "favicon.ico"), ico);
  console.log(`Wrote favicon.ico (${ico.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
