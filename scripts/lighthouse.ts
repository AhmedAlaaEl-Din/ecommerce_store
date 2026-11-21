/**
 * Runs Lighthouse (mobile preset, the default) against the production build on
 * home, catalog and a product page, using Playwright's Chromium.
 * Expects a running production server (default http://localhost:3100).
 *
 * Run: npm run lighthouse
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = join(process.cwd(), "evidence", "phase1", "lighthouse");
const pages = [
  { name: "home", path: "/" },
  { name: "catalog", path: "/products" },
  { name: "product", path: "/products/tide-wool-throw" },
];

mkdirSync(OUT, { recursive: true });
const chromePath = chromium.executablePath();
const cli = join(process.cwd(), "node_modules", "lighthouse", "cli", "index.js");

const rows: Array<Record<string, string | number>> = [];
for (const p of pages) {
  execFileSync(
    process.execPath,
    [
      cli,
      `${BASE}${p.path}`,
      "--quiet",
      "--output=json",
      "--output=html",
      `--output-path=${join(OUT, p.name)}`,
      "--only-categories=performance,accessibility,best-practices,seo",
      "--chrome-flags=--headless=new --no-first-run",
    ],
    { env: { ...process.env, CHROME_PATH: chromePath }, stdio: "inherit" },
  );
  const report = JSON.parse(readFileSync(join(OUT, `${p.name}.report.json`), "utf8"));
  const score = (k: string) => Math.round((report.categories[k]?.score ?? 0) * 100);
  rows.push({
    page: `${p.name} (${p.path})`,
    performance: score("performance"),
    accessibility: score("accessibility"),
    "best-practices": score("best-practices"),
    seo: score("seo"),
    LCP: report.audits["largest-contentful-paint"]?.displayValue ?? "",
    CLS: report.audits["cumulative-layout-shift"]?.displayValue ?? "",
    TBT: report.audits["total-blocking-time"]?.displayValue ?? "",
  });
}
console.table(rows);
