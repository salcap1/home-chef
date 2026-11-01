/**
 * Generate PNG icons for the web app manifest (Android / installability).
 * Run: node --import tsx scripts/generate-pwa-icons.tsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";

import { ImageResponse } from "next/og";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

async function writeIcon(size: number, filename: string) {
  const response = new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          fontSize: Math.round(size * 0.42),
          fontWeight: 700,
          letterSpacing: "-0.06em",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        },
      },
      "HC",
    ),
    { width: size, height: size },
  );

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(join(outDir, filename), buffer);
  console.log(`Wrote ${filename} (${buffer.length} bytes)`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  await writeIcon(192, "icon-192.png");
  await writeIcon(512, "icon-512.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
