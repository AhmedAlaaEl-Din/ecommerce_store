/**
 * Records demo frames for the Phase 2 video (checkout with the MOCK payment provider).
 *
 * - Starts its own production server on a freshly reseeded database with
 *   PAYMENT_PROVIDER=mock (scripts/e2e-server.ts), so every run starts the same.
 * - Page-only screenshots (no browser chrome): desktop 1280x720 and mobile
 *   390x844, as zero-padded PNGs in evidence/phase2/desktop/ and evidence/phase2/mobile/.
 * - Writes evidence/phase2/storyboard.json in the same format as Phase 1.
 * - All people and addresses are invented demo data.
 *
 * Run: npm run frames:phase2   (requires `npm run build` first)
 */
import { chromium, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.FRAMES_PORT ?? "3200";
const BASE = `http://localhost:${PORT}`;
const ROOT = process.cwd();
const OUT = join(ROOT, "evidence", "phase2");
const OUTBOX = join(ROOT, "var", "outbox-frames");

type Frame = { file: string; set: string; step: string; caption: string; duration: number };
const storyboard: Frame[] = [];

class Recorder {
  private n = 0;
  constructor(
    private page: Page,
    private set: "desktop" | "mobile",
  ) {
    rmSync(join(OUT, set), { recursive: true, force: true });
    mkdirSync(join(OUT, set), { recursive: true });
  }

  async snap(step: string, caption: string, duration = 1.2) {
    this.n++;
    const name = `${String(this.n).padStart(4, "0")}.png`;
    await this.page.screenshot({ path: join(OUT, this.set, name), animations: "allow" });
    storyboard.push({ file: `${this.set}/${name}`, set: this.set, step, caption, duration });
  }

  async burst(step: string, caption: string, count = 5, gapMs = 60) {
    for (let i = 0; i < count; i++) {
      await this.snap(step, caption, 0.08);
      await this.page.waitForTimeout(gapMs);
    }
  }

  async scrollTo(step: string, caption: string, y: number, steps = 4) {
    const start = await this.page.evaluate(() => window.scrollY);
    for (let i = 1; i <= steps; i++) {
      const to = Math.round(start + ((y - start) * i) / steps);
      await this.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), to);
      await this.page.waitForTimeout(120);
      await this.snap(step, caption, i === steps ? 1.2 : 0.25);
    }
  }

  /** Types text in a few chunks, one frame per chunk (the "typing" effect). */
  async type(step: string, caption: string, label: string, text: string, chunks = 3) {
    const field = this.page.getByLabel(label, { exact: true });
    await field.scrollIntoViewIfNeeded();
    await field.click();
    const size = Math.ceil(text.length / chunks);
    for (let i = 0; i < text.length; i += size) {
      await field.pressSequentially(text.slice(i, i + size), { delay: 15 });
      await this.snap(step, caption, 0.3);
    }
  }
}

async function waitForServer(url: string, timeoutMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server did not start at ${url}`);
}

function startServer(): ChildProcess {
  return spawn("npx tsx scripts/e2e-server.ts", {
    cwd: ROOT,
    env: {
      ...process.env,
      E2E_PORT: PORT,
      OUTBOX_DIR: "var/outbox-frames",
      MOCK_WEBHOOK_DELAY_MS: "2500",
    },
    stdio: ["ignore", "ignore", "inherit"],
    shell: true,
  });
}

function stopServer(server: ChildProcess) {
  if (process.platform === "win32" && server.pid) {
    spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
}

function newestOutboxFile(): string {
  const files = readdirSync(OUTBOX)
    .filter((f) => f.endsWith(".html"))
    .map((f) => ({ f, t: statSync(join(OUTBOX, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files[0]) throw new Error("No outbox email was written");
  return join(OUTBOX, files[0].f);
}

async function addToCart(page: Page, slug: string) {
  await page.goto(`${BASE}/products/${slug}`, { waitUntil: "networkidle" });
  await page.getByTestId("add-to-cart").click();
  await page.getByTestId("toast").first().waitFor();
}

async function quickFill(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill("omar@example.com");
  await page.getByLabel("Full name").fill("Omar Example");
  await page.getByLabel("Street address").fill("7 Papyrus Road");
  await page.getByLabel("Town or city").fill("Oasis Bay");
  await page.getByLabel("Postal code").fill("OB 2040");
  await page.getByLabel("Country").selectOption("AE");
}

async function story(page: Page, rec: Recorder, mobile: boolean) {
  const settle = () => page.waitForLoadState("networkidle");

  // 1. Cart with two items
  await addToCart(page, "sahel-salad-bowl");
  await addToCart(page, "tide-wool-throw");
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
  await rec.snap("cart", "Phase 2: the cart’s Checkout button is live (mock payment demo).", 2.0);
  if (mobile) {
    const y = await page
      .getByTestId("checkout")
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 500);
    await rec.scrollTo("cart", "Order summary with sale savings and free shipping.", y, 3);
  } else {
    await page.getByTestId("checkout").hover();
    await page.waitForTimeout(200);
    await rec.snap("cart", "Order summary with sale savings and free shipping.", 1.2);
  }

  // 2. Checkout page
  await page.getByTestId("checkout").click();
  await page.waitForURL(/\/checkout$/);
  await settle();
  await rec.snap(
    "checkout",
    "One-page checkout. The ribbon says it: demo mode, mock payments.",
    2.5,
  );
  if (mobile) {
    await page.getByTestId("mobile-summary").getByText("Show order summary").click();
    await page.waitForTimeout(250);
    await rec.snap("checkout", "On a phone the order summary folds away on top.", 1.8);
    await page.getByTestId("mobile-summary").getByText("Hide order summary").click();
    await page.waitForTimeout(150);
  }

  // 3. Fill in the form (typing), with a mistake in the email
  await rec.type("form", "Contact: an invented demo customer.", "Email", "mona@example", 3);
  await rec.type(
    "form",
    "Shipping address with proper autocomplete hints.",
    "Full name",
    "Mona Example",
    2,
  );
  await rec.type(
    "form",
    "Shipping address with proper autocomplete hints.",
    "Street address",
    "12 Reed Lane",
    2,
  );
  await rec.type(
    "form",
    "Shipping address with proper autocomplete hints.",
    "Town or city",
    "Delta Town",
    2,
  );
  await rec.type(
    "form",
    "Shipping address with proper autocomplete hints.",
    "Postal code",
    "DT 1024",
    2,
  );
  await page.getByLabel("Country").selectOption("EG");
  await rec.snap(
    "form",
    "A short list of real countries; the customer and address are invented.",
    1.2,
  );

  // 4. Validation error, then the fix
  await page.getByTestId("place-order").click();
  await page.getByTestId("checkout-error").waitFor();
  await page.waitForTimeout(250);
  await rec.snap(
    "validation",
    "Server-side validation: the error is listed and shown inline.",
    2.2,
  );
  const email = page.getByLabel("Email", { exact: true });
  await email.scrollIntoViewIfNeeded();
  await email.click();
  await email.press("End");
  await email.pressSequentially(".com", { delay: 20 });
  await page.waitForTimeout(150);
  await rec.snap("validation", "Fixing the field clears its error straight away.", 1.8);

  // 5. Submit → mock payment page
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/mock-pay\//);
  await settle();
  await rec.snap(
    "mock-pay",
    "Mock payment page: clearly labelled, no real payment provider. Stock is now reserved.",
    3.0,
  );
  if (!mobile) {
    await page.getByTestId("mock-pay").hover();
    await page.waitForTimeout(200);
    await rec.snap("mock-pay", "Choose an outcome: Pay, Decline or Cancel (mock payment).", 1.5);
  }

  // 6. Pay → Confirming… → thank you
  await page.getByTestId("mock-pay").click();
  await page.waitForURL(/\/order\//);
  await page.getByTestId("order-pending").waitFor();
  await rec.burst(
    "confirming",
    "Confirming your payment… (the mock webhook arrives a moment later).",
    4,
    400,
  );
  await page.getByTestId("order-paid").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(300);
  await rec.snap("thank-you", "Paid. Thank-you page with the order number (mock payment).", 3.0);
  const addressY = await page
    .getByTestId("order-address")
    .evaluate(
      (el, offset) => el.getBoundingClientRect().top + window.scrollY - offset,
      mobile ? 200 : 120,
    );
  await rec.scrollTo(
    "thank-you",
    "Items, totals and the shipping address, all from the server.",
    addressY,
    3,
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await rec.snap(
    "thank-you",
    "The cart badge is cleared: the order took exactly what was bought.",
    1.5,
  );

  // 7. The confirmation "email" from var/outbox
  const html = readFileSync(newestOutboxFile(), "utf8");
  await page.setContent(html, { waitUntil: "load" });
  await rec.snap(
    "outbox",
    "The confirmation email is written to a local outbox file. Nothing is ever sent.",
    3.0,
  );

  // 8. Decline path, briefly
  await addToCart(page, "basalt-stoneware-mug");
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
  await quickFill(page);
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/mock-pay\//);
  await settle();
  await rec.snap("decline", "Another order. This time: Decline (test failure).", 1.5);
  await page.getByTestId("mock-decline").click();
  await page.waitForURL(/status=failed/);
  await settle();
  await page.waitForTimeout(250);
  await rec.snap(
    "decline",
    "Back at checkout: nothing charged, details kept, stock released (mock payment).",
    3.0,
  );
}

async function main() {
  rmSync(OUTBOX, { recursive: true, force: true });
  const server = startServer();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    for (const set of ["desktop", "mobile"] as const) {
      const mobile = set === "mobile";
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();
      const rec = new Recorder(page, set);
      await story(page, rec, mobile);
      await context.close();
    }
    await browser.close();
    const count = (s: string) => storyboard.filter((f) => f.set === s).length;
    writeFileSync(
      join(OUT, "storyboard.json"),
      JSON.stringify(
        {
          title: "Nile Goods: Phase 2 demo (checkout with mock payments)",
          note: "Page-only screenshots. Durations are suggestions in seconds. All payments shown are mock payments; no real payment provider is used.",
          sets: {
            desktop: { width: 1280, height: 720, frames: count("desktop") },
            mobile: { width: 390, height: 844, frames: count("mobile") },
          },
          frames: storyboard,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Recorded ${count("desktop")} desktop and ${count("mobile")} mobile frames into ${OUT}`,
    );
  } finally {
    stopServer(server);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
