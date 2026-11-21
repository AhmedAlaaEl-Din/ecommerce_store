import { expect, test } from "@playwright/test";
import {
  addToCart,
  fillCheckout,
  goToMockPay,
  MONA,
  outboxFiles,
  stockOf,
} from "./support/checkout";

// Each test buys a different product so parallel tests never share stock.

test.describe("checkout with the mock provider", () => {
  test("full purchase: confirming → thank you, cart cleared, stock reduced, outbox email written", async ({
    page,
  }) => {
    const before = await stockOf("market-glass-carafe");
    await addToCart(page, "market-glass-carafe", 2);
    await page.goto("/cart");
    await page.getByTestId("checkout").click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByTestId("demo-ribbon")).toContainText("Demo mode: mock payments");
    await expect(page.getByTestId("checkout-summary")).toContainText("Market Glass Carafe");

    await fillCheckout(page);
    await page.getByTestId("place-order").click();
    await expect(page).toHaveURL(/\/mock-pay\//);
    // Stock is reserved as soon as the order exists.
    expect(await stockOf("market-glass-carafe")).toBe(before - 2);
    const amount = await page.getByTestId("mock-amount").textContent();

    await page.getByTestId("mock-pay").click();
    await expect(page).toHaveURL(/\/order\/[A-Za-z0-9_-]{32}$/);
    await expect(page.getByRole("heading", { name: "Confirming your payment…" })).toBeVisible();
    await expect(page.getByTestId("order-paid")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you, Mona.");
    const orderNumber = (await page.getByTestId("order-number").textContent())!;
    expect(orderNumber).toMatch(/^NG-\d{4}-\d{6}$/);
    await expect(page.getByTestId("order-total")).toHaveText(amount!);
    await expect(page.getByTestId("order-lines")).toContainText("Market Glass Carafe × 2");
    await expect(page.getByTestId("order-address")).toContainText("12 Reed Lane");
    await expect(page.getByTestId("order-address")).toContainText("Egypt");
    await expect(page.getByTestId("cart-count")).toHaveCount(0); // badge hidden at 0

    // Refreshing the success page is safe and shows the same order.
    await page.reload();
    await expect(page.getByTestId("order-number")).toHaveText(orderNumber);

    expect(await stockOf("market-glass-carafe")).toBe(before - 2);
    expect(outboxFiles(orderNumber)).toHaveLength(1);

    await page.goto("/cart");
    await expect(page.getByTestId("empty-cart")).toBeVisible();
  });

  test("decline returns to the filled form with a message and releases the stock", async ({
    page,
  }) => {
    const before = await stockOf("reed-linen-cushion");
    await addToCart(page, "reed-linen-cushion");
    await goToMockPay(page, { email: "omar@example.com", name: "Omar Example" });
    expect(await stockOf("reed-linen-cushion")).toBe(before - 1);

    await page.getByTestId("mock-decline").click();
    await expect(page).toHaveURL(/\/checkout\?order=.+&status=failed$/);
    await expect(page.getByTestId("checkout-notice")).toContainText("Your payment was declined.");
    await expect(page.getByLabel("Email")).toHaveValue("omar@example.com");
    await expect(page.getByLabel("Full name")).toHaveValue("Omar Example");
    await expect(page.getByLabel("Country")).toHaveValue("EG");
    expect(await stockOf("reed-linen-cushion")).toBe(before);
    await expect(page.getByTestId("cart-count")).toHaveText("1"); // cart kept

    // Trying again works.
    await expect(page.getByTestId("place-order")).toContainText("Try payment again");
    await page.getByTestId("place-order").click();
    await page.getByTestId("mock-pay").click();
    await expect(page.getByTestId("order-paid")).toBeVisible({ timeout: 15_000 });
  });

  test("going back and submitting again replaces the pending order (no double hold)", async ({
    page,
  }) => {
    const before = await stockOf("felucca-weekender-duffel");
    await addToCart(page, "felucca-weekender-duffel", 2);
    await goToMockPay(page);
    expect(await stockOf("felucca-weekender-duffel")).toBe(before - 2);
    await page.goBack();
    await expect(page).toHaveURL(/\/checkout$/);
    await fillCheckout(page);
    await page.getByTestId("place-order").click();
    await expect(page).toHaveURL(/\/mock-pay\//);
    expect(await stockOf("felucca-weekender-duffel")).toBe(before - 2);
  });

  test("cancel returns to the filled form and releases the stock", async ({ page }) => {
    const before = await stockOf("caravan-canvas-tote");
    await addToCart(page, "caravan-canvas-tote");
    await goToMockPay(page);
    await page.getByTestId("mock-cancel").click();
    await expect(page).toHaveURL(/\/checkout\?order=.+&status=cancelled$/);
    await expect(page.getByTestId("checkout-notice")).toContainText("Payment cancelled.");
    await expect(page.getByLabel("Street address")).toHaveValue(MONA.addressLine1);
    expect(await stockOf("caravan-canvas-tote")).toBe(before);
  });

  test("validation errors are listed, focused, shown inline, and keep what was typed", async ({
    page,
  }) => {
    await addToCart(page, "ledger-desk-planner");
    await page.goto("/checkout");
    await page.getByTestId("place-order").click();
    const summary = page.getByTestId("checkout-error");
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("listitem")).toHaveCount(6);
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

    // Errors disappear as the fields are edited...
    await fillCheckout(page, { email: "mona@", postalCode: "!!" });
    await expect(summary).toBeHidden();
    await expect(page.getByLabel("Email")).not.toHaveAttribute("aria-invalid", "true");
    // ...and the server checks again on submit; typed values survive the round trip.
    await page.getByTestId("place-order").click();
    await expect(summary.getByRole("listitem")).toHaveCount(2);
    await expect(page.locator("#checkout-email-error")).toHaveText(
      "Please enter a valid email address, like name@example.com.",
    );
    await expect(page.getByLabel("Full name")).toHaveValue(MONA.name);
    await expect(page.getByLabel("Town or city")).toHaveValue(MONA.city);
    await expect(page.getByLabel("Country")).toHaveValue("EG");

    await page.getByLabel("Email").fill(MONA.email);
    await page.getByLabel("Postal code").fill(MONA.postalCode);
    await page.getByTestId("place-order").click();
    await expect(page).toHaveURL(/\/mock-pay\//);
  });

  test("inputs use the right types and autocomplete tokens", async ({ page }) => {
    await addToCart(page, "sketch-pencil-cup");
    await page.goto("/checkout");
    const expectations: Array<[string, string, string | null]> = [
      ["Email", "email", "email"],
      ["Full name", "shipping name", null],
      ["Street address", "shipping address-line1", null],
      ["Apartment, suite, etc. (optional)", "shipping address-line2", null],
      ["Town or city", "shipping address-level2", null],
      ["Postal code", "shipping postal-code", null],
    ];
    for (const [label, autocomplete, type] of expectations) {
      const input = page.getByLabel(label);
      await expect(input).toHaveAttribute("autocomplete", autocomplete);
      if (type) await expect(input).toHaveAttribute("type", type);
    }
    await expect(page.getByLabel("Country")).toHaveAttribute(
      "autocomplete",
      "shipping country-name",
    );
  });

  test("an item that sells out between cart and checkout sends the shopper back to the cart", async ({
    browser,
  }) => {
    // Two shoppers want the last Atlas Fountain Pen (stock 1).
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await addToCart(a, "atlas-fountain-pen");
    await addToCart(b, "atlas-fountain-pen");

    // B is already on the checkout page and has filled it in...
    await b.goto("/checkout");
    await fillCheckout(b, { email: "omar@example.com" });

    // ...when A reaches the payment page first: the pen is now reserved for A.
    await goToMockPay(a);
    expect(await stockOf("atlas-fountain-pen")).toBe(0);

    // B submits.
    await b.getByTestId("place-order").click();
    await expect(b).toHaveURL(/\/cart\?adjusted=/);
    await expect(b.getByTestId("stock-adjusted")).toContainText(
      "Sorry, the Atlas Fountain Pen sold out while you were checking out.",
    );
    await expect(b.getByTestId("cart-count")).toHaveCount(0); // badge matches the empty cart
    await expect(b.getByTestId("stock-adjusted")).toContainText(
      "Atlas Fountain Pen: sold out, removed",
    );
    await expect(b.getByTestId("empty-cart")).toBeVisible();

    // A cancels: the pen is available again.
    await a.getByTestId("mock-cancel").click();
    await expect(a).toHaveURL(/status=cancelled/);
    expect(await stockOf("atlas-fountain-pen")).toBe(1);
    await a.context().close();
    await b.context().close();
  });

  test("keyboard only: checkout form → mock pay → thank you", async ({ page }) => {
    await addToCart(page, "scribe-linen-notebook");
    await page.goto("/checkout");
    await page.getByLabel("Email").focus();
    await page.keyboard.type(MONA.email);
    await page.keyboard.press("Tab"); // → Full name
    await page.keyboard.type(MONA.name);
    await page.keyboard.press("Tab");
    await page.keyboard.type(MONA.addressLine1);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab"); // skip optional line 2
    await page.keyboard.type(MONA.city);
    await page.keyboard.press("Tab");
    await page.keyboard.type(MONA.postalCode);
    await page.keyboard.press("Tab"); // → Country
    await expect(page.getByLabel("Country")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByLabel("Country")).not.toHaveValue("");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("place-order")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/mock-pay\//);
    for (let i = 0; i < 30; i++) {
      if (await page.getByTestId("mock-pay").evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(page.getByTestId("mock-pay")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("order-paid")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("checkout guards", () => {
  test("an empty cart cannot reach checkout", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId("empty-cart")).toBeVisible();
  });

  test("unknown order tokens and mock sessions are real 404s; order pages are noindex", async ({
    page,
  }) => {
    expect((await page.goto("/order/" + "a".repeat(32)))!.status()).toBe(404);
    expect((await page.goto("/order/not-a-token"))!.status()).toBe(404);
    expect((await page.goto("/mock-pay/mock_cs_" + "b".repeat(24)))!.status()).toBe(404);
  });

  test("the webhook rejects unsigned or badly signed events and other methods", async ({
    request,
  }) => {
    const body = JSON.stringify({
      id: "evt_x",
      type: "checkout.session.completed",
      data: { object: { id: "x" } },
    });
    const unsigned = await request.post("/api/webhooks/payments", { data: body });
    expect(unsigned.status()).toBe(400);
    const forged = await request.post("/api/webhooks/payments", {
      data: body,
      headers: { "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` },
    });
    expect(forged.status()).toBe(400);
    expect(await forged.json()).toEqual({ error: "invalid_signature" });
    expect((await request.get("/api/webhooks/payments")).status()).toBe(405);
  });

  test("the dev outbox does not exist in production", async ({ page }) => {
    expect((await page.goto("/dev/outbox"))!.status()).toBe(404);
  });

  test("checkout and order pages are not indexable", async ({ page }) => {
    await addToCart(page, "meridian-desk-tray");
    await page.goto("/checkout");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await goToMockPay(page);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.getByTestId("mock-pay").click();
    await expect(page).toHaveURL(/\/order\//);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
