# How to test Phase 1 at home

One action per step. Commands are for **PowerShell** in the project folder unless noted. Everything
runs on `localhost`; nothing is sent anywhere.

---

## 1. Fresh setup

1. **Do:** `git clone <your-repo-url> nile-goods; cd nile-goods` (or, in your existing copy:
   `git fetch` then continue).
   **Expect:** the project folder with `package.json`, `src/`, `prisma/`, `docs/`.
   **If not:** check the repo URL or that you are in the right folder (`dir` should list `package.json`).

2. **Do:** `git switch phase-1`
   **Expect:** `Switched to branch 'phase-1'`.
   **If not:** `git branch -a` to see branch names; the work is only on `phase-1`, not `main`.

3. **Do:** `npm install`
   **Expect:** ends with `found 0 vulnerabilities`, and `✔ Generated Prisma Client` (from `postinstall`).
   **If not:** if npm complains about install scripts, the approvals are in `package.json` → `allowScripts`
   (better-sqlite3, prisma, @prisma/engines, esbuild). Run `npm rebuild` once. If `better-sqlite3` fails
   to build, check that your Node version matches (Node 22+; developed on Node 26).

4. **Do:** `copy .env.example .env`
   **Expect:** `1 file(s) copied.`
   **If not:** make sure you are in the project root. The `.env` only contains local placeholders.

5. **Do:** `npx playwright install chromium`
   **Expect:** Chromium downloads (or "already installed").
   **If not:** network/proxy issue; only e2e, frames and Lighthouse need it.

6. **Do:** `npm run db:migrate`
   **Expect:** `Your database is now in sync with your schema.` and a new `prisma/dev.db`.
   **If not:** check `DATABASE_URL="file:./prisma/dev.db"` in `.env`; delete `prisma/dev.db` and retry.

7. **Do:** `npm run db:seed`
   **Expect:** `Seeded 4 categories and 24 products.` Running it again gives the same message (idempotent).
   **If not:** run step 6 first; seed data lives in `prisma/seed-data.ts`.

## 2. The full check

8. **Do:** `npm run verify`
   **Expect (takes ~3–4 minutes):**
   - ESLint and `tsc` print nothing.
   - Unit: `Test Files 3 passed (3)` and `Tests 30 passed (30)`.
   - Integration: `Test Files 2 passed (2)` and `Tests 32 passed (32)`.
   - `next build` succeeds.
   - E2E: `18 passed` (13 desktop + 5 mobile).
   - Axe: `13 passed`.

   **If not:**
   - If port 3100 is busy, close any old `next start` (Task Manager → Node.js) and re-run.
   - If an e2e test fails, open `playwright-report/index.html` for the trace and screenshot.
   - If integration fails, check that nothing has `prisma/test.db` open.

## 3. Click through every feature (desktop)

9. **Do:** `npm run dev`, then open http://localhost:3000 in Chrome.
   **Expect:** the Nile Goods home page: hero with "Well-made things for slow, everyday living", category tiles,
   "Chosen for everyday use", the trust strip and "A little less, for a little while" (sale).
   **If not:** read the terminal output; a database error means steps 6–7 were skipped.

10. **Do:** scroll down a little.
    **Expect:** the header stays on top and gains a soft shadow.
    **If not:** `src/components/layout/SiteHeader.tsx` (scroll listener).

11. **Do:** click **Shop the collection**.
    **Expect:** `/products`, "Showing 1–12 of 24 products", a 4-column grid, and pagination 1 · 2.
    **If not:** `src/app/products/(catalog)/page.tsx`.

12. **Do:** click page **2**.
    **Expect:** the URL has `?page=2` and the count reads "Showing 13–24 of 24 products".
    **If not:** `src/components/ui/Pagination.tsx`.

13. **Do:** click the **Kitchen** chip.
    **Expect:** the URL is `?category=kitchen`, "6 products", and the heading is "Kitchen". Skeleton cards
    flash briefly while loading.
    **If not:** `src/components/catalog/CatalogControls.tsx`.

14. **Do:** type `kettle` in the Search box.
    **Expect:** after a short pause the URL gains `&q=kettle` and one product is shown. The heading is
    `Results for "kettle"`.
    **If not:** search is debounced (350 ms); press Enter to submit immediately.

15. **Do:** clear the search (×), then pick **Sort by → Price: high to low**.
    **Expect:** the Delta Pour-Over Kettle is first and the Basalt Stoneware Mug is last; the URL has
    `sort=price-desc`.
    **If not:** `src/lib/catalog.ts` (`sortOrder`).

16. **Do:** copy the URL, open it in a new tab.
    **Expect:** the same filter, sort and page (all state is in the URL).
    **If not:** `src/lib/schemas.ts` (`catalogQuerySchema`).

17. **Do:** open **Sahel Salad Bowl**.
    **Expect:** breadcrumbs `Home › Shop › Kitchen › Sahel Salad Bowl`, a large illustration, $44.00,
    "In stock", a quantity stepper, Add to cart, three benefits, Details, and "You may also like" (4 items).
    **If not:** `src/app/products/[slug]/page.tsx`.

18. **Do:** press **+** once, then **Add to cart**.
    **Expect:** the button shows a spinner and "Adding…", then "✓ Added". A toast "Added to cart · 2 × Sahel
    Salad Bowl" appears with **View cart**, the bag icon badge shows **2** with a small bump, and the page
    does not reload.
    **If not:** `src/components/product/AddToCart.tsx`, `src/app/actions/cart.ts`.

19. **Do:** open **Tide Wool Throw**.
    **Expect:** the sale price $96.00 in clay colour, $128.00 struck through, "You save $32.00", and a
    "Sale −25%" badge.
    **If not:** `src/components/ui/Price.tsx`.

20. **Do:** click **View cart** in the toast, or the bag icon.
    **Expect:** `/cart` with the line items, the Order summary (subtotal, shipping "Free" over $50, total),
    and a disabled **Checkout coming in Phase 2** button.
    **If not:** `src/components/cart/CartView.tsx`.

21. **Do:** press **+** on a cart line.
    **Expect:** the quantity, line total, subtotal and header badge update instantly.
    **If not:** check the browser console; the server action is `updateCartItemAction`.

22. **Do:** press **F5**.
    **Expect:** the cart is unchanged after the reload.
    **If not:** DevTools → Application → Cookies: `ng_cart` should exist (HttpOnly ✓, SameSite Lax, expires
    in 30 days).

23. **Do:** click **Remove** on a line.
    **Expect:** the line disappears, totals update, and a toast "Removed from cart" appears with **Undo**.
    **If not:** `removeCartItemAction`.

24. **Do:** click **Undo** in the toast.
    **Expect:** the line comes back with its quantity, and a toast says "Item restored".
    **If not:** `restoreCartItemAction`.

25. **Do:** remove every line.
    **Expect:** "Your cart is empty" with a **Start shopping** button; the badge disappears.
    **If not:** `EmptyState` in `CartView.tsx`.

26. **Do:** open http://localhost:3000/info and click a footer link (e.g. **Returns**).
    **Expect:** the Help & about page scrolls to that section. All copy is marked as demo copy.
    **If not:** `src/app/info/page.tsx`.

## 4. Phone layout (Chrome DevTools device mode, 390 px)

27. **Do:** press **F12** → **Toggle device toolbar** (Ctrl+Shift+M) → set the width to **390**, then reload.
    **Expect:** a header with ☰ menu, wordmark, search icon and bag; a 2-column product grid; no sideways
    scrolling.
    **If not:** look for an element wider than the screen in the Elements panel.

28. **Do:** tap **☰**.
    **Expect:** a drawer slides in from the left with search, Shop links and More links; the page behind is
    dimmed.
    **If not:** `src/components/layout/MobileMenu.tsx`.

29. **Do:** tap **×** (or press Esc).
    **Expect:** the drawer closes and focus returns to ☰.
    **If not:** same file (`onCancel` / `onClose`).

30. **Do:** go to `/products` and tap **Filters**.
    **Expect:** a bottom sheet with Category and Sort-by radio lists, **Reset** and **Show results**.
    **If not:** `FilterSheet` in `CatalogControls.tsx`.

31. **Do:** choose **Bags** and **Price: low to high**, then tap **Show results**.
    **Expect:** the sheet closes, the URL has `category=bags&sort=price-asc`, "6 products", and the Filters
    button shows **2**.
    **If not:** same component.

32. **Do:** open any in-stock product and tap **Add to cart**.
    **Expect:** a full-width button, a toast at the bottom of the screen and the badge updates.
    **If not:** `AddToCart.tsx`.

33. **Do:** open the cart.
    **Expect:** each line shows the image, name, price, stepper, bin icon and line total on one row; the order
    summary is below.
    **If not:** `CartLineRow` in `CartView.tsx`.

## 5. Keyboard only

34. **Do:** load http://localhost:3000 and press **Tab** once.
    **Expect:** a "Skip to content" button appears top-left; press **Enter** and focus jumps to the main content.
    **If not:** the skip link is in `src/app/layout.tsx`.

35. **Do:** keep pressing **Tab** through the header, hero and product cards.
    **Expect:** every stop has a visible green focus ring, in a logical left-to-right, top-to-bottom order.
    **If not:** `:focus-visible` styles in `src/app/globals.css`.

36. **Do:** Tab to a product card and press **Enter**.
    **Expect:** the product page opens.
    **If not:** `ProductCard.tsx` (the whole card is one link).

37. **Do:** Tab to **+**, press **Enter**, Tab to **Add to cart**, press **Enter**.
    **Expect:** the quantity becomes 2, then the toast appears and the badge updates.
    **If not:** `QuantityStepper.tsx` / `AddToCart.tsx`.

38. **Do:** Tab to the bag icon and press **Enter**; in the cart, Tab to a stepper and to **Remove**.
    **Expect:** everything is reachable and operable with Enter or Space.
    **If not:** `CartView.tsx`.

## 6. Cart persistence across a browser restart

39. **Do:** add two products to the cart.
    **Expect:** the badge shows the count.
    **If not:** see steps 18–21.

40. **Do:** close Chrome completely (all windows; check the tray), then reopen http://localhost:3000/cart.
    **Expect:** the same cart.
    **If not:** Chrome may be set to "Clear cookies when you close all windows" (Settings → Privacy). The
    cookie itself is a persistent 30-day cookie.

## 7. Edge cases

41. **Do:** open `/products/delta-pour-over-kettle` (stock 2), press **+** until it stops, then **Add to cart**
    twice.
    **Expect:** **+** disables at 2. The second add shows "Only 2 available…" and the cart keeps 2.
    **If not:** `clampQuantity` in `src/lib/cart/math.ts`.

42. **Do:** open `/products/lumen-table-lamp`.
    **Expect:** an "Out of stock" badge and a disabled **Out of stock** button.
    **If not:** `AddToCart.tsx`.

43. **Do:** open http://localhost:3000/products/made-up-thing and http://localhost:3000/anything.
    **Expect:** the styled 404 page "This page wandered off the shelf" (DevTools → Network shows status
    **404**).
    **If not:** `src/app/not-found.tsx`.

44. **Do:** search for `zebra`.
    **Expect:** "Nothing matches that, yet", category links and a **Reset filters** button.
    **If not:** the empty state in `src/app/products/(catalog)/page.tsx`.

45. **Do:** open `/products?sort=evil&page=-3`.
    **Expect:** the normal catalog (bad values fall back to defaults), not an error.
    **If not:** `catalogQuerySchema` in `src/lib/schemas.ts`.

## 8. Production build

46. **Do:** stop the dev server (Ctrl+C), then run `npm run build`.
    **Expect:** "Compiled successfully" and a route table where every page is `ƒ (Dynamic)`.
    **If not:** fix the reported TypeScript or ESLint error, then re-run.

47. **Do:** `npm start`, open http://localhost:3000, and repeat steps 11, 18, 20 and 43 quickly.
    **Expect:** the same behaviour, a little faster.
    **If not:** make sure the dev server is stopped (port 3000).

## 9. Review the demo frames

48. **Do:** open `E:\handoff\ecommerce_phase1\` in Explorer.
    **Expect:**
    - `desktop\` holds 54 PNGs (1280×720) and `mobile\` holds 64 PNGs (390×844).
    - `storyboard.json` (file, step, caption, duration) and `review\` (28 screenshots) are there.
    - `lighthouse\` holds the HTML reports.

    **If not:** regenerate with `npm run build` then `npm run frames`, and copy `evidence\phase1\*` again.

49. **Do:** flip through `desktop\0017.png`–`0029.png`.
    **Expect:** the add-to-cart moment frame by frame: the button loading, the toast sliding in, the badge
    bumping.
    **If not:** captions in `storyboard.json` say what each frame should show.

## 10. What to send to Claude (chat)

50. **Do:** send:
    - `docs/PHASE1_REPORT.md`
    - screenshots of anything that looked wrong, with the step number
    - a line confirming the frames are in `E:\handoff\ecommerce_phase1`, and whether you want any frames
      re-shot

    **Expect:** Claude assembles the video from the storyboard and fixes any issues.

## 11. Git: review, then push and merge yourself

51. **Do:** `git log --oneline main..phase-1`
    **Expect:** about 18 small commits from "chore: tooling…" to "docs: …".
    **If not:** make sure you are on `phase-1`.

52. **Do:** `git diff --stat main..phase-1`, then browse files with `git diff main..phase-1 -- src/`.
    **Expect:** only project files; no `.env`, no `*.db`, no `evidence/`.
    **If not:** tell Claude before pushing.

53. **Do (when happy, these are for you to run):**
    ```powershell
    git remote add origin <your-repo-url>     # once, if not set
    git push -u origin main
    git push -u origin phase-1
    # then open a pull request phase-1 → main on your Git host, or merge locally:
    git switch main
    git merge --no-ff phase-1
    git push
    ```
    **Expect:** the branch on your remote; `main` contains Phase 1 after the merge.
    **If not:** authentication problems are between Git and your host (use `gh auth login` or a token).

---

## Known limitations in Phase 1

- No checkout, payments, orders or accounts. The checkout button is intentionally disabled.
- Stock is not reserved or decremented by carts; Phase 2 checkout must re-validate everything server-side.
- SQLite only, with a single local file. Search is a case-insensitive name match (no ranking or
  descriptions); Phase 4 moves to Postgres.
- No rate limiting on cart actions (localhost demo). It is planned at the proxy in Phase 4, and
  `npm run db:prune-carts` removes idle carts.
- The CSP still allows `'unsafe-inline'` scripts (needed for Next.js bootstrap without nonces).
- Light theme only (the warm palette is the brand); no dark mode.
- Lighthouse Performance with the default mobile preset is 70–82 on the development laptop (91–93 when
  calibrated for its slow CPU). See `docs/reviews/lighthouse.md`.
- Shipping, returns and "secure checkout" promises are demo copy.
