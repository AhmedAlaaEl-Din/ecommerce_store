# Lighthouse, Phase 2 (step 15)

- Lighthouse 13.6.0, Playwright's Chromium, headless, **default mobile preset** (simulated slow 4G and 4×
  CPU slowdown). **No custom CPU calibration.**
- Run against the production build (`next build` + `next start`) on localhost, with the mock payment
  provider.
- Each page ran 3 times and the median is reported (`npm run lighthouse`). Reports are in
  `evidence/phase2/lighthouse/` (not committed).
- The "CPU benchmark" column is Lighthouse's `benchmarkIndex` for the run. It matters a lot on this
  laptop (see below).

## Before and after (same preset, comparable CPU state ≈ 750)

| Page                                | Before: perf | After: perf | Before → after LCP | Before → after TBT | A11y / BP / SEO | Runs (after) | CPU benchmark (before / after) |
| ----------------------------------- | ------------ | ----------- | ------------------ | ------------------ | --------------- | ------------ | ------------------------------ |
| Home `/`                            | **67**       | **82**      | 3.4 s → 3.2 s      | 1,240 ms → 440 ms  | 100 / 100 / 100 | 81 / 82 / 91 | 767 / 758                      |
| Catalog `/products`                 | **75**       | **81**      | 3.4 s → 3.3 s      | 660 ms → 460 ms    | 100 / 100 / 100 | 77 / 81 / 84 | 746 / 754                      |
| Product `/products/tide-wool-throw` | **74**       | **79**      | 3.3 s → 3.2 s      | 760 ms → 550 ms    | 100 / 100 / 100 | 77 / 79 / 86 | 766 / 745                      |

Accessibility, Best Practices and SEO stay at 100 on all three pages. **Performance ≥ 90 is not reached
reliably on this laptop with the default preset.** Single runs do reach 91 (home, after).

## What was changed

1. **Fonts: one static display weight.**
   - Before, Fraunces loaded as the full variable font (37 KB, preloaded). Now only the weight the design
     uses (600) loads, at 18 KB, preloaded.
   - Headings moved from 560 to 600, a visually tiny change. The wordmark's italic is synthesised, as
     before.
   - With the fonts blocked entirely, the home page gained about 4 points, so font bytes compete with the
     critical path on simulated slow 4G.
2. **Less JavaScript at first load.** The mobile menu drawer (`MobileMenu`, with its focus trap) is now
   loaded on demand the first time the menu button is pressed, not hydrated on every page.
3. **Phase 2 code kept off the storefront.** Checkout, mock pay and order pages are separate routes, and
   their client code (form, poller) is not loaded on home, catalog or product pages.
4. **Server components remain the default.** The client components are the header (search toggle, cart
   badge, menu button), the toast and cart-count providers, the catalog controls, add-to-cart with its
   stepper, the cart view and the checkout form.

## Why 90 is not reached: what exactly limits it

- **The CPU of this machine.**
  - Lighthouse reports a `benchmarkIndex` of about 750 here while the laptop is thermally throttled. The
    same machine shows about 1,700 when cool.
  - Lighthouse's 4× slowdown is calibrated for a fast desktop (about 1,000–2,000+), so at 750 it emulates
    a phone roughly twice as slow as intended.
  - The same home page with no code change scored **91** at benchmark 1,708 and 67–82 at about 750. Lighthouse
    itself warns about this ("slower CPU than Lighthouse expects").
- **The fixed cost of React and Next.js on the main thread.**
  - At about 750, the React DOM chunk alone costs about 760 ms of scripting under the 4× slowdown, and the
    Next.js runtime about 185 ms. This JavaScript is needed on every page for client navigation and the
    interactive islands. App code is small.
  - Controlled experiment (same CPU state, about 760–786):

    | Variant          | Performance | Total blocking time | LCP   |
    | ---------------- | ----------- | ------------------- | ----- |
    | Normal home page | 88          | 310 ms              | 3.0 s |
    | All JS blocked   | **99**      | 40 ms               | 2.0 s |

    Everything left between "after" and 90 is framework JavaScript.
- **LCP is a simulation artefact of the JS critical path.**
  - The LCP element is a 1 KB SVG in the hero, discoverable in the HTML, `fetchpriority="high"` and eager.
    Its observed render happens within about 0.5 s.
  - Lighthouse's simulator (Lantern) places the framework scripts in the critical path over slow 4G,
    which produces the 3.0–3.3 s figure. Blocking JS brings it to 2.0 s.

## What would close the gap (not done in Phase 2)

- **Measure on the Linux server and a real mid-range phone** in Phase 4. This removes the throttled-laptop
  CPU from the result.
- **Move the remaining interactivity out of React.** For example, a header whose search toggle and menu
  button are small vanilla scripts. This trades maintainability for about 100–200 ms of blocking time.
- **Use a nonce-based CSP with `strict-dynamic`** (planned for Phase 4 hardening anyway). This would let
  scripts be preloaded more aggressively.
