# Unattended task: E-commerce store, Phase 3 (admin panel)

You are working alone while I am away. Work in E:\ecommerce_store on my personal Windows 11 laptop. Make all decisions yourself using the rules below. Do not stop to ask questions. If something blocks you, write it in docs/PHASE3_REPORT.md under "Blocked" and continue.

First, copy this file to docs/PHASE3_PROMPT.md and commit it.

## 0. Resume rule (read this first, every time)
- Before anything else, check whether docs/PROGRESS_PHASE3.md exists.
  - If it exists, read it, check `git log` and `git status`, and continue from the first unchecked item.
  - If it doesn't exist, create it from the checklist in section 11.
- After each item, tick it, add one line of notes, and make a local commit.
- If a command needs a permission you don't have, log it under "Needed permissions" and continue another way.

## 1. Branch
- Create the local branch `phase-3`.
  - If `main` already contains the phase-2 commits (`git merge-base --is-ancestor phase-2 main`), branch from `main`.
  - Otherwise, branch from `phase-2`.
- Never merge anything yourself.

## 2. Hard rules (same as Phases 1 and 2)
1. Never git push, merge, rebase, or create remotes or PRs.
2. No live or external services, no Stripe calls, no Stripe CLI, no reading .env, no curl or wget. Everything works and is tested offline. Stripe refunds go through the provider interface and are tested with the SDK mocked.
3. Demo data only.
   - Invented people and emails at example.com only.
   - The demo admin accounts are `admin@example.com` (role admin) and `staff@example.com` (role staff).
   - Their passwords are random. Generate them at seed time and write them only to `var/demo-credentials.txt` (git-ignored). Never print them in docs, frames or logs.
4. No secrets in git. New variables go into .env.example with placeholders only.
5. Localhost only, no tunnels. No work-employer material.
6. Use the latest stable versions at install time and record them.
7. Everything from Phases 1 and 2 must keep passing. Admin UI uses the same design tokens from docs/DESIGN.md, in a denser "back office" layout.

## 3. Authentication and authorization (most important part)
- Login at /admin/login with email and password.
  - Hash passwords with argon2id (or bcrypt cost 12 if argon2 cannot install on Windows; log the reason).
  - Sessions are stored in the database (an AdminSession table). The cookie holds only a random session id: httpOnly, Secure in production, SameSite=Lax, path /admin.
  - Rotate the session id on login.
  - Idle timeout 30 minutes, absolute timeout 12 hours. Logout deletes the session.
- Login protection:
  - Show the same error for a wrong email or a wrong password.
  - Rate limit per IP and per account.
  - Lock the account for 15 minutes after 5 failed tries.
  - Log every attempt to the audit log, with the email masked.
- Roles:
  - **admin:** everything.
  - **staff:** dashboard, orders (view, fulfil, add notes) and products (view, adjust stock). Staff cannot delete or archive products, cannot refund, and cannot manage users or categories.
- Check authorization on the server in **every** admin page, server action and route handler, with one shared helper (`requireAdmin(role?)`). Middleware alone is not enough. Add a test that walks every admin route and action, and proves:
  - Anonymous requests are rejected.
  - Staff are rejected wherever the action is admin-only.
- Admin pages are `noindex`, never cached, and not linked from the storefront.
- Every change made in the admin is written to an AuditLog: who, what, when, entity, and a before/after summary without personal data.
- `npm run admin:create -- --email someone@example.com --role admin` creates an account and prints a one-time random password to the terminal (for my own use at home).

## 4. Admin features
### 4.1 Layout
A sidebar with Dashboard, Orders, Products, Categories, Inventory, Customers (read-only list from orders), Users (admin only), Audit log (admin only) and Logout. A top bar shows the signed-in user and role. On mobile, the sidebar collapses into a drawer. Use real tables with sticky headers, sortable columns and empty states.

### 4.2 Dashboard
- KPI cards: revenue and paid orders for today, the last 7 days and the last 30 days; average order value; pending payment count; low-stock count.
- A revenue-by-day chart for the last 30 days. Use an accessible SVG chart with a data table fallback, and keep the bundle small.
- Lists of recent orders and low-stock products.
- Add a demo-history seed (`npm run db:seed:history`) that creates about 60 invented paid, shipped and cancelled orders spread over the last 45 days, so the dashboard looks realistic. It must be clearly demo data.

### 4.3 Products
- A list with search, filter (category, active or archived, low stock), sort and pagination.
- Create and edit forms: name, slug (auto from the name, editable, unique), short description, description, price, compare-at price, stock, category, active and featured flags.
  - Validate with zod on the server.
  - Show a live preview of the product card.
- Image upload:
  - Accept only jpg, png and webp, up to 5 MB.
  - Check the real file type from its bytes, not just the extension.
  - Re-encode with `sharp`, strip metadata (EXIF) and create 2 sizes.
  - Store under public/uploads/products/ (git-ignored except a .gitkeep).
  - Keep the SVG illustrations as the default image.
- Archive instead of delete when a product has orders. Hard delete only when it has no orders (admin only).
- Price changes never alter past orders, because orders keep snapshots. Prove this with a test.

### 4.4 Categories (admin only)
CRUD with name, slug, description and accent color. A category can't be deleted while it has products.

### 4.5 Inventory
- Stock adjustments with a reason (received, damaged, correction, return), stored in a StockMovement table.
- Orders and reservations also write movements, so the history explains every stock number.
- A per-product history view, a low-stock threshold setting (default 3), and a bulk stock edit table.

### 4.6 Orders
- A list filtered by payment status, fulfilment status and date range, with search by order number, email or name, and sort and pagination.
- A detail page with lines, totals, customer and address, payment info (provider and session id, masked), and a timeline of all events.
- Fulfilment status: unfulfilled → packed → shipped (requires a tracking number and carrier, free text) → delivered. Each step writes a timeline event.
  - When an order is marked shipped, write a "Your order has shipped" email to the outbox.
- Internal notes, staff-only, never shown to customers.
- Cancel and refund (admin only):
  - Full refund only, for now.
  - Mock provider: mark it refunded.
  - Stripe provider: call the refund API through the provider interface (SDK mocked in tests).
  - Restock is optional (a checkbox), and the refund is recorded in the timeline.
  - Write a "Refund issued" email to the outbox.
- Export the filtered order list as CSV. Guard against CSV formula injection by prefixing cells that start with =, +, - or @.
- Print-friendly packing slip page.

### 4.7 Users (admin only)
- List, invite (create with a one-time random password shown once), change role, disable and enable.
- An admin can't disable or demote themselves, and the system can't be left without at least one active admin.

### 4.8 Audit log (admin only)
A searchable list with filters by user, entity and date.

## 5. Storefront updates
1. Customer order page /order/[publicToken]: show fulfilment status and tracking info when shipped, as a simple progress bar.
2. Checkout country select: replace the invented countries with a short list of real countries (for example Egypt, United Arab Emirates, Saudi Arabia, United Kingdom, Germany, France, United States, Canada). Keep the demo customers and addresses invented. Update seeds, tests and frames.
3. The checkout header and footer item noted in the Phase 2 design review: decide now and implement a focused checkout layout (logo, secure-checkout note and back-to-cart link only), following common e-commerce practice.

## 6. Security checklist (verify each, list the results in the report)
- Authorization on every action and route (the test from section 3).
- IDOR: admins only see entities through server queries. There are no client-supplied ownership fields.
- CSRF: server actions or an Origin check on every admin mutation.
- Upload safety (section 4.3).
- CSV injection guard.
- XSS: no `dangerouslySetInnerHTML` with user data. Notes and descriptions are rendered as text.
- Login rate limits and lockout. No user enumeration.
- Audit log entries for every mutation.
- Security headers on /admin: CSP, frame-ancestors none, no-store caching.

## 7. Tests (all must pass)
- **Unit:** role rules, slug generation, CSV escaping, fulfilment state machine, refund rules, password policy, session expiry.
- **Integration:** login, lockout, session rotation and expiry; every admin action with each role (allowed and denied); product CRUD; archive versus delete; stock movements adding up; fulfilment transitions; refund with and without restock; price change not touching past orders; last-admin protection.
- **E2E:**
  - Admin login → dashboard → create a product with an image upload → see it in the storefront.
  - Adjust stock.
  - Fulfil an order to shipped with tracking → the customer order page shows it.
  - Refund an order.
  - Staff login: forbidden pages show a 403 page, and hidden buttons are absent.
  - Logout.
  - Mobile admin drawer.
- **Axe** on every admin page (login, dashboard, lists, forms, order detail).
- Extend `npm run verify` to include all of these.

## 8. Independent reviews (subagents, after the features work)
- **Security review subagent:** "Review the admin auth, sessions, authorization helper, every admin server action and route, uploads, CSV export, refunds and the audit log. Look for missing auth checks, privilege escalation (staff to admin), IDOR, CSRF, user enumeration, session fixation, unsafe uploads, injection and XSS. List findings with file, line and fix. Do not edit files."
- **Design and UX review subagent:** "Review the admin screenshots in the review folder against docs/DESIGN.md and common back-office UX (scanability, table density, bulk actions, empty and error states, destructive-action confirmations). List the 10 most important problems with fixes."
- Fix the valid findings. Report what was found, fixed and rejected (with the reason).

## 9. Demo frames
- Write `npm run frames:phase3` on a fresh seed plus the demo history, with the mock provider. Log in with the seeded demo admin by reading var/demo-credentials.txt inside the script. The password must never appear in a frame: type it into a password field only, which shows dots.
- Desktop 1440x900 (admin is a desktop tool), plus a short mobile set at 390x844 (drawer, order detail). Page-only screenshots.
- Story:
  1. Login.
  2. Dashboard with KPIs and the chart.
  3. Orders list, filtered.
  4. An order: mark it packed, then shipped with tracking.
  5. The customer order page showing "Shipped".
  6. Products list → create a product with an image → it appears in the storefront.
  7. Stock adjustment with history.
  8. Refund an order (with confirmation).
  9. Audit log.
  10. Staff login hitting a forbidden page.
- Write evidence/phase3/storyboard.json in the same format as before.
- Take review screenshots of every admin page at 1440x900 and 390x844 in evidence/phase3/review.
- Copy evidence/phase3 to **E:\handoff\ecommerce_phase1\phase3_evidence\**.

## 10. Docs
- **docs/HOW_TO_TEST_PHASE3.md:** write it the simple way. Short numbered steps in plain words, Git Bash commands one per line, and what I should see after each. Put the simple main path first (about 10 steps) and the optional extra checks after it.
  - Tell me how to read my demo admin password from var/demo-credentials.txt.
  - End with the git commands (push phase-3, then merge into main with --no-edit, then push).
- **docs/PHASE3_REPORT.md:** summary, versions, verify results with counts, the security checklist results, review findings and fixes, the role permission table, frame counts, known issues, "Blocked", "Needed permissions", a privacy grep (no passwords, keys or real emails in the repo or frames; show the commands and results), and the commit list.
- **README:** add an "Admin panel" section with screenshots and the role table.

## 11. Work order (copy into docs/PROGRESS_PHASE3.md)
- [ ] 1. Branch phase-3; copy this prompt to docs/
- [ ] 2. Prisma models (AdminUser, AdminSession, AuditLog, StockMovement, fulfilment fields, notes, refunds) and migration
- [ ] 3. Password hashing, login, sessions, lockout, requireAdmin helper
- [ ] 4. Admin layout, 403 page, mobile drawer
- [ ] 5. Dashboard and demo-history seed
- [ ] 6. Products CRUD, image upload, archive
- [ ] 7. Categories
- [ ] 8. Inventory and stock movements
- [ ] 9. Orders list, detail, fulfilment, notes, packing slip, CSV
- [ ] 10. Refunds (mock and Stripe through the provider interface)
- [ ] 11. Users and audit log pages
- [ ] 12. Storefront updates (section 5)
- [ ] 13. Unit and integration tests, including the auth walk test
- [ ] 14. E2E and axe; `npm run verify` passes
- [ ] 15. Visual self-review loop on admin screenshots
- [ ] 16. CHECKPOINT: security review subagent, then fixes
- [ ] 17. CHECKPOINT: design review subagent, then fixes
- [ ] 18. Frames, storyboard and review screenshots; copy to handoff
- [ ] 19. Docs (section 10)
- [ ] 20. Privacy check and final `npm run verify`

Stop when every item in docs/PROGRESS_PHASE3.md is ticked and committed on `phase-3`. Do not push.
