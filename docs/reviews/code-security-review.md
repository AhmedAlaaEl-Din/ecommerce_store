# Independent code and security review (checkpoint, step 13)

A fresh general-purpose subagent was given only the brief: "Review the repo for security and quality
issues: input validation, the price trust boundary, cookie flags, injection, error handling, secrets,
dead code. List findings with file, line and fix. Do not edit files."

**Headline:** no critical issues. The reviewer confirmed the price trust boundary holds (actions accept only
`{productId, quantity}`, zod-validated; price, stock and active status come from the database), that
Prisma is the only DB path (no raw SQL), that there is no `dangerouslySetInnerHTML`, that errors reach the
client only as fixed friendly messages, and that git history contains no `.env`, database or key files.

| # | Finding | Decision | What changed |
| - | ------- | -------- | ------------ |
| 1 | No security headers | Fixed | `next.config.ts` sends CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, …), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` off. E2E test added. CSP still needs `'unsafe-inline'` for Next's inline bootstrap scripts; a nonce-based CSP is listed for Phase 4. |
| 2 | Unlimited anonymous cart creation; `updatedAt` only touched on add | Partly fixed | Every change (add, update, remove, undo) now touches `Cart.updatedAt`; `pruneIdleCarts()` + `npm run db:prune-carts` delete carts idle > 30 days (integration-tested). Per-IP rate limiting is **deferred to Phase 4** (it belongs in nginx/the proxy; Phase 1 is localhost-only). |
| 3 | `Secure` flag derived from a client-controllable header | Fixed | `Secure` is now configuration-driven: `COOKIE_SECURE=true`, or `TRUST_PROXY=true` + proxy's `X-Forwarded-Proto`. Defaults keep http://localhost working. |
| 4 | DB failure in the root layout is not caught by `error.tsx` | Fixed | Layout falls back to empty nav / cart count 0 on error; added `global-error.tsx`. |
| 5 | Cart view keeps quantities above current stock | Fixed | `getCart`/`getCartItemCount` clamp to current stock; sold-out lines are flagged `unavailable`, shown with a notice and excluded from totals (integration-tested). |
| 6 | `z.coerce.number()` accepts `true`, `"5"`, `["5"]` | Fixed | `z.number().int()`; unit test asserts strings/booleans/arrays are rejected. |
| 7 | Product id regex wider than real ids | Fixed | Lowercase only, 8–40 chars. |
| 8 | `Cart.id` defaults to cuid while code uses UUIDs | Fixed | `@default(uuid())` (client-side default, no SQL migration needed). |
| 9 | LIKE wildcards in search | Fixed (confirmed real) | A search for `%` matched all 24 products. Queries containing `%`/`_` are now matched literally in code; integration test added. Not an injection risk (parameterised). |
| 10 | Currency unvalidated; summary formats without currency | Fixed | `SUPPORTED_CURRENCIES = ["USD"]` with a `Currency` type used by the seed; order summary formats with the cart's currency. |
| 11 | Search pages indexable with user text in the title | Fixed | `robots: noindex` when `q` is present. |
| 12 | Read-then-write race in `addItem` | Fixed | Product lookup, cart creation and the upsert run in one transaction (SQLite serialises writers). |
| 13 | `error.tsx` drops `error.digest` | Fixed | Digest logged in `useEffect` (both error boundaries). |
| 14 | Cookie expiry not sliding on update/remove | Fixed | Cookie is rewritten on every successful change. |
| 15 | `.claude/settings.json` allows broad `cat`/`node`/`npx` while denying `Read(./.env)`; `rm -rf node_modules*` prefix | **Not changed – owner decision** | This is the repository owner's tool-permission file; it was not modified. Flagged in the report for the owner to review. |
| 16 | `E2E_PORT` validated after use | Fixed | Validated immediately after it is read. |
| 17–18 | Unused `getCategoryBySlug`, `ProductCardRow` | Fixed | Removed. |
| 19 | `Input` component unused | Rejected | It is part of the required component kit (docs/DESIGN.md §5); kept for Phase 2 checkout forms. |
| 20 | Unused `SITE_NAME` | Fixed | Removed. |
| 21 | Hard-coded `<= 3` in CartView | Fixed | Uses `LOW_STOCK_THRESHOLD`. |
| 22 | Unused `name` select | Fixed | Removed. |
| 23 | `restoreItem` just calls `addItem` (merges after re-add) | Kept, documented | Merging is the intended undo behaviour if the item was re-added meanwhile; covered by tests. |
