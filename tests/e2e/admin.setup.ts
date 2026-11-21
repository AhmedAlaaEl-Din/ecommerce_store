import { mkdirSync } from "node:fs";
import { test as setup } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_STATE,
  AUTH_DIR,
  login,
  STAFF_EMAIL,
  STAFF_STATE,
} from "./support/admin";

// Sign in once per role and save the session, so admin tests don't each log in
// (the login itself is covered by its own tests).
setup("sign in as the demo admin and the demo staff user", async ({ browser }) => {
  mkdirSync(AUTH_DIR, { recursive: true });
  for (const [email, file] of [
    [ADMIN_EMAIL, ADMIN_STATE],
    [STAFF_EMAIL, STAFF_STATE],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, email);
    await context.storageState({ path: file });
    await context.close();
  }
});
