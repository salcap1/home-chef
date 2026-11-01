#!/usr/bin/env node
/**
 * Writes .github/badges/coverage.svg from coverage/coverage-summary.json
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const summaryPath = path.join(root, "coverage", "coverage-summary.json");
const outPath = path.join(root, ".github", "badges", "coverage.svg");

if (!fs.existsSync(summaryPath)) {
  console.error("Missing coverage/coverage-summary.json — run vitest with coverage first.");
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const pct = Number(summary.total?.lines?.pct ?? 0);
const label = Number.isFinite(pct) ? `${pct.toFixed(0)}%` : "unknown";

function colorFor(p) {
  if (p >= 80) return "#4c1";
  if (p >= 60) return "#a3c";
  if (p >= 40) return "#dfb317";
  return "#e05d44";
}

const color = colorFor(pct);
const valueWidth = 54;
const labelWidth = 70;
const width = labelWidth + valueWidth;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="coverage: ${label}">
  <title>coverage: ${label}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text x="${(labelWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(labelWidth - 10) * 10}">coverage</text>
    <text x="${(labelWidth / 2) * 10}" y="140" transform="scale(.1)" textLength="${(labelWidth - 10) * 10}">coverage</text>
    <text x="${(labelWidth + valueWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(valueWidth - 10) * 10}">${label}</text>
    <text x="${(labelWidth + valueWidth / 2) * 10}" y="140" transform="scale(.1)" textLength="${(valueWidth - 10) * 10}">${label}</text>
  </g>
</svg>
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, svg);
console.log(`Wrote ${path.relative(root, outPath)} (${label})`);
