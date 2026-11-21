# Unattended task: E-commerce store, Phase 2 (checkout, orders, payments)

You are working alone while I am away. Work in E:\ecommerce_store on my personal Windows 11 laptop. Make all decisions yourself using the rules below. Do not stop to ask questions. If something blocks you, write it in docs/PHASE2_REPORT.md under "Blocked" and continue.

First, copy this file to docs/PHASE2_PROMPT.md and commit it.

## 0. Resume rule (read this first, every time)

- Before anything else, check whether docs/PROGRESS_PHASE2.md exists.
  - If it exists, read it, check `git log` and `git status`, and continue from the first unchecked item.
  - If it doesn't exist, create it from the checklist in section 10.
- After each item, tick it, add one line of notes, and make a local commit.
- If a command needs a permission you don't have, log it under "Needed permissions" and continue another way.

## 1. Hard rules (same as Phase 1, plus Stripe rules)

1. Never git push, merge, rebase, or create remotes or PRs. Work on a new local branch `phase-2` created from `main`.
2. Never call live or external services. **You will not have Stripe keys during this run. Do not try to reach api.stripe.com, do not run the Stripe CLI, and do not read .env.** Everything you build must work and be fully tested offline.
3. Demo data only. Invented customers (e.g. "Mona Example", mona@example.com), invented addresses. Never real people, emails or cards. Only Stripe's public test card numbers may appear in docs (4242 4242 4242 4242, 4000 0000 0000 0002 for decline, 4000 0025 0000 3155 for 3-D Secure).
4. No secrets in git. Add the new variables to .env.example with placeholder values only.
5. Localhost only. No tunnels.
6. No work-employer material anywhere.
7. Use the latest stable versions at install time and record them.
8. Keep everything from Phase 1 passing: the design system, accessibility, tests and docs/DESIGN.md. New UI must follow docs/DESIGN.md.

## 2. Payment architecture

- Create a `PaymentProvider` interface in src/lib/payments/ with two implementations:
  - `StripeProvider`: uses the official `stripe` Node SDK and **Stripe Checkout (hosted page)** in test mode. It creates a Checkout Session from the order lines (prices from the database only, never from the client), with success_url and cancel_url, `client_reference_id` = order id, metadata with order id, and an idempotency key per order.
  - `MockProvider`: a fake provider for offline development, tests and demo recordings. It redirects to an internal page /mock-pay/[sessionId] that is clearly labelled at the top: "Mock payment page. No real payment provider is used." It has three buttons: **Pay (test success)**, **Decline (test failure)** and **Cancel**.
- Choose the provider with the env var `PAYMENT_PROVIDER=mock|stripe` (default `mock`). If `stripe` is chosen but keys are missing, fail fast at startup with a clear message.
- The mock is disabled when `NODE_ENV=production`, unless `ALLOW_MOCK_PAYMENTS=true` is set. When it is enabled, show a small "Demo mode: mock payments" ribbon on checkout pages.
- Both providers finish through **one shared code path**: a webhook handler at /api/webhooks/payments.
  - For Stripe, verify the signature with `STRIPE_WEBHOOK_SECRET` using the raw request body.
  - For the mock, the /mock-pay buttons post a signed event built with the same helper, so the same verification and handling code runs.
  - Handle these events: `checkout.session.completed` (paid), `checkout.session.async_payment_failed` and `checkout.session.expired` (release stock), and a mock `payment_failed`.
  - Make the handler idempotent: store processed event ids in a ProcessedEvent table, and ignore duplicates.
- Testing Stripe offline: mock the Stripe SDK in unit tests, and build real signed webhook payloads with `stripe.webhooks.generateTestHeaderString` (this works offline). Never make a network call in tests.

## 3. Data model additions

- Order: id, publicToken (random, unguessable, used in URLs), orderNumber (human-friendly, e.g. NG-2026-000123), status (`pending_payment`, `paid`, `payment_failed`, `cancelled`, `expired`), email, customerName, shipping address fields, subtotalCents, shippingCents, discountCents (0 for now), totalCents, currency, provider, providerSessionId, reservedUntil, paidAt, createdAt and updatedAt.
- OrderItem: id, orderId, productId, productNameSnapshot, unitPriceCentsSnapshot, quantity, lineTotalCents.
- ProcessedEvent: id (the event id), type, receivedAt.
- Keep the schema Postgres-friendly.

## 4. Checkout flow

1. On /cart, the checkout button becomes active and says "Checkout".
2. /checkout is a one-page form with contact (email), shipping (name, address line 1 and 2, city, postal code, country select with a short invented list), and an order summary on the right on desktop and on top (collapsible) on mobile.
   - Validate on the server with zod, show inline errors, and keep the user's input.
   - Use correct autocomplete attributes and input types.
   - Shipping: free over $50, otherwise $5.95 flat.
3. On submit, in **one database transaction**:
   - Re-read all prices and stock.
   - Reserve stock with a conditional update (`stock >= qty`), so two shoppers can't buy the last item.
   - Create the order with status `pending_payment` and a 30-minute reservation.
   - If any item is now short, return the user to the cart with a clear message, and adjust quantities.
4. Redirect to the provider (Stripe Checkout, or /mock-pay).
5. When the payment succeeds (webhook): mark the order paid, clear the cart, and write a confirmation "email" as an HTML file to `var/outbox/` (git-ignored). Never send email. Add a dev-only page /dev/outbox that lists these files, available only when not in production.
6. The success page /order/[publicToken] shows "Thank you" and the order number, lines, totals and shipping address. While the status is still `pending_payment`, show a polite "Confirming your payment…" state that polls every 2 seconds for up to 30 seconds.
7. If the payment fails or is cancelled: return to /checkout with the form still filled and a friendly message, and release the reserved stock.
8. Expiry: add `npm run orders:expire`, which releases stock for orders whose reservation has passed. Also run the same logic before each checkout attempt.
9. Never trust anything from the client: amounts, prices, order status. The success page shows server data only.

## 5. Security

- CSRF: use server actions or check Origin on route handlers. The webhook route is excluded and protected by its signature.
- Basic rate limit on the checkout submit and webhook routes (an in-memory token bucket is fine for now; note that Phase 4 will add it at nginx).
- Never show emails or addresses to anyone except the holder of the publicToken. Order pages are `noindex`.
- Do not log full addresses or emails. Mask them in logs.

## 6. Performance (left over from Phase 1)

Raise Lighthouse mobile Performance (default preset, production build) to 90 or higher on home, catalog and product pages, without a custom CPU calibration. Work on image sizes, font loading (subset and preload only what is used), removing unused JavaScript, and making server components the default.

- Report before-and-after scores honestly.
- If 90 can't be reached on this laptop, explain exactly what limits it.

## 7. Tests (all must pass)

- **Unit:** totals and shipping rules, order number format, the provider selection rules, webhook signature verification (valid, invalid, wrong secret), and the idempotency guard.
- **Integration:**
  - Reservation, including the race: two parallel checkouts for the last item, where exactly one succeeds.
  - Paid, failed, expired and cancelled transitions, and stock release.
  - Duplicate events.
  - Price tampering attempts.
- **E2E with the mock provider:**
  - Full purchase, success page, cart cleared, stock reduced and outbox file written.
  - Decline, which returns to the filled form.
  - Cancel.
  - Validation errors.
  - Out of stock between cart and checkout.
  - Mobile checkout.
  - Keyboard-only checkout.
- **Axe** on /checkout, /mock-pay and the order page.
- Extend `npm run verify` to include all of these.

## 8. Independent reviews (subagents, after the checkout works)

- Security review subagent: "Review the checkout, order, payment and webhook code for: price or amount tampering, race conditions on stock, webhook signature handling, idempotency, IDOR on order pages, CSRF, PII in logs, and secrets. List findings with file, line and fix. Do not edit files."
- Design and UX review subagent: "Review screenshots in evidence/phase2/review against docs/DESIGN.md. List the 10 most important checkout UX problems, with fixes."
- Fix the valid findings, and report what was found, fixed and rejected (with the reason).

## 9. Demo frames (mock provider)

- Write `npm run frames:phase2`, on a fresh seed with PAYMENT_PROVIDER=mock. Desktop 1280x720 and mobile 390x844, page-only screenshots.
- Story: cart → checkout (fill the form with demo data, showing typing in a few frames) → a validation error fixed → submit → mock pay page → pay → "Confirming…" → thank-you page → the outbox email preview → a decline path, briefly.
- Write evidence/phase2/storyboard.json in the same format as Phase 1, with captions that say "mock payment" where it applies.
- Take review screenshots of every new page at 390x844 and 1440x900 in evidence/phase2/review.
- Copy evidence/phase2 to E:\handoff\ecommerce_phase2\.

## 10. Work order (copy into docs/PROGRESS_PHASE2.md)

- [ ] 1. Branch `phase-2` from main; copy this prompt to docs/
- [ ] 2. Prisma models and migration; .env.example updated
- [ ] 3. PaymentProvider interface, MockProvider, StripeProvider (SDK mocked)
- [ ] 4. Webhook handler, signature, idempotency
- [ ] 5. Checkout page, form and validation
- [ ] 6. Reservation transaction and expiry
- [ ] 7. Mock pay page, success page with polling, failure and cancel paths
- [ ] 8. Outbox email and /dev/outbox
- [ ] 9. Security items (section 5)
- [ ] 10. Unit and integration tests
- [ ] 11. E2E and axe; `npm run verify` passes
- [ ] 12. Visual self-review loop (as in Phase 1, section 5.4)
- [ ] 13. CHECKPOINT: security review subagent, then fixes
- [ ] 14. CHECKPOINT: design review subagent, then fixes
- [ ] 15. Lighthouse performance work and scores
- [ ] 16. Frames, storyboard and review screenshots; copy to handoff
- [ ] 17. docs/PHASE2_REPORT.md, docs/HOW_TO_TEST_PHASE2.md, README update
- [ ] 18. Privacy check and final `npm run verify`

## 11. My home test guide: docs/HOW_TO_TEST_PHASE2.md

Use the same style as Phase 1 (Do / Expect / If not, one action per step). Write commands for **Git Bash**, which is what I use. Include:

1. Setup on the branch, migrate, seed, `npm run verify` with the expected counts.
2. A full purchase with the mock provider: success, decline, cancel, and the outbox page.
3. **Stripe test mode (optional, needs my own sandbox keys):**
   - Where to find the test keys in the Stripe dashboard (sandbox).
   - Which lines to set in .env (`PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`).
   - Installing the Stripe CLI on Windows, then `stripe login` and `stripe listen --forward-to localhost:3000/api/webhooks/payments`.
   - Paying with the test cards (success, decline, 3-D Secure), and what to expect each time.
   - A clear warning: only keys starting with sk_test_ and pk_test_, never live keys, and never commit .env.
4. Edge cases: two browser windows buying the last item, an expired reservation (`npm run orders:expire`), and refreshing the success page.
5. What to send to Claude, and the git commands for me to run myself (push phase-2, then merge with `--no-edit`).

## 12. Final report: docs/PHASE2_REPORT.md

Include: a summary, versions, verify results with counts, the order state diagram (as a Mermaid block), the review findings and fixes, Lighthouse before and after, the frame counts, known issues, "Blocked", "Needed permissions", a privacy grep (show the commands and results; check that no sk_live, sk_test, whsec_ or real emails are in the repo or frames), and the commit list.

Stop when every item in docs/PROGRESS_PHASE2.md is ticked and committed on `phase-2`. Do not push.
