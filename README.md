# Nile Goods: demo store (Phase 1)

A portfolio demo of a small home-goods shop: storefront, catalog and a server-side cart.
**There are no real payments, orders or accounts.** The brand, products, prices and people are
invented, and every product image is a hand-made SVG in this repo.

Design direction: **warm, calm, editorial, crafted** (see [docs/DESIGN.md](docs/DESIGN.md)).

## Screenshots

| Product page: added to cart (desktop)                                                                | Cart (mobile, 390 px)                                                                  |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ![Product page with the "Added to cart" toast and cart badge](docs/images/product-added-desktop.png) | ![Cart with three items and the order summary on a phone](docs/images/cart-mobile.png) |

## What's in Phase 1

- **Home**: hero, category tiles, featured row, on-sale row, trust strip.
- **Catalog** (`/products`): filter by category, search by name, sort (newest, price ↑, price ↓) and
  pagination (12 per page). All state lives in the URL. On mobile, filters open in a bottom sheet. Includes
  a result count, skeleton loading and a "no results" state with reset.
- **Product pages** (`/products/[slug]`): breadcrumbs, sale pricing, stock badges, a quantity stepper,
  add to cart with a loading state, toast and animated badge, and related products. Unknown or inactive
  products return a real HTTP 404.
- **Cart** (`/cart`): stored on the server and keyed by a random id in an httpOnly, SameSite=Lax,
  30-day cookie. Quantities update instantly, items can be removed with undo, there is a sticky order
  summary, and the checkout button is disabled ("Checkout coming in Phase 2").
- **Quality**: keyboard-friendly (skip link, focus rings, focus-trapped mobile menu), `prefers-reduced-motion`,
  44 px touch targets, axe-clean, security headers and a strict input-validation boundary (zod; prices are
  always read from the database).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Prisma 7 + SQLite
(better-sqlite3 driver adapter; schema kept Postgres-friendly) · zod 4 · Vitest 5 · Playwright 1.65 +
@axe-core/playwright · ESLint 9 + Prettier 3 · Fonts: Fraunces + DM Sans (SIL OFL, self-hosted by
`next/font`). Exact versions: [docs/PHASE1_REPORT.md](docs/PHASE1_REPORT.md#2-versions).

## Design highlights

- Linen background, river-green primary and terracotta accent. Every text pair meets WCAG AA; the ratios
  are listed in DESIGN.md.
- Serif display type (Fraunces) over a clean sans (DM Sans) on a 12–48 px scale. Headings use
  `text-wrap: balance`.
- 24 product illustrations generated from one script (`npm run illustrations`) with a shared frame,
  palette and light direction, so the catalog looks curated.
- Subtle motion (150–250 ms, one easing curve): cart badge bump, toast slide-in, drawer and sheet.
  All of it is turned off under reduced motion.

## Run it on Windows

Requirements: Node.js 22+ (developed on Node 26) and Git. Everything runs on `localhost`; nothing calls
external services.

```powershell
git clone <your-repo-url> nile-goods
cd nile-goods
git switch phase-1
npm install                      # also runs `prisma generate`
copy .env.example .env
npx playwright install chromium  # only needed for e2e tests, frames and Lighthouse
npm run db:migrate               # creates prisma/dev.db
npm run db:seed                  # 4 categories, 24 products (safe to re-run)
npm run dev                      # http://localhost:3000
```

npm 11 may report that some packages have install scripts. The required ones (`better-sqlite3`,
`prisma`, `@prisma/engines`, `esbuild`) are already approved in `package.json` under `allowScripts`.

## Scripts

| Command                                                       | What it does                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run dev` / `npm run build` / `npm start`                 | Dev server, production build, production server (localhost only)                          |
| `npm run verify`                                              | Lint → typecheck → unit → integration → build → e2e → axe, in that order                  |
| `npm run lint` / `npm run typecheck`                          | ESLint (zero warnings) / `tsc --noEmit`                                                   |
| `npm run test:unit` / `npm run test:integration`              | Vitest; integration uses its own `prisma/test.db`                                         |
| `npm run test:e2e` / `npm run test:axe`                       | Playwright against `next build` + `next start` on port 3100 with a fresh `prisma/e2e.db`  |
| `npm run db:migrate` / `npm run db:seed` / `npm run db:reset` | Database migrations, idempotent seed, full reset                                          |
| `npm run db:prune-carts`                                      | Delete carts idle for over 30 days                                                        |
| `npm run review:shots`                                        | Review screenshots of every page at 390×844 and 1440×900 (needs a running server on 3100) |
| `npm run frames`                                              | Demo video frames + storyboard into `evidence/phase1/` (starts its own server)            |
| `npm run lighthouse`                                          | Lighthouse mobile preset, median of 3 runs (needs a running server on 3100)               |
| `npm run illustrations`                                       | Regenerate the product SVGs                                                               |

To start the production server used by the screenshot and Lighthouse scripts:
`npx tsx scripts/e2e-server.ts` (port 3100, fresh `prisma/e2e.db`).

## Project layout

```
prisma/            schema, migrations, seed data
public/products/   24 generated SVG illustrations
scripts/           illustration generator, e2e server, frames, review shots, Lighthouse
src/app/           routes (home, products, product, cart, info), server actions, error/404 pages
src/components/    ui kit, layout, catalog, product and cart components
src/lib/           data access, cart service, money/pricing maths, zod schemas
tests/             unit, integration (Vitest) and e2e + axe (Playwright)
docs/              design system, reports, reviews, test guide
```

## Roadmap

- **Phase 2**: checkout with Stripe in test mode (server-side totals, webhooks, order records).
- **Phase 3**: admin (products, stock, orders) with authentication.
- **Phase 4**: Docker + nginx + Postgres on Linux (HTTPS, `COOKIE_SECURE=true`, rate limiting,
  nonce-based CSP).

## Licence

MIT. See [LICENSE](LICENSE). Demo content (brand, products, illustrations) is invented for this project.
