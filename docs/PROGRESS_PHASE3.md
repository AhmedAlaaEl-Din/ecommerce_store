# Phase 3 progress

Branch: `phase-3` (from `main`, which already contains `phase-2`). Evidence handoff folder:
`E:\handoff\ecommerce_phase1\phase3_evidence`.

- [x] 1. Branch phase-3; copy this prompt to docs/ — branched from main (02e179f, contains phase-2); prompt copied to docs/PHASE3_PROMPT.md.
- [x] 2. Prisma models (AdminUser, AdminSession, AuditLog, StockMovement, fulfilment fields, notes, refunds) and migration — migration `admin_panel`: AdminUser/AdminSession (hashed session ids), AuditLog, StockMovement (reason enum), OrderEvent timeline, OrderNote, Refund, Setting; Order gains fulfilment fields + `refunded` status; Product gains archivedAt/thumbPath/updatedAt. Installed sharp 0.35.5 and @node-rs/argon2 2.2.2 (prebuilt Windows binaries, argon2id works).
- [x] 3. Password hashing, login, sessions, lockout, requireAdmin helper — argon2id (@node-rs/argon2, OWASP params); DB sessions keyed by SHA-256 of a 256-bit cookie token (httpOnly, SameSite=Lax, path /admin, Secure in production), rotated on login, 30 min idle / 12 h absolute; generic login error, timing-equalised unknown emails, per-IP + per-account token buckets, 5 failures -> 15 min lock; every attempt audited with a masked email; `requireAdmin(role?)` (redirect to login / forbidden() 403); demo accounts seeded with random passwords written only to var/demo-credentials.txt (reused across DBs); `npm run admin:create`. Route groups: (store), (checkout), admin.
- [x] 4. Admin layout, 403 page, mobile drawer — sidebar (role-filtered nav), top bar with user + role badge, native <dialog> drawer under lg (focus trap, Esc, focus return); admin/(panel)/forbidden.tsx via forbidden() (authInterrupts) and an admin 404; noindex metadata + no-store/X-Robots-Tag/no-referrer headers for /admin.
- [x] 5. Dashboard and demo-history seed — KPI cards (today / 7 d / 30 d revenue + paid orders, AOV, pending, low stock), server-rendered SVG revenue chart with text summary + table fallback (no chart library), recent orders, low-stock list; `npm run db:seed:history`: 60 invented orders over 45 days (deterministic, replaceable, timeline says demo, no stock effect). Checkout countries switched to 8 real ones (ISO codes) early because the history uses them.
- [x] 6. Products CRUD, image upload, archive — list with search, category/status/low-stock filters, sortable sticky-header table, pagination; create/edit (admin) with zod validation, auto slug, live ProductCard preview; uploads: JPEG/PNG/WebP by magic bytes, ≤ 5 MB, sharp re-encode to 1200 + 600 px WebP without metadata (EXIF/GPS verified gone), random names in public/uploads/products, served by /media/products/[file]; archive (hides + removes from carts) vs hard delete only without orders; staff get a read-only view. Server action body limit raised to 6 MB.
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

## Blocked

(none yet)

## Needed permissions

- `git merge-base --is-ancestor` is caught by the `Bash(git merge*)` deny rule; used `git rev-list main..phase-2` (0 commits) instead.
