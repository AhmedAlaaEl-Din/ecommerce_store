# Unattended task: E-commerce store, Phase 1 (storefront + catalog + cart)

You are working alone while I am away. Work in E:\ecommerce_store on my personal Windows 11 laptop. Make all decisions yourself using the rules below. Do not stop to ask questions. If something blocks you, write it in docs/PHASE1_REPORT.md under "Blocked" and continue with the rest.

## 0. Resume rule (read this first, every time)
This task may be interrupted by usage limits and resumed later, possibly in a new session.
- Before you do anything else, check whether docs/PROGRESS.md exists.
  - If it exists, read it, check `git log` and `git status`, and continue from the first unchecked item. Do not redo finished work.
  - If it doesn't exist, create it from the checklist in section 9.
- After each item in section 9 is finished, tick it in docs/PROGRESS.md, add one line of notes (what was done, anything to watch), and make a local commit. That way, at most one item of work is lost if you are cut off.
- If a command needs a permission you do not have, do not wait. Log the exact command under "Needed permissions" in PROGRESS.md, find another way or skip it, and continue.

## 1. Hard rules (never break these)
1. Never run git push, never merge, and never create remote repos or PRs. Local commits on the branch `phase-1` only.
2. Never call live or paid services. No Stripe, no cloud databases, no external APIs, no analytics, no email, no CDNs at runtime. Everything runs on localhost. Downloading npm packages, Playwright's Chromium and fonts at build time is allowed.
3. Demo data only. Invent the brand ("Nile Goods"), the products, the prices and the people. Use no real company, person, logo or trademark. Use no downloaded stock photos. Make all product images yourself as local SVG files.
4. No secrets in git. Use .env.example with placeholder values, and add .env* (except .env.example) to .gitignore.
5. No port-forwarding and no tunnels. Dev servers listen on localhost only.
6. Put no work-employer material anywhere in the project.
7. Use the latest stable versions available at install time. Do not pin versions from memory. Record the versions you used in the report.
8. Never run destructive commands outside E:\ecommerce_store. The only other folder you may write to is E:\handoff\ecommerce_phase1.

## 2. Stack
- Next.js (App Router) + TypeScript (strict) + Tailwind CSS, created with the current create-next-app.
- Prisma ORM + SQLite (`prisma/dev.db`, git-ignored). Keep the schema Postgres-friendly, because Phase 4 moves to Postgres.
- zod for validation. Vitest for unit and integration tests. Playwright (Chromium) for end-to-end tests, visual checks and demo frames.
- ESLint + Prettier. npm. Fonts through next/font (self-hosted at build, no runtime CDN), open-licence fonts only.
- If a package install fails because of the network, log the exact error and continue with what works.

## 3. Data model
- Category: id, slug (unique), name, description, accentColor.
- Product: id, slug (unique), name, shortDescription, description, priceCents (integer), compareAtCents (nullable, for "sale" display), currency "USD", stock (integer), imagePath, categoryId, isActive, isFeatured, createdAt.
- Cart: id, createdAt, updatedAt.  CartItem: id, cartId, productId, quantity, unique on (cartId, productId).
- Store money as integer cents only, never floats.

## 4. Seed (npm run db:seed, idempotent)
- 4 invented categories (home, kitchen, stationery, bags) and 24 invented products with believable names and short copy.
- At least 2 products out of stock, 2 with stock of 1 or 2, and 4 on sale (compareAtCents set).
- Product images: hand-made SVG illustrations in public/products/. Draw a simple, stylish flat illustration of the object on a soft background in the category's palette. Use no text inside the image, and keep the style consistent across all 24 so the catalog looks curated, not like placeholders.

## 5. UI/UX design (this matters as much as the code)
The goal: a visitor or client should think "this looks like a real, well-made shop" in the first 5 seconds.

### 5.1 Design direction (decide and write it down first)
Before building pages, write docs/DESIGN.md with:
- A design direction in 3 to 5 words, for example "calm, warm, editorial, modern". Pick one that fits a home-goods brand. Avoid the generic default look (plain white page, default blue buttons, system font, everything centred).
- Design tokens, implemented as CSS variables and the Tailwind theme:
  - Colours: background, surface, text, muted text, border, primary, primary hover, accent, success, warning, danger. Check that text and background pairs meet WCAG AA contrast (4.5:1 for body text) and list the ratios.
  - Typography: one display font for headings and one text font for body, with a clear type scale (for example 12, 14, 16, 18, 24, 32, 48) and line heights.
  - Spacing on a 4 px or 8 px scale, border radius, shadows (2 to 3 levels, subtle), and motion (durations of 150 to 250 ms, one easing curve).
- A component list: Button (primary, secondary, ghost; sizes; loading and disabled states), Input, Select, Badge (Sale, Low stock, Out of stock), ProductCard, Price (with sale strike-through), QuantityStepper, Skeleton, Toast, EmptyState, Breadcrumbs, Pagination.

### 5.2 Page quality
- Header: sticky, with a subtle shadow on scroll, logo wordmark (text only, invented), category nav, search and a cart button with an animated count badge. On mobile, nav collapses into an accessible menu (focus trapped, Esc closes).
- Home: a strong hero (headline, one-line value statement, primary CTA, illustration), category tiles, a "Featured" row, a "On sale" row and a short trust strip (free shipping over $50, 30-day returns, secure checkout; marked as demo copy in the footer).
- Catalog: a clean grid (2 columns on mobile, 3 on tablet, 4 on desktop), a filter and sort bar that stays usable on mobile (filters in a bottom sheet or drawer), a result count, a "no results" state with a reset button, and skeleton cards while loading.
- Product page: breadcrumbs, a large image, name, price (with sale), stock badge, a quantity stepper, a full-width Add to cart on mobile, short benefits list and a "You may also like" row from the same category.
- Add to cart feedback: the button shows a loading state, then a toast "Added to cart" with a "View cart" link, and the header badge animates. No full page reload.
- Cart: clear line items, a quantity stepper with instant subtotal update, remove with an undo toast, an order-summary card (sticky on desktop), and a friendly empty state with a link back to shopping.
- 404 page in the same style, with a link home.
- Footer: columns (Shop, Help, About), and the line "Demo store, portfolio project, no real orders."

### 5.3 UX rules
- Every action gives feedback within 100 ms (pressed, loading or done).
- Never show raw errors. Use friendly messages and keep the user's input.
- Respect prefers-reduced-motion. Keep motion subtle and purposeful.
- Keyboard: everything reachable with Tab, visible focus rings in the brand colour, logical order, skip-to-content link.
- Touch targets at least 44x44 px on mobile. No horizontal scroll at 360 px wide.
- Images have width and height set (no layout shift) and meaningful alt text.
- Page titles and meta descriptions on every page, and Open Graph tags on product pages.

### 5.4 Visual self-review loop (do this, do not skip)
After the pages are built, take Playwright screenshots of every page at 390x844 and 1440x900 into evidence/phase1/review/. Then open and look at each screenshot yourself and check it against this list:
- Alignment and consistent spacing; nothing touching the edges; a clear visual hierarchy (one obvious primary action per screen).
- Text is readable, no orphaned single words in headings where avoidable, no overflow or clipping.
- Colours match the tokens; no leftover default styles.
- Mobile looks designed, not just squeezed.
Fix what you find, re-shoot, and repeat until it passes (at most 3 rounds). Write the issues found and fixed under "Design review" in the report.

### 5.5 Quality targets
Run Lighthouse (via npx, on the production build, mobile preset) on home, catalog and product pages. Targets: Performance 90 or higher, Accessibility 95 or higher, Best Practices 95 or higher, SEO 95 or higher. Put the scores in the report. If a target is missed, explain why.

## 6. Functionality
1. Catalog /products: filter by category, search by name, sort (newest, price low to high, price high to low), and pagination of 12 per page. All state lives in the URL query string.
2. Product page /products/[slug]: unknown or inactive slugs return a real 404.
3. Cart:
   - The cart is stored on the server, keyed by an httpOnly, SameSite=Lax, 30-day cookie holding a random cart id. No user accounts yet.
   - Use server actions or route handlers. Validate all input with zod on the server. Always read the price from the database; never trust the client.
   - Adding an item already in the cart increases its quantity. Quantity stays between 1 and stock. Remove deletes the line. Undo restores it.
   - The checkout button is disabled with the label "Checkout coming in Phase 2".
   - The cart survives a reload and a browser restart.
4. Prices are formatted with Intl.NumberFormat (en-US, USD).

## 7. Tests (all must pass before you finish)
- Unit (Vitest): money formatting, cart total maths, sale price display, zod schemas, quantity clamping.
- Integration (Vitest + a separate test SQLite DB): cart service add, update, remove and undo, the stock limit, unknown product, inactive product.
- E2E (Playwright, against `next build` + `next start`): browse → filter → search → sort → product → add to cart (toast and badge) → change quantity → reload and check the cart persists → remove and undo → empty state; out-of-stock disabled; 404; mobile menu opens and closes with the keyboard.
- Accessibility: run @axe-core/playwright on every page and fix all serious and critical issues.
- Also run lint, typecheck (tsc --noEmit) and build. Fix all errors. Do not disable rules or skip tests to make them pass.
- Add one command, `npm run verify`, that runs lint, typecheck, unit, integration, build, e2e and axe in order.

## 8. Independent reviews (use subagents)
At the two checkpoints marked in section 9, start a fresh general-purpose subagent that did not write the code, and give it only the review brief:
- Design review: "Look at the screenshots in evidence/phase1/review and docs/DESIGN.md. List the 10 most important visual or UX problems, most serious first, with the page and a concrete fix."
- Code and security review: "Review the repo for security and quality issues: input validation, the price trust boundary, cookie flags, injection, error handling, secrets, dead code. List findings with file, line and fix. Do not edit files."
Fix the valid findings yourself, then note in the report what was found and fixed, and what you rejected and why. Use subagents only for these reviews, because they share the usage limit.

## 9. Work order (copy into docs/PROGRESS.md as a checklist)
- [ ] 1. git init on `main`, scaffold, first commit; create branch `phase-1`
- [ ] 2. Write docs/DESIGN.md (direction, tokens, components)
- [ ] 3. Prisma schema, migration, seed, SVG product illustrations
- [ ] 4. Design tokens and base components
- [ ] 5. Layout (header, mobile menu, footer), home page
- [ ] 6. Catalog with filters, search, sort, pagination
- [ ] 7. Product page and 404
- [ ] 8. Cart (server, cookie, actions, toasts, undo)
- [ ] 9. Unit and integration tests
- [ ] 10. E2E and axe tests, `npm run verify` passes
- [ ] 11. Visual self-review loop (section 5.4)
- [ ] 12. CHECKPOINT: design review subagent, then fixes
- [ ] 13. CHECKPOINT: code and security review subagent, then fixes
- [ ] 14. Lighthouse scores
- [ ] 15. Demo frames and storyboard (section 10)
- [ ] 16. README, LICENSE, docs/PHASE1_REPORT.md, docs/HOW_TO_TEST_PHASE1.md
- [ ] 17. Privacy check and final `npm run verify`

## 10. Demo frames for the video (Claude assembles them later)
- Write the Playwright script `scripts/record-frames.ts`, run with `npm run frames`, on a freshly reseeded database.
- Page screenshots only (no browser chrome, no desktop, no file paths).
- Two sets: desktop at 1280x720 and mobile at 390x844, as zero-padded PNGs in evidence/phase1/desktop/ and evidence/phase1/mobile/.
- Story: home (hero) → scroll featured → category → search → sort → product page → add to cart (capture the toast and badge animation in several frames) → cart → change quantity → reload persists → remove and undo → empty cart → out-of-stock product → 404.
- Capture several frames per step, before and after each action, so the video has smooth pacing. For animations, capture 4 to 6 frames about 60 ms apart.
- Write evidence/phase1/storyboard.json with file, step, a short caption and a suggested duration in seconds for each frame.
- Add evidence/ to .gitignore. Copy evidence/phase1 (frames, storyboard and review screenshots) to E:\handoff\ecommerce_phase1\.

## 11. Repo hygiene
- Small, clear commits on `phase-1`.
- LICENSE: MIT with the line "Copyright (c) 2026 TODO_COPYRIGHT_NAME". I have not decided the name yet.
- README.md: what it is (a portfolio demo store, no real payments), stack, design highlights, a screenshots section that uses 2 images from the review screenshots (copy them to docs/images/), Windows setup steps, test commands and the roadmap (Phase 2 Stripe test mode, Phase 3 admin, Phase 4 Docker + nginx + Postgres on Linux).

## 12. My home test guide: docs/HOW_TO_TEST_PHASE1.md
Write it for me as a numbered list, one action per step. Each step has:
- **Do:** the exact command or click.
- **Expect:** what I should see.
- **If not:** the most likely fix, or which file to check.
Cover, in this order:
1. Fresh setup: pull the branch, npm install, copy .env.example to .env, npx playwright install chromium, db migrate, db seed.
2. `npm run verify`, with the expected test counts.
3. `npm run dev`, then click through every feature in section 6 on desktop.
4. Chrome DevTools device mode at 390 px: the mobile menu, filter drawer, add to cart and cart.
5. Keyboard only: Tab through home → product → add to cart → cart.
6. Cart persistence: add items, close Chrome fully, reopen, check the cart.
7. Edge cases: quantity above stock, out-of-stock product, a made-up URL, search with no results.
8. A production build: `npm run build` then `npm start`, and a quick re-check.
9. Review the frames in E:\handoff\ecommerce_phase1.
10. What to send to Claude (chat): the report, any screenshots of problems, and confirmation that the frames are in E:\handoff.
11. Git: review `git log` and `git diff main`, then the push and merge commands for me to run myself.
End with a short "Known limitations in Phase 1" list.

## 13. Final report: docs/PHASE1_REPORT.md
1. Summary of what was built, with the design direction in one line.
2. Exact versions used.
3. `npm run verify` results with test counts per suite, axe results and Lighthouse scores.
4. The design review (5.4) and subagent review findings, and what was fixed.
5. The number of frames per set and their location.
6. Known issues, "Blocked" and "Needed permissions".
7. A privacy check: grep the repo and evidence folder for real names, emails, Windows user paths (C:\Users), tokens or keys. Show the commands and results.
8. The commit list.

Stop when every item in docs/PROGRESS.md is ticked and committed on `phase-1`. Do not push.
