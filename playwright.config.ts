import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Phase 3: signs in the demo admin and staff once and saves their sessions.
    { name: "setup", testMatch: /admin\.setup\.ts$/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      testIgnore: [/\.mobile\.spec\.ts$/, /admin\.spec\.ts$/, /a11y\.spec\.ts$/],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      testMatch: /\.mobile\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    // Accessibility (axe) checks, run on their own by `npm run test:axe`.
    {
      name: "a11y",
      dependencies: ["setup"],
      testMatch: /a11y\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    // Phase 3: admin journeys change the catalog, stock and orders, so they run
    // after the storefront projects instead of alongside them.
    {
      name: "admin",
      dependencies: ["desktop", "mobile"],
      testMatch: /admin\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "npx tsx scripts/e2e-server.ts",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { E2E_PORT: String(PORT) },
  },
});
