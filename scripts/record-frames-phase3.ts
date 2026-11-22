/**
 * Records demo frames for the Phase 3 video (the admin panel), mock payments only.
 *
 * - Starts its own production server on a freshly reseeded database plus the
 *   invented demo history (scripts/e2e-server.ts), so every run starts the same.
 * - Signs in with the seeded demo accounts by reading var/demo-credentials.txt.
 *   The password is only ever typed into a password field (shown as dots); it
 *   is never printed, captioned or shown in a frame.
 * - Page-only screenshots: desktop 1440x900 (the admin is a desktop tool) and a
 *   short mobile set at 390x844 (drawer, order detail), as zero-padded PNGs in
 *   evidence/phase3/desktop/ and evidence/phase3/mobile/.
 * - Writes evidence/phase3/storyboard.json in the same format as Phases 1 and 2.
 *
 * Run: npm run frames:phase3   (requires `npm run build` first)
 */
import { chromium, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const PORT = process.env.FRAMES_PORT ?? "3200";
const BASE = `http://localhost:${PORT}`;
const ROOT = process.cwd();
const OUT = join(ROOT, "evidence", "phase3");

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

  async snap(step: string, caption: string, duration = 1.4) {
    this.n++;
    const name = `${String(this.n).padStart(4, "0")}.png`;
    await this.page.waitForTimeout(120);
    await this.page.screenshot({ path: join(OUT, this.set, name), animations: "allow" });
    storyboard.push({ file: `${this.set}/${name}`, set: this.set, step, caption, duration });
  }

  async scrollTo(step: string, caption: string, y: number, steps = 3) {
    const start = await this.page.evaluate(() => window.scrollY);
    for (let i = 1; i <= steps; i++) {
      const to = Math.round(start + ((y - start) * i) / steps);
      await this.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), to);
      await this.page.waitForTimeout(100);
      await this.snap(step, caption, i === steps ? 1.4 : 0.25);
    }
  }

  /** Types into a visible text field in a few chunks, one frame per chunk. */
  async type(step: string, caption: string, label: string, text: string, chunks = 2) {
    const field = this.page.getByLabel(label, { exact: true });
    await field.scrollIntoViewIfNeeded();
    await field.click();
    const size = Math.ceil(text.length / chunks);
    for (let i = 0; i < text.length; i += size) {
      await field.pressSequentially(text.slice(i, i + size), { delay: 10 });
      await this.snap(step, caption, 0.3);
    }
  }
}

function demoPassword(email: string): string {
  const text = readFileSync(join(ROOT, "var", "demo-credentials.txt"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const [e, p] = line.trim().split(/\s+/);
    if (e === email && p) return p;
  }
  throw new Error(`No demo password for ${email} (run npm run db:seed first)`);
}

function orderToken(id: string): string {
  const db = new DatabaseSync(join(ROOT, "prisma", "e2e.db"), { readOnly: true });
  try {
    const row = db.prepare('SELECT publicToken FROM "Order" WHERE id = ?').get(id) as
      { publicToken: string } | undefined;
    if (!row) throw new Error(`No order ${id}`);
    return row.publicToken;
  } finally {
    db.close();
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
      UPLOADS_DIR: "var/uploads-frames",
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

/** Login: the email is typed visibly, the password into the password field (dots only). */
async function signIn(page: Page, rec: Recorder, email: string, caption: string) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await rec.snap("login", caption, 1.6);
  await rec.type("login", caption, "Email", email, 2);
  const pw = page.getByLabel("Password", { exact: true });
  if ((await pw.getAttribute("type")) !== "password")
    throw new Error("Password field must mask input");
  await pw.click();
  await pw.pressSequentially(demoPassword(email), { delay: 5 });
  await rec.snap("login", "The password field only ever shows dots.", 1.0);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`${BASE}/admin`);
  await page.waitForLoadState("networkidle");
}

async function desktopStory(page: Page, rec: Recorder) {
  // 1. Login
  await signIn(
    page,
    rec,
    "admin@example.com",
    "Phase 3: the admin panel. Sign in as the demo admin.",
  );

  // 2. Dashboard
  await rec.snap(
    "dashboard",
    "Dashboard: revenue, paid orders, average order, pending and low stock.",
    3.0,
  );
  const chartY = await page
    .getByTestId("revenue-chart-scroll")
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 140);
  await rec.scrollTo(
    "dashboard",
    "Revenue by day: an accessible SVG chart (demo history, invented orders).",
    chartY,
    3,
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));

  // 3. Orders, filtered
  await page.getByRole("link", { name: "Orders", exact: true }).first().click();
  await page.waitForURL(/\/admin\/orders$/);
  await page.waitForLoadState("networkidle");
  await rec.snap("orders", "Orders: sortable table with a sticky header.", 1.8);
  await page.getByTestId("filter-status").selectOption("paid");
  await page.getByTestId("filter-fulfilment").selectOption("unfulfilled");
  await rec.snap("orders", "Filter by payment and fulfilment status (and date, or search).", 1.2);
  await page.getByTestId("filter-apply").click();
  await page.waitForURL(/fulfilment=unfulfilled/);
  await page.waitForLoadState("networkidle");
  await rec.snap("orders", "Paid orders waiting to be packed.", 1.8);

  // 4. One order: packed, then shipped with tracking
  await page.getByTestId("order-row").first().getByRole("link").click();
  await page.waitForURL(/\/admin\/orders\/[a-z0-9]+$/);
  await page.waitForLoadState("networkidle");
  const orderId = page.url().split("/").pop()!;
  await rec.snap(
    "fulfil",
    "An order: lines, totals, customer, payment (session id masked) and timeline.",
    2.6,
  );
  await page.getByTestId("mark-packed").click();
  await page.waitForURL(/done=packed/);
  await page.waitForLoadState("networkidle");
  await rec.snap(
    "fulfil",
    "Marked as packed. Every step is written to the timeline and the audit log.",
    1.8,
  );
  await rec.type(
    "fulfil",
    "Shipping needs a carrier and a tracking number.",
    "Carrier",
    "Nile Post (demo)",
    2,
  );
  await rec.type(
    "fulfil",
    "Shipping needs a carrier and a tracking number.",
    "Tracking number",
    "NP-DEMO-4471",
    2,
  );
  await page.getByTestId("mark-shipped").click();
  await page.waitForURL(/done=shipped/);
  await page.waitForLoadState("networkidle");
  await rec.snap(
    "fulfil",
    "Shipped. A “Your order has shipped” email is written to the local outbox (never sent).",
    2.6,
  );

  // 5. The customer's order page
  await page.goto(`${BASE}/order/${orderToken(orderId)}`, { waitUntil: "networkidle" });
  const progressY = await page
    .getByTestId("order-progress")
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 120);
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), progressY);
  await rec.snap(
    "customer",
    "The customer’s order page now shows “Shipped” with the tracking number.",
    3.0,
  );

  // 6. Products: create one with an image, see it in the store
  await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
  await rec.snap(
    "products",
    "Products: search, filter by category, status and low stock; sort; paginate.",
    2.0,
  );
  await page.getByTestId("new-product").click();
  await page.waitForURL(/\/admin\/products\/new$/);
  await page.waitForLoadState("networkidle");
  await rec.snap("products", "New product. The card on the right is a live preview.", 1.6);
  await rec.type(
    "products",
    "The slug is filled in from the name.",
    "Name",
    "Lotus Serving Tray",
    2,
  );
  await page.getByLabel("Short description").fill("A shallow tray for tea and dates.");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A shallow serving tray in pale olive wood, finished with food-safe oil.");
  await page.getByLabel("Price (USD)").fill("38.00");
  await page.getByLabel("Compare-at price").fill("45.00");
  await page.getByLabel("Opening stock").fill("6");
  await page.getByLabel("Category").selectOption({ label: "Kitchen" });
  await page
    .getByTestId("image-input")
    .setInputFiles(join(ROOT, "tests", "fixtures", "sample-photo.jpg"));
  await page.waitForTimeout(300);
  await rec.snap(
    "products",
    "Price, sale price, stock, category and an image. The preview updates as you type.",
    2.6,
  );
  await page.getByTestId("product-save").click();
  await page.waitForURL(/done=created/);
  await page.waitForLoadState("networkidle");
  await rec.snap(
    "products",
    "Saved. The image was checked by its bytes, re-encoded and stripped of metadata.",
    2.2,
  );
  await page.goto(`${BASE}/products/lotus-serving-tray`, { waitUntil: "networkidle" });
  await rec.snap("products", "And it is in the store straight away.", 2.6);

  // 7. Stock adjustment with history
  await page.goto(`${BASE}/admin/inventory?q=meridian`, { waitUntil: "networkidle" });
  await rec.snap(
    "stock",
    "Inventory: counted-stock bulk edit and a history for every product.",
    1.8,
  );
  await page.getByRole("link", { name: "History & adjust" }).first().click();
  await page.getByTestId("adjust-form").waitFor();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Reason").selectOption("received");
  await page.getByLabel("Quantity").fill("4");
  await page.getByLabel("Note (optional)").fill("Delivery DEMO-77");
  await rec.snap(
    "stock",
    "Adjust stock with a reason: received, damaged, correction or return.",
    1.8,
  );
  await page.getByTestId("adjust-save").click();
  await page.getByTestId("adjust-ok").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await rec.snap(
    "stock",
    "The history explains every number: reservations, releases, adjustments, refunds.",
    2.8,
  );

  // 8. Refund, with confirmation
  await page.goto(`${BASE}/admin/orders?status=paid&fulfilment=delivered`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("order-row").first().getByRole("link").click();
  await page.waitForURL(/\/admin\/orders\/[a-z0-9]+$/);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("refund-order-open").click();
  await page.getByTestId("refund-order").waitFor();
  await page.waitForTimeout(250);
  await rec.snap(
    "refund",
    "Refunds ask first. Full refunds only; restocking is optional (mock provider).",
    2.8,
  );
  await page.getByTestId("refund-order-confirm").click();
  await page.waitForURL(/done=refunded/);
  await page.waitForLoadState("networkidle");
  await rec.snap(
    "refund",
    "Refunded: status, timeline and a “Refund issued” email in the outbox.",
    2.6,
  );

  // 9. Audit log
  await page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
  await rec.snap(
    "audit",
    "The audit log records every change and every sign-in, with emails masked.",
    3.0,
  );

  // Sign out
  await page.getByTestId("logout").click();
  await page.waitForURL(/\/admin\/login$/);

  // 10. Staff hits a forbidden page
  await signIn(page, rec, "staff@example.com", "Now as staff: orders, products and stock only.");
  await rec.snap(
    "staff",
    "Staff see fewer menu items: no users, categories, customers or audit log.",
    2.2,
  );
  await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
  await rec.snap(
    "staff",
    "Opening an admin-only page returns a 403. Every page and action checks on the server.",
    3.0,
  );
}

async function mobileStory(page: Page, rec: Recorder) {
  await signIn(page, rec, "admin@example.com", "On a phone the admin still works.");
  await rec.snap("mobile", "Dashboard on a phone.", 1.6);
  await page.getByTestId("admin-menu-button").click();
  await page.getByTestId("admin-drawer").waitFor();
  await page.waitForTimeout(250);
  await rec.snap(
    "mobile",
    "The sidebar becomes a drawer (Esc closes it, focus stays inside).",
    2.2,
  );
  await page.getByTestId("admin-drawer").getByRole("link", { name: "Orders" }).click();
  await page.waitForURL(/\/admin\/orders$/);
  await page.waitForLoadState("networkidle");
  await rec.snap("mobile", "Orders: the table scrolls sideways inside its box.", 1.6);
  await page.getByTestId("order-row").first().getByRole("link").click();
  await page.waitForURL(/\/admin\/orders\/[a-z0-9]+$/);
  await page.waitForLoadState("networkidle");
  await rec.snap("mobile", "Order detail: the next step comes first on small screens.", 2.2);
  const itemsY = await page
    .getByTestId("order-line")
    .first()
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 160);
  await rec.scrollTo("mobile", "Lines, totals, timeline and internal notes below.", itemsY, 3);
}

async function main() {
  const server = startServer();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    for (const set of ["desktop", "mobile"] as const) {
      const mobile = set === "mobile";
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();
      const rec = new Recorder(page, set);
      if (mobile) await mobileStory(page, rec);
      else await desktopStory(page, rec);
      await context.close();
    }
    await browser.close();
    const count = (s: string) => storyboard.filter((f) => f.set === s).length;
    writeFileSync(
      join(OUT, "storyboard.json"),
      JSON.stringify(
        {
          title: "Nile Goods: Phase 3 demo (admin panel, mock payments)",
          note: "Page-only screenshots. Durations are suggestions in seconds. Demo data only: invented people and orders, mock payments. Passwords are only typed into password fields and never shown.",
          sets: {
            desktop: { width: 1440, height: 900, frames: count("desktop") },
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
