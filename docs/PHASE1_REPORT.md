# Phase 1 report: Nile Goods storefront, catalog and cart

Branch `phase-1` (local only; nothing pushed or merged). Date: 2026-11-21.

## 1. Summary

**Design direction: warm, calm, editorial, crafted:** a linen-toned home-goods shop with a river-green
primary colour, a terracotta accent, Fraunces headings over DM Sans, and 24 hand-made flat SVG product
illustrations in one consistent style.

What was built:

- **Storefront**: sticky header with a scroll shadow, text wordmark, category nav, search and an animated
  cart badge. On mobile there is an accessible drawer menu (native `<dialog>`, focus trap, Esc closes,
  focus returns to the menu button). The footer has Shop / Help / About columns and the line "Demo store,
  portfolio project, no real orders.". There is also a branded 404 and friendly error pages
  (`error.tsx` + `global-error.tsx`).
- **Home**: hero (headline, value line, primary CTA, illustration collage), category tiles, Featured row
  (no sale or out-of-stock items), trust strip (marked as demo copy in the footer), On-sale row.
- **Catalog `/products`**: category filter, name search (debounced), sort (newest / price ↑ / price ↓),
  12 per page. All state is in the URL and invalid values fall back to defaults. It has a result count,
  skeleton cards while loading, a no-results state with reset and category links, desktop chips and sort
  select, and a mobile bottom-sheet filter.
- **Product `/products/[slug]`**: breadcrumbs, large image, price with sale strike-through and "you save",
  stock badge, quantity stepper, full-width Add to cart on mobile, benefits, details, "You may also like"
  (same category, in stock). Open Graph and Twitter tags. Unknown, inactive or malformed slugs return a
  real HTTP 404.
- **Cart `/cart`**:
  - Server-side cart (SQLite via Prisma), keyed by a random UUID in an `ng_cart` cookie (httpOnly,
    SameSite=Lax, 30 days, sliding).
  - Server actions with zod validation; only `{productId, quantity}` cross the boundary, and prices,
    stock and active state are always read from the database.
  - Quantity updates are optimistic, and the latest request wins.
  - Removing an item offers an Undo toast.
  - The order summary (subtotal, sale savings, shipping rule, total, free-shipping progress) is sticky on
    desktop.
  - Checkout is disabled: "Checkout coming in Phase 2".
  - Quantities are re-clamped to current stock, and sold-out lines are flagged and excluded from totals.
- **Data**: Prisma schema kept Postgres-friendly (string ids, integer cents, no SQLite-only types).
  Idempotent seed with 4 categories and 24 products: 2 out of stock, 3 with stock of 1–2 and 4 on sale.
  All money is integer cents, formatted with `Intl.NumberFormat("en-US", USD)`.
- **Hardening**:
  - Security headers: CSP, nosniff, frame-deny, Referrer-Policy and Permissions-Policy; `X-Powered-By`
    is off.
  - The cookie's `Secure` flag is config-driven.
  - Search is safe against LIKE wildcards.
  - Idle carts are pruned (`npm run db:prune-carts`).
- **Tooling**:
  - `npm run verify` runs lint, typecheck, unit, integration, build, E2E and axe.
  - The illustration generator, review-screenshot script, demo-frame recorder and Lighthouse runner are
    all in `scripts/`.

## 2. Versions

Resolved at install time (2026-11-21) with `@latest`, except where noted.

| Tool / package                                               | Version                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Node.js / npm                                                | 26.13.1 / 11.20.0                                                        |
| Next.js (create-next-app@latest)                             | 16.4.6 (Turbopack)                                                       |
| React / React DOM                                            | 19.3.0 / 19.3.0                                                          |
| TypeScript                                                   | 5.9.3 (strict)                                                           |
| Tailwind CSS (+ @tailwindcss/turbopack)                      | 4.3.3                                                                    |
| Prisma CLI / @prisma/client / @prisma/adapter-better-sqlite3 | 7.10.1 / 7.10.1 / 7.10.1 (better-sqlite3 12.11.1, SQLite 3.53.2)         |
| zod                                                          | 4.6.7                                                                    |
| Vitest                                                       | 5.1.1                                                                    |
| @playwright/test (Chromium)                                  | 1.65.1                                                                   |
| @axe-core/playwright                                         | 4.14.0                                                                   |
| Lighthouse                                                   | 13.6.0                                                                   |
| ESLint / eslint-config-next / eslint-config-prettier         | 9.39.5 / 16.4.6 / 10.1.8                                                 |
| Prettier / prettier-plugin-tailwindcss                       | 3.10.1 / 0.8.1                                                           |
| tsx / dotenv / server-only                                   | 4.23.15 / 18.0.10 / 0.0.1                                                |
| @types/node / @types/react / @types/react-dom                | 26.6.6 / 19.3.0 / 19.3.0                                                 |
| Fonts                                                        | Fraunces, DM Sans (SIL OFL) via `next/font/google`, self-hosted at build |

Notes:

- `prisma@latest` currently points to an 8.0 **release candidate** (`8.0.0-rc.34`). The latest _stable_
  release, 7.10.1, was used to match `@prisma/client@latest`.
- ESLint 9 is what `create-next-app` and `eslint-config-next` install. npm prints a deprecation notice
  for 9.x; it was kept because `eslint-config-next` targets it.
- Next.js 16's scaffold enables Cache Components. It was **turned off** on purpose: with it, a request-time
  `notFound()` streams after a 200 shell, which would break the "real 404" requirement. The previous
  rendering model is still supported in 16.x.

## 3. Results

### `npm run verify` (final run, step 17)

| Stage                                                             | Result                                    |
| ----------------------------------------------------------------- | ----------------------------------------- |
| Lint (`eslint --max-warnings=0`)                                  | pass, 0 problems                          |
| Typecheck (`tsc --noEmit`)                                        | pass                                      |
| Unit (Vitest)                                                     | **30 / 30 passed** (3 files)              |
| Integration (Vitest, separate `prisma/test.db`)                   | **32 / 32 passed** (2 files)              |
| Build (`next build`)                                              | pass; all routes dynamic (ƒ)              |
| E2E (Playwright vs `next start`, fresh `prisma/e2e.db`)           | **18 / 18 passed** (13 desktop, 5 mobile) |
| Axe (@axe-core/playwright, WCAG 2.0/2.1/2.2 A+AA + best practice) | **13 / 13 passed**, 0 serious/critical    |

What the suites cover:

- **Unit**: money formatting, sale price display (including `<Price>` SSR markup), cart maths, shipping
  rule, quantity clamping, zod schemas (no coercion, id format, ignores client price), URL helpers,
  pagination window.
- **Integration**:
  - Cart add, increase, update, remove and undo.
  - Stock limit, unknown product, inactive product and out-of-stock product.
  - Database price trust, plus re-clamping and sold-out lines.
  - Idle-cart pruning.
  - Seed idempotency and data rules.
  - Search, filter, sort, paging and wildcard safety.
- **E2E**:
  - The full journey: browse, paginate, filter, search, sort, product, add (toast and badge, no
    reload), cart, change quantity, reload persists, remove and undo, empty state.
  - Cookie flags and 30-day expiry, and the badge on every page.
  - Stock cap, a fresh context gets an empty cart, and the cart survives a browser restart.
  - Out-of-stock button disabled, real 404s, no-results reset, garbage query params, OG/meta tags.
  - Skip link, keyboard-only add-to-cart, security headers.
  - Mobile: menu with keyboard and focus trap, menu navigation, filter bottom sheet, phone add to cart,
    no horizontal scroll, 44 px targets.
- **Axe**: 11 pages/states, plus the cart with a toast open and the mobile menu and filter sheet open.
  The only issue ever found was `label-content-name-mismatch` on the wordmark, which is fixed.

### Lighthouse (production build, mobile preset, median of 3 runs)

| Page    | Perf (default 4× CPU) | Perf (calibrated 2× CPU) | Accessibility | Best Practices | SEO |
| ------- | --------------------- | ------------------------ | ------------- | -------------- | --- |
| Home    | 70                    | 93                       | 100           | 100            | 100 |
| Catalog | 74                    | 92                       | 100           | 100            | 100 |
| Product | 82                    | 91                       | 100           | 100            | 100 |

- **Accessibility, Best Practices and SEO targets: met** (100 everywhere).
- **Performance ≥ 90: missed with the default preset; met when calibrated.** Lighthouse measured this
  laptop's CPU at a `benchmarkIndex` of about 730 and warned that "the tested device appears to have a
  slower CPU than Lighthouse expects". The 4× multiplier therefore emulates a phone about twice as slow
  as intended, and consecutive runs of the same page vary by up to 25 points. Blocking time is
  React/Next hydration (react-dom about 72 KB plus the Next runtime about 46 KB gzip). The observed LCP
  equals FCP (about 0.7–1.1 s); the simulated LCP of about 3.2 s comes from framework script downloads
  over simulated slow 4G.
- Improvements made: `fetchpriority=high` on LCP images, and zod kept out of the client bundle (which
  also fixed a CSP `eval` violation: Best Practices went from 96 to 100).
- Full details: `docs/reviews/lighthouse.md`. The HTML reports are in `evidence/phase1/lighthouse/` and
  in the handoff folder.

## 4. Reviews

### 4.1 Visual self-review loop (section 5.4)

Screenshots of 15 pages and states were taken at 390×844 and 1440×900 (28 files) with
`npm run review:shots`. I checked them myself over 2 rounds.

Round 1 found and fixed:

- On the mobile cart, the line image stretched to the row height and the remove icon wrapped onto its own
  row. Fixed by aligning the image to the top and putting the stepper and bin together.
- A search kept the "All products" heading. It now says `Results for "…"`.
- On mobile, the "View all" links squeezed the home section titles. The link now sits below the title.
- Inside the flex wordmark, the space in "Nile Goods" collapsed. The text now sits in one span.

Round 2 was clean.

Issues found and fixed earlier, while building:

- Featured and sale rows showed the same products. Featured now excludes sale items.
- The mobile footer was very long. It now uses two columns.
- `text-wrap: balance` broke card titles into odd lines. Cards now use `pretty`.
- The product breadcrumb read "Home › Home". It is now consistent.
- The illustration contact sheet showed stray stripes from duplicate SVG clip ids. Ids are now unique per
  file.
- The cushion illustration looked like an envelope. Redrawn.

### 4.2 Design review subagent (checkpoint, step 12)

10 findings plus 4 extras: 8 fixed (2 of them partly), 2 rejected, 1 left as polish. Full table:
`docs/reviews/design-review.md`.

Fixed:

- In Fraunces, the "4"s in "$44.00" read as struck through. Large prices now use DM Sans.
- Breadcrumbs are consistent, and the "Home" category is now "Home & Living".
- There were two search boxes on the catalog. The header one is hidden there.
- The search heading, intro and empty state now help; the empty state links to the categories.
- "Explore the kitchen" is now an outlined button.
- The truncated mobile search placeholder is fixed.
- Out-of-stock cards are muted and no longer appear in recommendations.
- The info page is aligned to the grid.
- The scrolled header was see-through; it is now more opaque.
- A sale-savings line was added to the order summary.

Rejected, with reasons:

- **Mobile remove icon:** it is already a 44×44 button with an aria-label, and Undo is available.
- **Disabled checkout button:** the brief requires it.
- **Sorting out-of-stock items last:** it would break the "Newest" sort.
- **Pagination arrows under 44 px:** they are 44 px.

### 4.3 Code and security review subagent (checkpoint, step 13)

No critical issues. The reviewer confirmed:

- The price trust boundary holds.
- There is no raw SQL and no `dangerouslySetInnerHTML`.
- Errors reach the client only as friendly messages.
- Git history contains no secrets or database files.

Of 23 findings, 19 were fixed, 1 partly fixed, 1 rejected, 1 documented and 1 left to you. Full table:
`docs/reviews/code-security-review.md`.

Fixed:

- Security headers.
- The `Secure` cookie flag no longer trusts a client header.
- Layout and DB failures are handled, and `global-error.tsx` was added.
- Re-clamping to current stock, with sold-out lines.
- Stricter zod: no coercion, and a tighter id format.
- The cart id defaults to a UUID.
- LIKE wildcards: a search for `%` returned every product. Confirmed and fixed.
- Currency allowlist.
- `noindex` on search pages.
- The add-to-cart race (now a single transaction).
- `error.digest` is logged.
- The cookie expiry slides on every change.
- The E2E port is validated before use.
- Dead code removed.
- `updatedAt` is touched on every change, plus a prune command.

Not fixed:

- **Partly:** per-IP rate limiting is deferred to Phase 4 (proxy level; Phase 1 runs on localhost only).
- **Rejected:** removing the unused `Input` component. It is part of the required component kit.
- **Documented:** undo merges quantities if the item was re-added meanwhile.
- **Left to you:** `.claude/settings.json` (see section 6).

A regression I found while doing this: wrapping the layout's DB calls in try/catch swallowed Next's
internal "dynamic usage" signal. That made `/info` and the 404 page prerender statically with a cart badge
of 0. It is fixed with `unstable_rethrow`, and an E2E check now asserts the badge on `/info` and on a 404.

## 5. Demo frames

- `npm run frames` starts its own production server on a freshly reseeded database (`prisma/e2e.db`, carts
  cleared). It records page-only screenshots (no browser chrome) and writes `storyboard.json`.
- **Desktop: 54 frames** (1280×720) and **mobile: 64 frames** (390×844), named `0001.png`…
- Story: home hero → scroll to featured → category → search → sort → product page → add to cart →
  second add → cart → change quantity → reload persists → remove and undo → empty cart → out-of-stock
  product → 404.
- Animations (toast, badge bump, quantity change, remove) are captured as 4–6 frames about 60 ms apart.
  There are before and after frames around each action.
- The storyboard gives each frame its file, set, step, caption and a suggested duration in seconds (about
  45 s per set).
- Location: `evidence/phase1/{desktop,mobile}/`, `evidence/phase1/storyboard.json` and
  `evidence/phase1/review/`, all copied to **`E:\handoff\ecommerce_phase1\`** (plus `lighthouse/`).

## 6. Known issues, blocked, needed permissions

**Known issues and limitations:**

- Lighthouse Performance is below 90 with the default mobile preset on this hardware (section 3).
- The CSP needs `'unsafe-inline'` for scripts. A nonce-based CSP is planned for Phase 4.
- There is no rate limiting on cart actions (Phase 4, at the proxy).
- Stock is not reserved by carts; Phase 2 checkout must re-validate on the server.
- Search matches names only, case-insensitively. Postgres in Phase 4 needs `mode: "insensitive"` on
  `contains`.
- Light theme only.
- Polish left from the design review:
  - Product pages don't highlight their category in the header nav.
  - The stepper (44 px) is shorter than the Add to cart button (52 px) on desktop.
- `AGENTS.md` (written by `create-next-app`, Next.js agent rules) is kept as generated.

**For you to review:** `.claude/settings.json` (your Claude Code permissions). I did not change it.

- It denies `Read(./.env)`, but it also allows broad `Bash(cat *)`, `Bash(node *)` and `Bash(npx *)`,
  which could read `.env` anyway.
- `Bash(rm -rf node_modules*)` is a prefix rule, so it matches more than `node_modules`.

**Blocked:** nothing.

**Needed permissions:** none were missing.

Notes:

- npm 11 requires install scripts to be approved. `better-sqlite3`, `prisma`, `@prisma/engines` and
  `esbuild` were approved with `npm install-scripts approve` and are recorded in `package.json`
  `allowScripts`.
- `prisma init` also wrote third-party "agent skill" folders (`.claude/skills`, `.agents`, `.windsurf`,
  `skills-lock.json`) into the project. I deleted them, because they would have been loaded as
  instructions in later sessions.

## 7. Privacy check

_Filled in at step 17 (below)._

## 8. Commits

_Filled in at step 17 (below)._
