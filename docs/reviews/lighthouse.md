# Lighthouse (step 14)

- Lighthouse 13.6.0 (`node_modules/lighthouse`, run by `npm run lighthouse`), Playwright's Chromium,
  headless, **mobile preset** (Moto G-class emulation, simulated slow 4G: 150 ms RTT / 1.6 Mbps,
  4× CPU slowdown), against the **production build** (`next build` + `next start`) on localhost.
- Each page was run 3 times; the run with the median performance score is reported (Lighthouse's own
  advice for reducing variance). Reports: `evidence/phase1/lighthouse/*.report.html` (not committed).

## Default mobile preset (4× CPU slowdown)

| Page | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS | Perf runs |
| ---- | ----------- | ------------- | -------------- | --- | --- | --- | --- | --------- |
| Home `/` | **70** | 100 | 100 | 100 | 3.3 s | 1,020 ms | 0 | 70 / 70 / 81 |
| Catalog `/products` | **74** | 100 | 100 | 100 | 3.5 s | 670 ms | 0 | 72 / 74 / 76 |
| Product `/products/tide-wool-throw` | **82** | 100 | 100 | 100 | 3.2 s | 440 ms | 0 | 80 / 82 / 83 |

## Calibrated for this machine (2× CPU slowdown)

| Page | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS | Perf runs |
| ---- | ----------- | ------------- | -------------- | --- | --- | --- | --- | --------- |
| Home `/` | **93** | 100 | 100 | 100 | 3.2 s | 90 ms | 0 | 76 / 93 / 95 |
| Catalog `/products` | **92** | 100 | 100 | 100 | 3.2 s | 100 ms | 0 | 91 / 92 / 93 |
| Product `/products/tide-wool-throw` | **91** | 100 | 100 | 100 | 3.1 s | 180 ms | 0 | 91 / 91 / 94 |

## Targets

- Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95: **met on all pages** (100 / 100 / 100).
- Performance ≥ 90: **missed with the default preset** (70–82), **met when the CPU throttle is calibrated**
  for this hardware (91–93).

## Why performance misses with the default preset

1. **The test machine is much slower than Lighthouse assumes.** Lighthouse reported a CPU
   `benchmarkIndex` of about 720–1480 (mostly ~730) on this laptop (Intel i7-8550U, often thermally
   throttled) and printed its own warning: *"The tested device appears to have a slower CPU than
   Lighthouse expects."* The 4× multiplier is calibrated for fast desktop CPUs; on a ~730 machine it
   emulates a phone roughly twice as slow as intended. Lighthouse's throttling docs recommend lowering the
   multiplier in this case, which is what the calibrated run does. The same page swings by up to 25 points
   between consecutive runs (e.g. home 66 → 92), which is CPU noise, not app behaviour.
2. **Total Blocking Time is the main penalty** and comes almost entirely from React/Next.js hydration
   (react-dom ≈ 72 KB and the Next runtime ≈ 46 KB gzip; app code is small). At 2× it drops to 90–180 ms.
3. **LCP ≈ 3.1–3.5 s is a simulation artefact of the JS critical path.** The *observed* LCP in the trace
   equals FCP (≈ 0.7–1.1 s). The simulator (Lantern) adds the download time of the framework scripts over
   simulated slow 4G before the LCP image paint. The LCP image is discoverable in HTML, eager and
   `fetchpriority="high"`, CLS is 0.

## What was changed to improve the scores

- `fetchPriority="high"` + `loading="eager"` on LCP images (replacing the deprecated `priority` prop);
  Lighthouse's LCP discovery check now passes.
- Zod was being bundled into the catalog client code via a shared constant; it probes `eval`, which the
  CSP blocked (Best Practices 96 → 100) and it added client JS. Constants moved to a zod-free module.
- Tried and reverted: `experimental.inlineCss` (no measurable gain, experimental).

## Next steps (Phase 4)

Measure on the Linux server / a real mid-range phone; consider React Server Component-only header search,
and a nonce-based CSP with `strict-dynamic` (needed anyway for hardening).
