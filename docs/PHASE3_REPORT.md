# Phase 3 report: admin panel

Branch `phase-3` (from `main`, which already contained phase-2). Nothing was pushed or merged.

## Summary

Back-office at `/admin`: argon2id login with DB sessions, lockout and throttling; roles admin/staff enforced
by one `requireAdmin(role?)` helper on every page, route and action; dashboard with accessible SVG chart and
demo-history seed; products (validated upload pipeline, archive vs delete), categories, inventory with
stock movements, orders (fulfilment, tracking, notes, packing slip, CSV, refunds through the provider
interface), customers, users, audit log. Storefront: order progress bar + tracking, refunded state, 8 real
countries, focused checkout layout.

## Versions (installed)

next 16.4.6, react 19.3.0, prisma 7.10.x, sharp 0.35.5, @node-rs/argon2 2.2.2 (argon2id works on Windows, no
bcrypt fallback needed), zod 4.6.x, stripe 23.2.0, vitest 5.1.x, @playwright/test 1.65.x.

## Final `npm run verify` (exit 0)

| Step            | Result                               |
| --------------- | ------------------------------------ |
| lint, typecheck | clean                                |
| unit            | 135 passed                           |
| integration     | 143 passed                           |
| build           | ok                                   |
| e2e             | 52 passed (51 tests + sign-in setup) |
| axe             | 30 passed (29 checks + setup)        |

## Security checklist

| Item                                     | Result                                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Authorization on every page/action/route | Pass: walk test discovers all and requires classification + `requireAdmin`; anonymous -> login, staff -> 403 on admin-only |
| IDOR                                     | Pass: ids resolved server-side; no ownership fields from the client; public order pages use unguessable token              |
| CSRF                                     | Pass: server actions (Origin check) + SameSite=Lax; only GET with side effect is CSV export (info I2)                      |
| Uploads                                  | Pass: magic bytes, 5 MB, sharp re-encode, EXIF gone, random names                                                          |
| CSV injection                            | Pass: `= + - @ tab CR` prefixed                                                                                            |
| XSS                                      | Pass: no `dangerouslySetInnerHTML`; notes/descriptions rendered as text                                                    |
| Login limits, lockout, enumeration       | Pass: generic error, timing-equalised, per-IP + per-account, 5 -> 15 min                                                   |
| Audit of every mutation                  | Pass; gaps listed below (denials, PII views, failed refunds)                                                               |
| Headers on /admin                        | Pass: CSP, frame-ancestors none, no-store, noindex                                                                         |

## Reviews

- **Security** (`docs/reviews/phase3-security-review.md`): 0 critical/high, 4 medium, 8 low, 3 info.
  Fixed: spoofable client IP (last hop), demo seed in production, `in` operator, orphan upload files.
  Rejected: lockout DoS and per-attempt audit rows (required by the brief). Deferred: password change/reset,
  refund audit/atomicity, auth-denial audit, deployment items (Phase 4).
- **Design** (`docs/reviews/phase3-design-review.md`): 10 problems. The reviewer saw only 18 of 51 shots and
  guessed paths; one claim (sidebar not sticky) was wrong. No UI changes were made; all deferred (below).

## Role permissions

| Capability                                                        | admin | staff |
| ----------------------------------------------------------------- | :---: | :---: |
| Dashboard, orders view/fulfil/notes/packing slip                  |  yes  |  yes  |
| Products view, stock adjust, inventory view                       |  yes  |  yes  |
| Product create/edit/archive/delete, categories, low-stock setting |  yes  |  no   |
| Cancel/refund, CSV export, customers                              |  yes  |  no   |
| Users, audit log                                                  |  yes  |  no   |

## Frames

38 desktop (1440x900) + 11 mobile (390x844), storyboard.json, 53 review screenshots; copied to
`E:\handoff\ecommerce_phase1\phase3_evidence` (103 files). Passwords are typed into password fields only.

## Fix 1: mobile revenue chart

**Cause.** The dashboard chart SVG had `min-w-[40rem]` inside an `overflow-x-auto` box. On a 390px phone it was
640px wide in a 358px card, so only about 24 Oct to 7 Nov showed and today (the best day, 22 Nov) was cut off.
**Change.** `src/components/admin/RevenueChart.tsx` now draws the same data twice, each with a `viewBox`,
`width="100%"`, `preserveAspectRatio` and no min-width or scrolling. A compact drawing (340 wide) shows under 640px:
all 30 bars, y-axis labels at 11px, x labels every 7th day. A wide drawing (800 wide) shows from 640px up,
labels every 5th day. CSS shows exactly one; both keep `role="img"`, title, description and the data table fallback.
**Test.** `tests/e2e/admin.spec.ts` "dashboard revenue chart fits its card" at 390x844, 768x1024 and 1440x900:
30 bars, SVG not wider than its card, last bar fully inside the card, no inner or page horizontal scroll. It failed
before the fix at 390 (SVG 640px, card 358px) and passes at all three sizes.
**Re-run.** Frames (38 desktop + 11 mobile + storyboard) and 53 review shots retaken on a fresh seed plus
demo history; privacy grep clean; evidence copied to the handoff folder.

**Final test counts: 135 unit · 143 integration · 55 end-to-end · 30 accessibility** (`npm run verify` exit 0).

## Fix 2: dashboard KPI numbers clipped

- **Cause:** the six KPI cards sat in a fixed `xl:grid-cols-6` grid with a fixed `text-2xl` value. On a ~1590 px laptop window with display scaling, the columns were too narrow for "$1,680.50", so the last digit was cut off by the card edge.
- **Change:** the grid is now `repeat(auto-fit, minmax(10.5rem, 1fr))`, so cards wrap to 4, 3 or 2 per row when there is no room. The value font is `clamp(1.125rem, 0.55rem + 1vw, 1.5rem)` (still 24 px at 1440), with `tabular-nums`, `whitespace-nowrap` and `min-w-0` on the card. No `overflow: hidden`. The 390 px phone layout keeps two columns.
- **Other pages:** order list, order detail, product list and stock history were checked with "$99,999,999.99" injected into every number; none overflowed (wide tables already scroll inside their own container), so no change was needed.
- **Tests:** `dashboard KPI values are never clipped` injects "$99,999.99" into every money card and checks, at 1024, 1280, 1366, 1440, 1600, 1920 and 390 px, at scale 1 and 1.25, that no value scrolls or leaves its card (14 tests). It failed at 10 of the 14 before the fix and passes after. `big numbers on other admin pages never overflow` covers the other pages at 390, 1024 and 1440 (3 tests).
- **Final counts:** 135 unit · 143 integration · 72 end-to-end · 30 accessibility. Frames 38 desktop + 11 mobile, review screenshots 53; privacy grep clean.

## Known issues

- No bulk selection or row actions on orders/products; filters need Apply; no mobile card tables.
- No password change/reset or forced rotation of one-time passwords.
- Failed refund attempts and 403 denials are not audited; no audit retention; refund not atomic with provider (idempotency key makes retries safe).
- Account lockout can be triggered by anyone knowing an admin email (break-glass: `admin:create`).
- Checkout action still reads the first x-forwarded-for hop. Phase 4: proxy config, `script-src 'unsafe-inline'`, 6 MB action body limit scope.

## Blocked

None.

## Needed permissions

`git merge-base --is-ancestor` is denied by the `Bash(git merge*)` rule; `git rev-list main..phase-2` was used.

## Privacy check

Commands (run in the repo):

- `git grep -lF <each demo password from var/demo-credentials.txt>` -> 0 tracked files each.
- `grep -rlF <each demo password> evidence docs README.md var/verify-phase3.log` -> 0 files each.
- `git grep -E "sk_(live|test)_|whsec_|BEGIN .*PRIVATE KEY"` -> 0 matches.
- Emails in tracked files other than example.com: only the commit co-author noreply address in history, none in files.
- `var/demo-credentials.txt` is git-ignored (`git check-ignore` confirms). PNG frames cannot be grepped; the script types the password into a password field (dots).

## Commits

`git log --oneline main..phase-3` (15+ commits: db models, auth, shell/dashboard, products, inventory/categories,
orders/refunds/users/audit, storefront updates, tests, e2e/axe, visual fixes, security fixes, reviews, frames, docs).
