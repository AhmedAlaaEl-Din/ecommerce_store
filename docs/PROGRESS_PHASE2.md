# Phase 2 progress

Branch: `phase-2` (from `main`). Evidence handoff folder (owner override): `E:\handoff\ecommerce_phase1\phase2_evidence`
instead of `E:\handoff\ecommerce_phase2`.

- [x] 1. Branch `phase-2` from main; copy this prompt to docs/ — branch created from merged main (19e0ca9); new `.claude/settings.json` from the owner's setup folder committed.
- [x] 2. Prisma models and migration; .env.example updated — Order/OrderItem/ProcessedEvent/OrderCounter + OrderStatus enum; stripe 23.2.0 installed; `var/` git-ignored.
- [x] 3. PaymentProvider interface, MockProvider, StripeProvider (SDK mocked) — config rules fail fast via instrumentation.ts; live keys refused; shipping now $5.95 flat; 20 new unit tests.
- [x] 4. Webhook handler, signature, idempotency — /api/webhooks/payments verifies the raw body with Stripe's helper (both providers), ProcessedEvent guard, session-id match, outbox side effect once; integration-tested.
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

## Blocked

_None yet._

## Needed permissions

_None yet._
