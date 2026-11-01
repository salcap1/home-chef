#!/usr/bin/env node
/**
 * Print coverage/coverage-summary.json as markdown (CI job summary).
 */
import fs from "node:fs";
import path from "node:path";

const summaryPath = path.join(process.cwd(), "coverage", "coverage-summary.json");
if (!fs.existsSync(summaryPath)) {
  const msg = "No coverage-summary.json found\n";
  process.stdout.write(msg);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg);
  }
  process.exit(0);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const t = summary.total;
const line = (label, m) => `| ${label} | ${m.pct}% | ${m.covered}/${m.total} |`;
const md = [
  "## Coverage",
  "",
  "| Type | % | Covered/Total |",
  "| --- | --- | --- |",
  line("Statements", t.statements),
  line("Branches", t.branches),
  line("Functions", t.functions),
  line("Lines", t.lines),
  "",
].join("\n");

process.stdout.write(md);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
