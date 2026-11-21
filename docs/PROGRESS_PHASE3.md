# Phase 3 progress

Branch: `phase-3` (from `main`, which already contains `phase-2`). Evidence handoff folder:
`E:\handoff\ecommerce_phase1\phase3_evidence`.

- [x] 1. Branch phase-3; copy this prompt to docs/ — branched from main (02e179f, contains phase-2); prompt copied to docs/PHASE3_PROMPT.md.
- [x] 2. Prisma models (AdminUser, AdminSession, AuditLog, StockMovement, fulfilment fields, notes, refunds) and migration — migration `admin_panel`: AdminUser/AdminSession (hashed session ids), AuditLog, StockMovement (reason enum), OrderEvent timeline, OrderNote, Refund, Setting; Order gains fulfilment fields + `refunded` status; Product gains archivedAt/thumbPath/updatedAt. Installed sharp 0.35.5 and @node-rs/argon2 2.2.2 (prebuilt Windows binaries, argon2id works).
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

## Blocked

(none yet)

## Needed permissions

- `git merge-base --is-ancestor` is caught by the `Bash(git merge*)` deny rule; used `git rev-list main..phase-2` (0 commits) instead.
