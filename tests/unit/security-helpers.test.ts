import { describe, expect, it } from "vitest";
import { describeError, maskEmail, maskName } from "@/lib/log";
import { escapeHtml, OUTBOX_FILE_RE, renderConfirmationEmail } from "@/lib/orders/outbox";
import { RateLimiter } from "@/lib/rate-limit";

describe("log masking", () => {
  it("masks emails and names", () => {
    expect(maskEmail("mona@example.com")).toBe("m***@e***.com");
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskName("Mona Example")).toBe("M. E.");
  });

  it("describeError keeps only the first line and hides emails (Prisma repeats query args)", () => {
    const err = Object.assign(
      new Error(
        "Invalid `tx.order.create()` invocation for mona@example.com\n\n  data: { email: 'mona@example.com', addressLine1: '12 Reed Lane' }",
      ),
      { code: "P2002", name: "PrismaClientKnownRequestError" },
    );
    const s = describeError(err);
    expect(s).toContain("P2002");
    expect(s).not.toContain("mona@example.com");
    expect(s).not.toContain("Reed Lane");
    expect(describeError("oops")).toBe("string");
  });
});

describe("RateLimiter (token bucket)", () => {
  it("allows a burst, then throttles, then refills over time", () => {
    const rl = new RateLimiter(3, 1); // 3 burst, 1 token/second
    const t = 1_000_000;
    expect([rl.take("a", t), rl.take("a", t), rl.take("a", t), rl.take("a", t)]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(rl.take("b", t)).toBe(true); // separate key, separate bucket
    expect(rl.take("a", t + 500)).toBe(false);
    expect(rl.take("a", t + 1000)).toBe(true);
    expect(rl.take("a", t + 1000)).toBe(false);
  });

  it("caps tokens at capacity and bounds memory", () => {
    const rl = new RateLimiter(2, 100, 2);
    expect(rl.take("x", 0)).toBe(true);
    expect(rl.take("x", 10_000)).toBe(true);
    expect(rl.take("x", 10_000)).toBe(true);
    expect(rl.take("x", 10_000)).toBe(false);
    rl.take("y", 0);
    rl.take("z", 0); // evicts the oldest key instead of growing
    expect(rl.take("z", 0)).toBe(true);
  });
});

describe("outbox email", () => {
  const order = {
    orderNumber: "NG-2026-000007",
    publicToken: "tok",
    email: "mona@example.com",
    customerName: "Mona <b>Example</b>",
    addressLine1: "12 Reed Lane",
    addressLine2: null,
    city: "Delta Town",
    postalCode: "DT 1024",
    country: "EG",
    subtotalCents: 4400,
    shippingCents: 595,
    totalCents: 4995,
    currency: "USD",
    items: [
      {
        productNameSnapshot: "Sahel Salad Bowl",
        quantity: 1,
        unitPriceCentsSnapshot: 4400,
        lineTotalCents: 4400,
      },
    ],
  };

  it("escapes user input and links to the token URL", () => {
    const html = renderConfirmationEmail(order, "http://localhost:3000/");
    expect(html).toContain("Mona &lt;b&gt;Example&lt;/b&gt;");
    expect(html).not.toContain("<b>Example</b>");
    expect(html).toContain("http://localhost:3000/order/tok");
    expect(html).toContain("$49.95");
    expect(html).toContain("Egypt");
    expect(html).toContain("Nothing was sent");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });

  it("only accepts generated file names (no path traversal)", () => {
    expect(OUTBOX_FILE_RE.test("NG-2026-000007-1795278313059.html")).toBe(true);
    expect(OUTBOX_FILE_RE.test("../.env")).toBe(false);
    expect(OUTBOX_FILE_RE.test("NG-2026-000007-1795278313059.html/../x")).toBe(false);
  });
});
