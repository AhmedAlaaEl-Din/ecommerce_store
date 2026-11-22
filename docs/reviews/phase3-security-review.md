# Phase 3 security review (admin panel)

Scope: admin auth, sessions, `requireAdmin`, every admin server action and route handler, product image uploads, CSV export, refunds, audit log. Method: static code review only (no source edited, nothing executed against a running server). Paths are relative to the repo root.

Summary: no Critical or High findings. No missing auth check, no staff-to-admin escalation path, no IDOR (all admins may see all records by design), no injection or XSS found. The findings below are hardening and availability issues.

| Severity | Count |
| --- | --- |
| Critical | 0 |
| High | 0 |
| Medium | 4 |
| Low | 8 |
| Info | 3 |

---

## Medium

### M1. Login rate limit keys on a client-controlled header (IP spoofing)
- File: `src/lib/admin/request.ts:5-8` (used by `src/app/admin/login/actions.ts:40`, limiter in `src/lib/admin/auth-service.ts:75`)
- Issue: `clientIp()` takes the FIRST entry of `x-forwarded-for`. When the app is reached directly (no proxy that overwrites the header), a client can send any value, so every request gets a fresh per-IP bucket. The per-IP limiter (20 burst) is then useless; only the per-account limiter and the 5-failure lockout remain. Each attempt also runs an argon2id verify (19 MiB, `password.ts:9-14`), so spraying with rotating fake IPs is a CPU/memory DoS vector. The same pattern exists in `src/app/(checkout)/checkout/actions.ts:38`.
- Fix: take the LAST hop appended by your trusted proxy (or a fixed number of trusted hops), or read the socket address; configure nginx to overwrite (not append) `X-Forwarded-For`/`X-Real-IP`. Add a global concurrency cap on password verification. Keep the Phase 4 nginx `limit_req` on `/admin/login`.

### M2. Any known admin email can be locked out indefinitely (account-lockout DoS)
- File: `src/lib/admin/auth-service.ts:135-137`, `src/lib/admin/session-rules.ts` (`LOCKOUT_THRESHOLD = 5`, `LOCKOUT_MS = 15 min`)
- Issue: five wrong passwords for a valid email lock that account for 15 minutes, with no CAPTCHA, no per-IP attribution and no allow-list. An attacker who knows an admin email (the seeded `admin@example.com` is public in `src/lib/admin/demo-accounts.ts:39-42`) can re-lock it every 15 minutes with about 5 requests, permanently denying the sole admin access. Combined with M1 the per-IP limiter does not slow this down.
- Fix: count failures per (account, IP) as well as per account, or use exponential back-off with a short cap instead of a hard lock; keep a break-glass path (the `admin:create` CLI exists; document an `admin:unlock` script). Alert on repeated `auth.account_locked`.

### M3. No password change or reset, and no forced rotation of the one-time password
- File: `src/lib/admin/users.ts:42-45`, `src/lib/admin/auth-service.ts:254`, `src/components/admin/InviteUserForm.tsx`
- Issue: invited users get a random password that is displayed on the inviter's screen (and returned through the server-action state) and can never be changed by the user. There is also no admin "reset password" or "revoke all sessions" control other than disabling the user. A leaked or shoulder-surfed one-time password stays valid for the lifetime of the account.
- Fix: add a `mustChangePassword` flag set on invite and CLI creation, a change-password action (requires the current password, applies `checkPasswordPolicy`, deletes the user's other sessions, writes an audit row), and an admin "reset password" action.

### M4. Unauthenticated requests write unbounded rows to the audit log
- File: `src/lib/admin/auth-service.ts:76-84` (throttled) and `:111-118` (every failed login, including unknown emails)
- Issue: every failed or throttled login by an anonymous client inserts an `AuditLog` row. With M1 the limiter does not bound this, and there is no retention or pruning. The log (and the admin audit page, which counts and pages the whole table, `src/lib/admin/audit-list.ts:29-38`) can be bloated, burying real admin activity and growing the SQLite file.
- Fix: do not write per-attempt rows for unknown emails/throttled requests (log to the application log instead, or sample/aggregate), cap per-IP audit writes, and add a retention job for `auth.login_failed` / `auth.login_throttled`.

---

## Low

### L1. Refund is not atomic with the provider call, and failed/denied attempts are not audited
- File: `src/lib/admin/orders.ts:371-400`, `src/app/admin/(panel)/orders/actions.ts:69-79`
- Issue: the provider refund is issued first and the DB update second. If the transaction fails after the provider succeeds, the order stays `paid` with no audit row until someone retries (the Stripe idempotency key `refund-<orderId>` in `src/lib/payments/stripe.ts` makes a retry safe, but the admin sees only "refund didn't go through"). Failed refund attempts (provider error, amount mismatch) write no audit entry at all, so a pattern of attempts is invisible. `restock` is honoured for delivered orders, so an admin can re-add stock for goods that were shipped (business-logic abuse, admin only).
- Fix: write an `order.refund_attempt` audit row (or a `Refund` row in state `pending`) before calling the provider and settle it afterwards; on DB failure after provider success, log loudly and surface "refunded at provider, retry to finish". Consider disallowing `restock` once fulfilment is `shipped`/`delivered`.

### L2. Demo seed resets/creates well-known admin accounts with no production guard
- File: `src/lib/admin/demo-accounts.ts:66-87`, `prisma/seed.ts:92`
- Issue: `seedDemoAccounts` upserts `admin@example.com` (role admin) and `staff@example.com`, and on every run resets `passwordHash`, `role`, `isActive`, `failedLogins`, `lockedUntil`. Passwords are random and file-based (good), but running `db:seed` against a production database would re-activate/reset a predictable admin identity and drop the lockout.
- Fix: refuse to run when `NODE_ENV === "production"` (or require an explicit `--demo` flag), and never `update` role/password for an existing row.

### L3. `DoneNotice` uses the `in` operator on a plain object
- File: `src/components/admin/ui.tsx:171`
- Issue: `?done=constructor`, `?done=toString` or `?done=__proto__` satisfies `code in messages`, so a function/object is rendered as a React child, causing a render error (500) on those admin pages. Only reachable by an authenticated admin (or a crafted link they click); no data exposure.
- Fix: `Object.hasOwn(messages, code)`.

### L4. Session cookie hardening is environment-dependent
- File: `src/lib/admin/guard.ts:38-49`
- Issue: `Secure` is set only when `NODE_ENV === "production"` and can be switched off with `ADMIN_COOKIE_SECURE=false`; no `__Host-` style prefix (not possible with `path=/admin`, but `__Secure-` is). A staging deployment on plain HTTP or a mis-set variable leaks the session over HTTP.
- Fix: default Secure on everywhere except `localhost`; fail startup in production if `ADMIN_COOKIE_SECURE=false`; use a `__Secure-` cookie name in production.

### L5. Global 6 MB server-action body limit also applies to unauthenticated actions
- File: `next.config.ts:54`
- Issue: the limit raised for product image uploads applies to every server action, including the login, cart, checkout and mock-pay actions that anonymous users can call, so each can be fed 6 MB bodies (buffered before the handler runs).
- Fix: enforce a lower limit at nginx for everything except the product form routes (`/admin/products/**`), or move image upload to a dedicated route handler with its own streaming size cap behind `requireAdmin`.

### L6. Image upload: whole file buffered, no concurrency limit, orphan files on unexpected failure
- File: `src/app/admin/(panel)/products/actions.ts:48-60, 71-77, 92-98`, `src/lib/admin/images.ts:76-97`
- Issue: (a) the upload is fully read into memory and decoded by sharp (up to 40 MP, `images.ts:83`) with no concurrency or per-user rate limit; several concurrent uploads can exhaust CPU/memory (admin only). (b) The files are written before `createProduct`/`updateProduct`; if those throw something other than a handled error (for example a DB error that is re-thrown), the two WebP files are never deleted. (c) Type detection reads only the leading magic bytes, but re-encoding through sharp makes this safe (see "checked and fine").
- Fix: wrap create/update in try/catch and call `deleteStoredImage` on any exception; add a small semaphore around `processAndStoreImage`; lower `limitInputPixels` (for example 25 MP).

### L7. Mock payment provider can be enabled in production, letting anyone mark orders paid
- File: `src/lib/payments/config.ts:43-45, 68-80`, `src/app/(store)/mock-pay/actions.ts`
- Issue: `ALLOW_MOCK_PAYMENTS=true` with `NODE_ENV=production` is accepted. The mock pay buttons are unauthenticated by design (signed in-process), so any visitor with a pending order can complete the payment, which then flows into admin fulfilment and refunds. Guarded by env and a startup check, so this is a deployment-configuration risk rather than a code bug.
- Fix: keep it out of any production environment file; add a loud startup warning, and render a visible "DEMO PAYMENTS" banner in the admin when the mock provider is active.

### L8. Audit coverage gaps
- File: `src/lib/admin/guard.ts:31-36`, `src/lib/admin/orders.ts:117-174`, `src/app/admin/(panel)/orders/[id]/page.tsx`
- Issue: not audited: authorization denials (staff reaching an admin-only page/action, which returns 403 silently), views of customer PII (order detail, packing slip, order list search), failed refunds/cancels (see L1). CSV exports and role changes are audited (good). `AuditLog` has no tamper protection beyond application code (no DB-level append-only trigger).
- Fix: log `auth.forbidden` (actor, route) from `requireAdmin` when `forbidden()` is raised; optionally log order detail/packing-slip views; add a SQLite trigger blocking UPDATE/DELETE on `AuditLog` if tamper evidence matters.

---

## Info

### I1. Staff can see all customer PII via orders despite `customers.view` being admin-only
- File: `src/lib/admin/roles.ts:11-14, 26`, `src/app/admin/(panel)/orders/page.tsx:40`, `src/lib/admin/orders.ts:56-63`
- Staff have `orders.view` and can search the order list by email/name and open full addresses, which makes the admin-only `customers.view` restriction partly cosmetic. CSV export correctly stays admin only. Decide whether this is intended; if not, hide email/address from staff on order list/detail and keep only what packing needs (the packing slip legitimately needs the address).

### I2. CSV export is a state-changing GET
- File: `src/app/admin/(panel)/orders/export/route.ts:17-37`
- The route writes an audit row on GET and the cookie is `SameSite=Lax`, which is sent on cross-site top-level navigations. A third-party page can trigger an export (a download plus audit noise) for a signed-in admin; the attacker cannot read the response. Low impact. Optionally require `Sec-Fetch-Site: same-origin` (or `none`) on this route, or make it a POST server action.

### I3. Concurrent demotion race on the "last admin" guard
- File: `src/lib/admin/users.ts:52-75, 77-104`
- The "at least one active admin" check runs inside `$transaction`; with SQLite's write serialization this is effectively safe today. If the database moves to Postgres at default isolation, two admins demoting/disabling each other simultaneously could both pass the check. Use a serializable transaction or `SELECT ... FOR UPDATE` then.

---

## Checked and found fine

Authentication and sessions
- Password hashing: argon2id (19 MiB, t=2), policy 12-128 chars, common-password and email-contains checks (`password.ts`).
- Session token: 256-bit random, only the SHA-256 hash is stored, strict token shape check before lookup (`session-rules.ts`).
- Session fixation: a new token is minted at every login and the previous cookie's session row is deleted (`auth-service.ts:139-153`); expired sessions for the user are purged at login.
- Timeouts: 30 min idle and 12 h absolute; sliding touch does not extend the absolute expiry; expired or deactivated-user sessions are deleted on use (`auth-service.ts:188-215`).
- Role is read from the database on every request, so demotion and deactivation take effect immediately; disabling a user deletes all their sessions (`users.ts:95`).
- Logout deletes the session row and the cookie (`app/admin/actions.ts`); cookie is HttpOnly, SameSite=Lax, path `/admin`.
- User enumeration: identical failure message for unknown/disabled/locked/wrong password; unknown, disabled and locked paths burn an argon2 verification to equalise timing; the per-account limiter is keyed on typed email whether or not it exists. Audit "reason" values are visible only to admins.

Authorization
- Every admin page, layout, route handler and server action calls `requireAdmin()`; the only exceptions are the login page (redirects signed-in users) and `loginAction`, as designed. Grep confirmed `requireAdmin` in all 15 panel pages, the print page, the export route, and all 6 action files; `app/admin/layout.tsx` is metadata only.
- Admin-only actions use `requireAdmin("admin")` AND the service layer repeats `assertCan(actor, ...)` (defence in depth). Actor identity comes from the session, never from form data.
- Staff-allowed actions are exactly: fulfilment, notes, stock adjust, bulk stock, and read views. Refund, cancel, export, product edit/archive/delete, categories, users, audit and threshold are admin-only in both layers.
- Privilege escalation: `inviteUser`, `changeRole`, `setUserActive` require `users.manage`; role values are whitelisted with `isAdminRole`; self-demotion and self-disable are refused; the last active admin cannot be demoted or disabled.
- IDOR: all ids are looked up directly, but every admin may access every record by design; no per-owner data exists in the admin. Public order pages use an unguessable `publicToken`.

CSRF
- Mutations are server actions (Next's Origin/Host check) plus `SameSite=Lax` cookies; the only GET with side effects is the export (see I2). The payment webhook is signature-verified instead of cookie-based.

Injection and XSS
- No raw SQL (`$queryRaw`/`$executeRaw` are only in generated Prisma code); all filters use Prisma's parameterised API; sort and direction are whitelisted with `oneOf`.
- No `dangerouslySetInnerHTML`, `innerHTML` or JSON-LD injection anywhere in `src`; all admin-entered text (notes, names, tracking numbers, descriptions) is rendered through React escaping; the audit summary is rendered as text.
- Email/outbox HTML escapes every interpolated value (`escapeHtml`), the outbox file name is regex-restricted, and `/dev/outbox` returns 404 in production.
- Open redirect: redirects only go to fixed `/admin/...` paths with encoded ids; the bulk-stock `back` value only contributes query parameters to `/admin/inventory`.

Uploads
- Size cap 5 MB checked on `file.size` before decode; real type from magic bytes (JPEG/PNG/WebP only, SVG and GIF rejected); the image is decoded and re-encoded by sharp (`failOn: "error"`, pixel limit), so polyglot or malicious payloads do not survive and metadata (EXIF/GPS) is dropped.
- Stored names are server-generated random hex; the client file name and MIME are ignored; no path traversal possible. The `/media/products/[file]` route accepts only `MEDIA_FILE_RE` names, serves a fixed `image/webp` type with `nosniff` and `CSP: default-src 'none'; sandbox`.
- Deleting old images only follows paths that start with the media prefix and match the file regex.

CSV export
- Admin-only (route and service), capped at 5000 rows, filters whitelisted/validated, formula-injection guard (`= + - @ \t \r` prefixed with `'`) and RFC 4180 quoting applied to every cell, `Content-Disposition: attachment`, `nosniff`, `no-store`; export is audited with the search term redacted.

Refunds
- Admin-only; full refunds only, once (`checkRefund` plus a unique `Refund` row and a conditional `updateMany` on `status: "paid"`); provider name must match the order's provider; Stripe refund checks the session is paid and the amount/currency match the order and uses a per-order idempotency key; amounts come from the database, never the client. Stock restock goes through `applyStockChange` in the same transaction.

Audit log
- Writes are in the same transaction as the change; summaries exclude passwords and customer PII (emails masked, note text not stored), are size-capped, and are rendered as text. The log is admin-only to view, has no delete/edit code path, and `actorId` uses `SetNull` on user deletion.

Other
- Admin responses send `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`; site-wide CSP (`frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`) and `X-Frame-Options: DENY`. (`script-src 'unsafe-inline'` is a known Phase 4 item.)
- `.gitignore` excludes `var/` (demo credentials, outbox) and uploads; demo credentials file is written with mode 0600 and passwords are not printed.

---

## Disposition (applied after the review)

| Finding | Result |
| --- | --- |
| M1 spoofable client IP | Fixed: `clientIp` uses the last x-forwarded-for hop (checkout action still uses first hop: Phase 4 proxy config item) |
| M2 lockout DoS | Rejected for now: 5 failures / 15 min lock is required by the brief; `admin:create` is the break-glass path. Noted as known issue |
| M3 password change/reset | Deferred (not in the brief); known issue |
| M4 audit growth | Rejected: brief requires every attempt logged; retention job is a Phase 4 item |
| L1 refund atomicity/audit | Deferred; idempotency key makes retries safe; known issue |
| L2 demo seed in production | Fixed: seed refuses when NODE_ENV=production |
| L3 `in` operator | Fixed: `Object.hasOwn` |
| L4, L5, L7 | Deployment config; Phase 4 |
| L6 orphan upload files | Fixed: files deleted if create/update throws; concurrency cap deferred |
| L8 audit gaps | Deferred; known issue |
| I1-I3 | Accepted / noted |

Unit 135 and integration 143 still pass.
