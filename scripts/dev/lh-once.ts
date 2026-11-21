// Dev helper: one Lighthouse performance run with extra CLI flags, prints the key numbers.
// Usage: npx tsx scripts/dev/lh-once.ts <path> [extra lighthouse flags...]
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [path = "/", ...extra] = process.argv.slice(2);
const out = join(process.cwd(), "evidence", "dev", "lh");
mkdirSync(out, { recursive: true });
const base = join(out, "once");
execFileSync(
  process.execPath,
  [
    join(process.cwd(), "node_modules", "lighthouse", "cli", "index.js"),
    `http://localhost:3100${path}`,
    "--quiet",
    "--output=json",
    `--output-path=${base}.json`,
    "--only-categories=performance",
    "--chrome-flags=--headless=new --no-first-run",
    ...extra,
  ],
  { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, stdio: "inherit" },
);
const r = JSON.parse(readFileSync(`${base}.json`, "utf8"));
const a = r.audits;
const groups = a["mainthread-work-breakdown"].details.items.map(
  (i: { group: string; duration: number }) => `${i.group}:${Math.round(i.duration)}`,
);
const tasks = a["long-tasks"].details.items
  .slice(0, 5)
  .map(
    (i: { url: string; startTime: number; duration: number }) =>
      `${i.url.replace(/.*\/_next\//, "")}@${Math.round(i.startTime)}=${Math.round(i.duration)}`,
  );
console.log(
  JSON.stringify({
    perf: Math.round(r.categories.performance.score * 100),
    lcp: a["largest-contentful-paint"].displayValue,
    tbt: a["total-blocking-time"].displayValue,
    bench: r.environment.benchmarkIndex,
    groups,
    tasks,
  }),
);
