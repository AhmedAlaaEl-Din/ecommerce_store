# Phase 3 admin design review

Scope: screenshots in `evidence/phase3/review` (desktop 1440x900, mobile 390x844), checked against `docs/DESIGN.md` and common back-office UX. Not every one of the 51 shots was opened; the 18 I viewed covered dashboard, orders (list, empty, detail, refund dialog), products (list, empty, new with errors, archive dialog), inventory (desktop and mobile), users, audit log, login error and staff 403. File names are best guesses from the `src/` tree and were not opened, so confirm them before editing. Ordered by importance.

Overall: the visual language matches DESIGN.md well (linen background, Fraunces headings, green primary, danger red reserved for destructive actions). The problems are mostly about workflow and density, not styling.

## Top 10 problems

### 1. No bulk selection or bulk actions on Orders and Products
Both tables (`05-orders-desktop`, `12-products-desktop`) have no checkbox column and no bulk bar. A merchant cannot mark several orders as packed, print several packing slips, archive several products, or toggle Featured in one pass. Inventory is the only bulk screen.
Fix: add a leading checkbox column with a select-all header checkbox in the orders and products list tables (`src/app/admin/(panel)/orders/page.tsx`, `.../products/page.tsx`, shared table pieces in `src/components/admin/ui.tsx`). Show a sticky bar ("3 selected: Mark packed, Packing slips, Export CSV, Clear") when the selection is non-empty. For Products use Archive, Set featured and Set active. Bulk destructive actions must go through `ConfirmDialog` and state the count.

### 2. Row-level actions are missing from the lists
Every row is a link to a detail page. There are no inline actions (quick "Mark packed", "Edit", "Adjust stock") and no row action menu. Orders needing action ("Unfulfilled") look no different from finished ones; only a small pill differs.
Fix: add a right-aligned actions cell (kebab or one primary text button) per row. Put "Needs action" (Paid and Unfulfilled) first in the orders default sort, or add a "To do" quick-filter tab above the filters. Dashboard "Recent orders" should link each row and highlight unfulfilled ones.

### 3. Filters need an Apply click and have no active-filter summary
Filters (`05-orders-desktop`, `12-products-desktop`, `24-audit-desktop`) are a form with an Apply button, empty native date inputs showing `mm/dd/yyyy`, and a "Clear filters" link that only appears after filtering. The result count line ("1-20 of 60 orders") sits below, small and muted. Search placeholder text is faint.
Fix: apply on change for selects and checkboxes and debounce the search box (a client wrapper in the list page). Show removable chips for active filters ("Payment: Paid x") and always show Reset. Add date presets (Today, 7 days, 30 days). Move the result count into the table header. Orders also lacks status tabs with counts (All, Unfulfilled, Packed, Shipped, Refunded), which are the fastest scan path in order management.

### 4. Tables are clipped inside an inner scroll box, with dense-but-wasteful rows
`05-orders-desktop` cuts the last row mid-text at the viewport edge. Rows are about 57 px tall (two-line customer cell) with large empty gaps between ORDER and PLACED and between columns, while the Items column is a bare number. On mobile (`05-orders-mobile`, `12-products-mobile`) the table scrolls horizontally inside a card and the Customer, Payment, Fulfilment and Total columns are hidden off-screen, so the key information (status, amount) is invisible without a swipe. Nothing hints at the scroll.
Fix: on mobile render each row as a stacked card (order number + total on line 1, customer + status pills on line 2, date muted) using a `hidden md:table` / `md:hidden` pair in the shared table helper in `src/components/admin/ui.tsx`. On desktop tighten padding (row height about 44 px), make the table the page's natural height rather than an inner scroller, and keep the thead sticky. Pin the first column on any remaining horizontal scroller.

### 5. Inventory bulk-save footer overlaps content and breaks on mobile
`18-inventory-desktop` shows a sticky footer ("Save counted stock") overlaying the last visible row, with a fixed-height scroll area and about 100 px of dead space below. On mobile (`18-inventory-mobile`) the footer card is rendered in the middle of the list (over the "Ibis Enamel Teapot" row), the COUNTED column is cut off at the right edge, and the "Low stock only" checkbox plus Apply sit awkwardly.
Fix in `src/app/admin/(panel)/inventory/page.tsx` and its table: make the footer `position: sticky; bottom: 0` of the page (not inside the table scroller) and reserve bottom padding. On mobile collapse to "Name / In stock / Counted input" and drop Category into a subline. Show which rows changed (highlight, "Save 3 changes", disabled when none) and a diff summary on save. Counted inputs show the current value as a placeholder, which looks empty; prefill the value or use clearer "Counted" label and "unchanged" state.

### 6. Destructive confirmations are inconsistent and weaker than the stakes
- Refund dialog (`09-refund-dialog-desktop`): good copy, but "Issue full refund" has no typed or checkbox confirmation, the restock checkbox default is unchecked without explanation of the consequence, and there is no partial refund. Unchecked restock after a refund is easy to forget.
- Archive dialog (`17-archive-dialog-desktop`): fine, but the page behind shows the "Archive" trigger as a low-emphasis outlined button at the page bottom, and the dialog does not show the affected count or a link to the restore flow.
- Users: `Disable` (`23-users-desktop`) sits inline in a row next to "Save" for role change; role change has no confirmation, and a role save is an underlined link that looks like navigation.
Fix: in `src/components/admin/ConfirmDialog.tsx` support `tone="danger"`, a required-reason or "type the order number" mode for refunds, default focus on Cancel, and a loading state. Add confirmations for Disable user and role changes. Turn the Users role "Save" link into a real small button that only appears after the select changes.

### 7. Form validation and save feedback (product form)
`15-product-new-errors-desktop`: errors show a top banner ("Check the highlighted fields.") plus per-field red text, but the banner does not link to the first invalid field, focus is not moved visibly in the shot, and the Slug field error shows "URL: /products/..." with no helpful text. The Price field shows "24.00" in red-bordered state but the error says "Enter a price", which is confusing (placeholder versus value). The sticky submit bar is not present; on long forms the primary button is at the page bottom only. The live preview shows an "Out of stock" badge and "$0.00" for a new draft, which is misleading. The skip-link and header also render overlapping in the screenshot (likely a full-page capture artifact, but confirm that the sticky header does not cover the form top on scroll).
Fix in `src/components/admin/ProductForm.tsx` and `useFieldErrors.ts`: focus the first invalid field, turn the banner into an error summary with anchor links, make the placeholder visibly different from entered values, auto-generate slug from name with an inline preview, add a sticky footer with Save and Cancel, warn on unsaved changes, and hide the stock badge in the preview until stock is entered.

### 8. Dashboard is KPI-heavy but not action-first
`03-dashboard-desktop`: six KPI cards then a large bar chart then lists. The most actionable items (orders to pack, low-stock, pending payments) are small links under numbers. "Pending payment 0" gets the same weight as revenue. The bar chart is tall (about 330 px) and has gaps with no zero-bars shown, no comparison with the previous period, no hover value visible in a static view. Low-stock rows show "Out" and "1 left" but not the quick action to restock. The sidebar also ends at y=900 in tall captures (it should be sticky and full height).
Fix in `src/app/admin/(panel)/page.tsx` and `RevenueChart.tsx`: put a "Needs attention" strip first (Unfulfilled N, Packed awaiting shipment N, Out of stock N), each a button linking to a pre-filtered list. Add delta versus the previous period on KPI cards. Reduce chart height to about 220 px, label the best day, and add a per-point tooltip and keyboard focus. Add "Adjust" links in the Low stock card. Make `AdminShell.tsx` sidebar `sticky top-0 h-dvh`.

### 9. Empty, error and loading states are thin
- Empty states (`07-orders-empty`, `13-products-empty`) are a single bold line plus a link inside a table with column headers still shown; DESIGN.md's `EmptyState` component (illustration, title, text, primary action) is not used. A first-run empty list (no products at all) needs "Create your first product".
- The "No orders" count text above the table duplicates the empty state.
- Error state: only the login error and the 403 are shown; there is no screenshot of a failed save, server error or toast. Login error banner is good but the password field is cleared with no focus indication, and the "5 tries / 15 min lockout" warning is shown on the very first failed attempt, which is alarming; show remaining attempts only after 2 fails.
- No loading skeletons visible (DESIGN.md `Skeleton`).
Fix: reuse `src/components/ui/EmptyState` in list pages, distinguish "no data yet" (primary action) from "no matches" (reset filters), add `loading.tsx` skeleton rows per admin route, and add a segment `error.tsx` with retry and reference id.

### 10. Navigation, orientation and small-screen chrome
- Mobile header (`05-orders-mobile`) shows only a hamburger, "Admin" and a role chip; the page you are on is not named in the bar, and Log out / View store are hidden in the drawer (`04-drawer-mobile`). Hamburger touch target looks under 44 px.
- Desktop: the order detail page (`08-order-packed-desktop`) puts "Packing slip" top right but the primary next step ("Mark as shipped") is a form in the right column below the fold on mobile (card order was already adjusted, but carrier and tracking are empty with no validation hint; shipping without tracking should warn).
- Audit log (`24-audit-desktop`): action codes are raw (`auth.login_failed`), Entity shows "AdminUser", no entity id link, details are 12 px text; 2 entries make the table look unfinished with a blank footer row.
- Customers and Users lists have no search, and Users has no pagination or invite status.
Fix: show the page title in the mobile top bar (`AdminShell.tsx`, `AdminDrawer.tsx`), enlarge the hamburger to 44 px, add breadcrumb plus "Next: Mark as shipped" prominence on `OrderForms.tsx`, humanise audit actions ("Failed sign-in") with a mapping and make entity ids links, and add search boxes to customers.

## Smaller notes
- Status pills (Paid, Packed, Shipped, Delivered) differ only by faint tints; Paid and Delivered are nearly identical green. Use an icon or a distinct hue per state; check the 4.5:1 contrast of the Shipped/Delivered pills against the tokens in DESIGN.md section 2.
- Numeric columns: Items and Total are right-aligned correctly; add `tabular-nums` to all money columns and keep the sort-arrow icons off non-sortable headers (PAYMENT, FULFILMENT, ITEMS, STATUS show none, which is correct, but the double-arrow "unsorted" icon on every sortable header adds visual noise).
- Order IDs wrap or truncate on narrow widths; keep `nowrap` (already fixed in commit 9cf085a for some screens).
- Export CSV sits top right with no indication that it respects the current filters; label it "Export 60 orders (CSV)".
- Dates are shown in UTC everywhere (stated in the intro). Fine for a demo, but add a tooltip with the relative time ("2 hours ago").
