import { expect, test } from "@playwright/test";
import { addToCart, fillCheckout } from "./support/checkout";

test.describe("mobile checkout", () => {
  test("summary collapses on top, the form fits the screen, and the purchase completes", async ({
    page,
  }) => {
    await addToCart(page, "oasis-stoneware-planter");
    await page.goto("/cart");
    await page.getByTestId("checkout").click();
    await expect(page).toHaveURL(/\/checkout$/);

    // Desktop summary hidden; the collapsible one sits above the form.
    await expect(page.getByTestId("checkout-summary")).toBeHidden();
    const details = page.getByTestId("mobile-summary");
    const form = page.getByTestId("checkout-form");
    expect((await details.boundingBox())!.y).toBeLessThan((await form.boundingBox())!.y);
    await expect(details.getByTestId("checkout-lines")).toBeHidden();
    await details.getByText("Show order summary").click();
    await expect(details.getByTestId("checkout-lines")).toContainText("Oasis Stoneware Planter");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const submit = await page.getByTestId("place-order").boundingBox();
    expect(submit!.height).toBeGreaterThanOrEqual(44);
    expect(submit!.width).toBeGreaterThan(340);

    await fillCheckout(page);
    await page.getByTestId("place-order").click();
    await expect(page).toHaveURL(/\/mock-pay\//);
    const pay = await page.getByTestId("mock-pay").boundingBox();
    expect(pay!.height).toBeGreaterThanOrEqual(44);
    await page.getByTestId("mock-pay").click();
    await expect(page.getByTestId("order-paid")).toBeVisible({ timeout: 15_000 });
    const after = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(after).toBeLessThanOrEqual(0);
  });
});
