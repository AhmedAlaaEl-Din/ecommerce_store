/**
 * Runs Lighthouse (default mobile preset: Moto G-class emulation, simulated
 * slow 4G, 4x CPU slowdown) against the production build on home, catalog and
 * a product page, using Playwright's Chromium. Each page is run RUNS times and
 * the median-performance run is reported, as Lighthouse recommends for
 * reducing variance.
 *
 * Expects a running production server (default http://localhost:3100).
 * Run: npm run lighthouse
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const RUNS = Number(process.env.LH_RUNS ?? 3);
// Optional CPU calibration (see Lighthouse docs/throttling.md). Default: preset (4x).
const CPU = process.env.LH_CPU;
const LABEL = process.env.LH_LABEL ?? (CPU ? `cpu${CPU}x` : "");
const OUT = join(process.cwd(), "evidence", "phase1", "lighthouse");
const pages = [
  { name: "home", path: "/" },
  { name: "catalog", path: "/products" },
  { name: "product", path: "/products/tide-wool-throw" },
];

mkdirSync(OUT, { recursive: true });
const chromePath = chromium.executablePath();
const cli = join(process.cwd(), "node_modules", "lighthouse", "cli", "index.js");

type Report = {
  categories: Record<string, { score: number | null }>;
  audits: Record<string, { displayValue?: string }>;
  environment: { benchmarkIndex: number };
};

const rows: Array<Record<string, string | number>> = [];
for (const p of pages) {
  const runs: Array<{ base: string; report: Report }> = [];
  for (let i = 1; i <= RUNS; i++) {
    const base = join(OUT, `${p.name}${LABEL ? `-${LABEL}` : ""}-run${i}`);
    execFileSync(
      process.execPath,
      [
        cli,
        `${BASE}${p.path}`,
        "--quiet",
        "--output=json",
        "--output=html",
        `--output-path=${base}`,
        "--only-categories=performance,accessibility,best-practices,seo",
        "--chrome-flags=--headless=new --no-first-run",
        ...(CPU ? [`--throttling.cpuSlowdownMultiplier=${CPU}`] : []),
      ],
      { env: { ...process.env, CHROME_PATH: chromePath }, stdio: "inherit" },
    );
    runs.push({ base, report: JSON.parse(readFileSync(`${base}.report.json`, "utf8")) });
  }
  const perf = (r: Report) => r.categories.performance?.score ?? 0;
  runs.sort((a, b) => perf(a.report) - perf(b.report));
  const median = runs[Math.floor(runs.length / 2)];
  const outName = `${p.name}${LABEL ? `-${LABEL}` : ""}`;
  copyFileSync(`${median.base}.report.json`, join(OUT, `${outName}.report.json`));
  copyFileSync(`${median.base}.report.html`, join(OUT, `${outName}.report.html`));
  const r = median.report;
  const score = (k: string) => Math.round((r.categories[k]?.score ?? 0) * 100);
  rows.push({
    page: `${p.name} (${p.path})`,
    performance: score("performance"),
    accessibility: score("accessibility"),
    "best-practices": score("best-practices"),
    seo: score("seo"),
    LCP: r.audits["largest-contentful-paint"]?.displayValue ?? "",
    TBT: r.audits["total-blocking-time"]?.displayValue ?? "",
    CLS: r.audits["cumulative-layout-shift"]?.displayValue ?? "",
    "perf runs": runs.map((x) => Math.round(perf(x.report) * 100)).join("/"),
    "CPU benchmark": Math.round(r.environment.benchmarkIndex),
  });
}
console.table(rows);
