# How to test Phase 2 at home

Phase 2 adds checkout, orders and payments. Each step has one action, then what you should see, then
what to do if you don't. Commands are for **Git Bash** in the project folder (`cd /e/ecommerce_store`).

Everything runs on `localhost`. Part 1 uses the **mock** payment provider and needs no keys or accounts.
Part 3 (Stripe test mode) is optional.

---

## 1. Setup and the full check

1. **Do:** `git status`
   - **Expect:** `On branch main` (or `phase-2`) and a clean working tree.
   - **If not:** commit or stash your own changes first (`git stash`).

2. **Do:** `git switch phase-2`
   - **Expect:** `Switched to branch 'phase-2'`.
   - **If not:** run `git branch` to list branches. The Phase 2 work is only on `phase-2`.

3. **Do:** `npm install`
   - **Expect:** it finishes and prints `✔ Generated Prisma Client`. Phase 2 adds the `stripe` package
     (23.2.0). It is used offline in tests.
   - **If not:** run `npm rebuild` once, then retry.

4. **Do:** `cp .env.example .env` if you have no `.env` yet. If you already have one, add the new lines
   from `.env.example`: `APP_URL`, `PAYMENT_PROVIDER`, `ALLOW_MOCK_PAYMENTS`, `MOCK_WEBHOOK_SECRET`,
   `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
   - **Expect:** `.env` contains `PAYMENT_PROVIDER="mock"` and `APP_URL="http://localhost:3000"`.
   - **If not:** copy the "Phase 2: payments" block from `.env.example` by hand.

5. **Do:** `npm run db:migrate`
   - **Expect:** `Your database is now in sync with your schema.` This applies two new migrations:
     `orders_and_payments` and `order_fulfilment_note`.
   - **If not:** delete `prisma/dev.db` and run the command again.

6. **Do:** `npm run db:seed`
   - **Expect:** `Seeded 4 categories and 24 products.` Seeding also resets stock to the seed values.
   - **If not:** run step 5 first.

7. **Do:** `npm run verify`
   - **Expect** (about 4–5 minutes):
     - ESLint and `tsc` print nothing.
     - Unit tests: `Test Files 7 passed (7)` and `Tests 74 passed (74)`.
     - Integration tests: `Test Files 3 passed (3)` and `Tests 65 passed (65)`. These include a race
       between two separate processes for the last unit.
     - `next build` succeeds.
     - E2E: `35 passed` (29 desktop and 6 mobile).
     - Axe: `15 passed`.
   - **If not:**
     - **Port 3100 busy:** close any old `next start` (Task Manager → Node.js) and run it again.
     - **An E2E test fails:** open `playwright-report/index.html` for the trace.

## 2. A full purchase with the mock provider

8. **Do:** `npm run dev`, then open http://localhost:3000.
   - **Expect:** the store, as in Phase 1. The terminal prints `[payments] provider: mock`.
   - **If not:** check that `.env` has `PAYMENT_PROVIDER="mock"`. In development the mock needs no secret.

9. **Do:** add the **Sahel Salad Bowl** and the **Tide Wool Throw** to the cart, then open the cart.
   - **Expect:**
     - The button now says **Checkout** (with a shield icon) and is active.
     - The note below says "mock or test-mode payments only".
   - **If not:** hard-refresh the page (Ctrl+F5).

10. **Do:** click **Checkout**.
    - **Expect:**
      - A dark ribbon reads "Demo mode: mock payments. No real payment provider is used."
      - The form is on the left, with **Contact** and **Shipping address**.
      - The order summary is on the right, with a "Sale savings" row, Shipping "Free" and Total $140.00.
    - **If not:** if you land back on the cart, the cart was empty.

11. **Do:** click **Continue to payment** without filling anything in.
    - **Expect:**
      - A red box "Please check 6 fields:" appears with links to each field, and focus moves to it.
      - Each field shows its message underneath.
    - **If not:** report it.

12. **Do:** type an email such as `mona@example`, without `.com`.
    - **Expect:** that field's red error disappears as soon as you type.
    - **If not:** report it.

13. **Do:** fill in the rest with demo data: Mona Example, 12 Reed Lane, Delta Town, `DT 1024`, country
    **Nilera**. Then click **Continue to payment**.
    - **Expect:**
      - The server rejects the email ("Please enter a valid email address…").
      - Everything you typed stays, including the country.
    - **If not:** report it.

14. **Do:** fix the email to `mona@example.com` and click **Continue to payment**.
    - **Expect:**
      - The **Mock payment page**, with the banner "Mock payment page. No real payment provider is used."
      - The total, order number `NG-2026-000001` and the lines are shown.
      - Three choices: Pay, Decline, Cancel.
    - **If not:** check the terminal for `[checkout]` lines.

15. **Do:** click **Pay $140.00 (test success)**.
    - **Expect:**
      - "Confirming your payment…" for about 1.5 seconds. The page checks every 2 seconds.
      - Then "Thank you, Mona." with the order number, items, totals and shipping address.
      - The cart badge disappears.
    - **If not:** if it stays on "Confirming…", look at the terminal for `[webhook]` lines.

16. **Do:** refresh the thank-you page (F5).
    - **Expect:** the same order, still paid. Refreshing is safe and nothing is charged twice.
    - **If not:** report it.

17. **Do:** open http://localhost:3000/dev/outbox
    - **Expect:**
      - A list with "Order NG-2026-000001 confirmation". **Open email** shows the confirmation.
      - The email has a banner "Demo email written to a local file. Nothing was sent."
      - The files are in `var/outbox/`, which git ignores.
    - **If not:** the page is development-only. It returns 404 under `npm start` by design.

18. **Do:** add the **Basalt Stoneware Mug**, check out with demo details, and on the mock page click
    **Decline (test failure)**.
    - **Expect:**
      - You are back on checkout with "Your payment was declined. Nothing was charged and your details are
        saved below."
      - The form is still filled in, and the button reads **Try payment again · $24.95**.
    - **If not:** report it.

19. **Do:** click **Try payment again**, then on the mock page click **Cancel and return to checkout**.
    - **Expect:** "Payment cancelled." The form is still filled in, and the mug's stock is released.
    - **If not:** report it.

## 3. Stripe test mode (optional, needs your own sandbox keys)

> **Warning:**
>
> - Use **test keys only**: `sk_test_…` and `pk_test_…`, never live keys. The app refuses to start with
>   a key that isn't a test key.
> - **Never commit `.env`.** Git ignores it.
> - Nothing in this part costs money. Stripe test cards are fake.

20. **Do:** sign in to https://dashboard.stripe.com, switch to a **Sandbox**/test mode, and open
    **Developers → API keys**.
    - **Expect:** a **Secret key** starting with `sk_test_`. Click "Reveal" to see it.
    - **If not:** make sure the test-mode toggle or sandbox is selected, not live mode.

21. **Do:** install the Stripe CLI for Windows: download the latest `stripe_X.Y.Z_windows_x86_64.zip`
    from https://github.com/stripe/stripe-cli/releases and unzip it to a folder (for example
    `C:\tools\stripe`). Then run `/c/tools/stripe/stripe.exe --version` in Git Bash.
    - **Expect:** a version number.
    - **If not:** with Scoop, `scoop install stripe` also works.

22. **Do:** `/c/tools/stripe/stripe.exe login`
    - **Expect:** a browser window asks you to allow access. Afterwards the CLI says it is configured
      for your account.
    - **If not:** copy the pairing link it prints into your browser.

23. **Do:** in a second Git Bash window run:
    `/c/tools/stripe/stripe.exe listen --forward-to localhost:3000/api/webhooks/payments`
    - **Expect:** `Ready! Your webhook signing secret is whsec_…`. Keep this window open.
    - **If not:** check that you are logged in (step 22).

24. **Do:** edit `.env` and set these three lines, using your own values:

    ```
    PAYMENT_PROVIDER="stripe"
    STRIPE_SECRET_KEY="sk_test_..."        # from step 20
    STRIPE_WEBHOOK_SECRET="whsec_..."      # from step 23
    ```

    Then restart `npm run dev`.
    - **Expect:**
      - The terminal prints `[payments] provider: stripe`.
      - The checkout page no longer shows the demo ribbon. The note under the button mentions Stripe's
        checkout page in test mode.
    - **If not:** the server stops at startup with a clear message if a key is missing or isn't a test
      key. Fix `.env` and restart.

25. **Do:** buy something and pay on Stripe's page with card `4242 4242 4242 4242`, any future date, any
    CVC and any postcode.
    - **Expect:**
      - You return to "Confirming your payment…" and then "Thank you".
      - The `stripe listen` window shows `checkout.session.completed` with `[200]`.
      - An outbox email is written.
    - **If not:** if the webhook shows `[400]`, `STRIPE_WEBHOOK_SECRET` doesn't match the secret that
      `stripe listen` printed.

26. **Do:** try again with `4000 0000 0000 0002`.
    - **Expect:** Stripe shows "Your card was declined" on its own page. You can try another card, or
      click the back arrow to return to our checkout. That cancels the order and releases the stock.
    - **If not:** report it.

27. **Do:** try `4000 0025 0000 3155`.
    - **Expect:** Stripe shows a 3-D Secure test window. **Complete** returns you to "Thank you". **Fail**
      keeps you on Stripe's page with an error.
    - **If not:** report it.

28. **Do:** when you are done, set `PAYMENT_PROVIDER="mock"` again in `.env` and restart.
    - **Expect:** the mock ribbon is back.
    - **If not:** check `.env`.

## 4. Edge cases

29. **Do:** two windows race for the last item.
    - Open a normal window and an InPrivate/Incognito window.
    - In both, add the **Atlas Fountain Pen** (only 1 left) and go to checkout.
    - Fill in both forms. In window A click Continue (you reach the mock page). Then click Continue in
      window B.
    - **Expect:**
      - Window B lands on the cart with "Sorry, the Atlas Fountain Pen sold out while you were checking
        out." The pen is removed from B's cart, and the badge is empty.
      - Window A can still pay.
    - **If not:** report it.

30. **Do:** test an expired reservation.
    - Start a checkout, reach the mock page, then close the tab.
    - Wait 31 minutes, or edit the order's `reservedUntil` in Prisma Studio (`npx prisma studio`) to a
      past time.
    - Then run `npm run orders:expire`.
    - **Expect:** `Expired 1 pending order(s) and released their stock.` The order page then says "This
      checkout timed out".
    - **If not:** run the command again. It only touches orders whose reservation has passed.

31. **Do:** press the browser Back button on the mock page, then submit the checkout again.
    - **Expect:** a new mock page. The earlier pending order is cancelled automatically, and stock is
      only held once.
    - **If not:** report it.

32. **Do:** open `http://localhost:3000/order/` followed by any 32 made-up characters.
    - **Expect:** the 404 page. Orders can only be opened with their own long random link.
    - **If not:** report it.

## 5. Production build with the mock

33. **Do:** run the production build with mock payments:
    ```bash
    npm run build
    ALLOW_MOCK_PAYMENTS=true MOCK_WEBHOOK_SECRET=$(openssl rand -hex 32) npm start
    ```
    - **Expect:**
      - http://localhost:3000 works and checkout uses the mock.
      - Plain `npm start`, without those two variables, stops at startup with "The mock payment provider
        is disabled in production…". This is on purpose.
    - **If not:** `openssl` ships with Git Bash. Any long random string works as the secret.

## 6. Review the evidence

34. **Do:** open `E:\handoff\ecommerce_phase1\phase2_evidence\`.
    - **Expect:**
      - `desktop/` (31 frames) and `mobile/` (33 frames).
      - `storyboard.json`, whose captions say "mock payment".
      - `review/` (23 screenshots) and `lighthouse/` (before and after reports).
    - **If not:** run `npm run frames:phase2` after `npm run build`.

## 7. What to send to Claude, and git

35. **Do:** if something failed, send:
    - The step number.
    - What you saw (a screenshot).
    - The last 20 lines of the terminal.
    - For E2E failures, the failing test name from `playwright-report`.

    Never paste your `.env` or any key.
    - **Expect:** n/a.
    - **If not:** n/a.

36. **Do (when happy, these are for you to run in Git Bash):**
    ```bash
    git switch phase-2
    git push -u origin phase-2
    git switch main
    git merge --no-edit phase-2
    git push
    ```
    - **Expect:** `phase-2` is on GitHub, and `main` contains Phase 2 after the merge.
    - **If not:** if Git asks you to sign in, sign in to GitHub in the browser window it opens.
