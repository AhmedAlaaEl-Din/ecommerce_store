# How to test Phase 3 at home

Phase 3 adds the admin panel. Each step has one action, then what you should see. Commands are for
**Git Bash** in the project folder (`cd /e/ecommerce_store`). Everything runs on `localhost` with the mock
payment provider; nothing needs keys or accounts.

---

## Main path (about 10 steps)

1. **Do:** `git switch phase-3`
   - **Expect:** `Switched to branch 'phase-3'`.

2. **Do:** `npm install`
   - **Expect:** it finishes and prints `Generated Prisma Client`. New packages: `sharp` (images) and
     `@node-rs/argon2` (password hashing).

3. **Do:** `npm run db:migrate`
   - **Expect:** `Your database is now in sync with your schema.` (adds the `admin_panel` migration).

4. **Do:** `npm run db:seed`
   - **Expect:** the seed finishes without errors. It also creates two demo admin accounts.

5. **Do:** `npm run db:seed:history`
   - **Expect:** a line saying about 60 demo orders were created. This makes the dashboard look busy.

6. **Do:** open the file `var/demo-credentials.txt` (for example `cat var/demo-credentials.txt`).
   - **Expect:** two lines: `admin@example.com <password> (admin)` and `staff@example.com <password> (staff)`.
   - The passwords are random and exist only in this file. It is git-ignored. Never paste it anywhere.

7. **Do:** `npm run dev`, then open http://localhost:3000/admin/login and sign in as the admin.
   - **Expect:** the dashboard: KPI cards, a 30-day revenue chart, recent orders and low-stock products.
   - **If login fails:** check you copied the password from `var/demo-credentials.txt` exactly.

8. **Do:** open **Orders**, open an order marked Paid / Unfulfilled, press **Mark as packed**, then
   **Mark as shipped** with a carrier and tracking number.
   - **Expect:** a timeline event for each step. Open the customer link (`/order/...`): the progress bar
     shows "Shipped" with your tracking number. A "Your order has shipped" email appears in `/dev/outbox`.

9. **Do:** open **Products** → **New product**. Fill in the form, choose a JPEG/PNG/WebP image, save.
   - **Expect:** the product appears in the storefront with your image (resized, no EXIF).
   - Try a text file renamed to `.png`: it is rejected.

10. **Do:** open **Inventory**, adjust a product's stock (reason + note), then open its history.
    - **Expect:** a movement row; the movements add up to the stock number.
    Then refund a paid order (**Orders** → order → **Refund**, confirm). **Expect:** status Refunded and a
    "Refund issued" email in the outbox. Finally open **Audit log**: every change above is listed.

## Optional extra checks

11. **Staff role:** sign out, sign in as `staff@example.com`. **Expect:** no Categories, Users or Audit log
    in the menu; opening `/admin/users` shows a 403 page; no Refund, Archive or Export buttons.
12. **Lockout:** enter a wrong password 5 times for `staff@example.com`. **Expect:** the same generic error
    each time, then the account is locked for 15 minutes. (Re-run `npm run db:seed` to clear it.)
13. **Logout kills the session:** sign out, press Back. **Expect:** you land on the login page.
14. **Mobile:** narrow the browser to 390 px. **Expect:** a menu button opens the sidebar as a drawer.
15. **Create an account:** `npm run admin:create -- --email someone@example.com --role admin`.
    **Expect:** a one-time random password printed once in the terminal.
16. **Full check:** `npm run verify` (about 8 minutes). **Expect:** see the counts in
    `docs/PHASE3_REPORT.md`.
17. **Demo frames:** `npm run build`, then `npm run frames:phase3`. **Expect:** frames in `evidence/phase3/`.

## Publishing the work

When you are happy, run these yourself (nothing was pushed or merged for you):

```
git push -u origin phase-3
git switch main
git merge phase-3 --no-edit
git push
```
