import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import fs from "node:fs";
const require = createRequire(import.meta.url);

const { chromium: playwright } = require("playwright");
const root = fileURLToPath(new URL("../..", import.meta.url)).replace(
  /\/$/,
  "",
);
const out = root + "/docs/qa";
fs.mkdirSync(out, { recursive: true });
const api = spawn(
  process.env.TEST_PYTHON || "python",
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
    "--no-access-log",
  ],
  { cwd: root + "/backend", stdio: "ignore" },
);
const web = spawn(
  "node",
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5173"],
  { cwd: root + "/frontend", stdio: "ignore" },
);
async function wait(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Server unavailable: " + url);
}
let browser;
const checks = [];
try {
  await Promise.all([
    wait("http://127.0.0.1:8000/health"),
    wait("http://127.0.0.1:5173"),
  ]);
  browser = await playwright.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: out + "/01-onboarding.png", fullPage: true });
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Show my weather", exact: true })
    .click();
  checks.push("Five-step onboarding completed");
  await page.locator(".judge-toggle").click();
  await page.getByLabel("Weather scenario").selectOption("pleasant");
  await page.locator(".current-weather").waitFor();
  await page
    .getByRole("heading", { name: "A better window to head outside" })
    .waitFor();
  await page.screenshot({ path: out + "/02-desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Why this for me?", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByText("Priority:", { exact: false })
    .waitFor();
  await page.screenshot({ path: out + "/03-explanation.png", fullPage: true });
  await page.getByRole("button", { name: "Close dialog" }).click();
  checks.push("Judge mode, merged interests, window and ranking explanation");
  await page.getByLabel("Weather scenario").selectOption("travel_rain");
  for (const name of ["Fitness", "Health"]) {
    const button = page
      .locator(".interest-strip")
      .getByRole("button", { name, exact: true });
    if ((await button.getAttribute("aria-pressed")) === "true")
      await button.click();
  }
  await page
    .locator(".interest-strip")
    .getByRole("button", { name: "Travel", exact: true })
    .click();
  await page.getByRole("heading", { name: /Packing for/ }).waitFor();
  if (!(await page.locator(".insight p").innerText()).includes("umbrella"))
    throw Error("Travel recommendation missing");
  checks.push("Travel rain generates umbrella recommendation");
  await page.getByLabel("Weather scenario").selectOption("agriculture_rain");
  await page
    .locator(".demo-steps")
    .getByRole("button", { name: /Agriculture/ })
    .click();
  await page
    .getByRole("heading", { name: "Rainfall & your growing plans" })
    .waitFor();
  await page.getByText(/18 mm forecast/).waitFor();
  checks.push("Agriculture scenario reports 18 mm");
  await page.getByLabel("Weather scenario").selectOption("missing");
  await page
    .getByText("Weather data is unavailable. We won’t invent a recommendation.")
    .waitFor();
  await page.screenshot({ path: out + "/04-missing.png", fullPage: true });
  checks.push("No-data state has no fabricated recommendations");
  await page.getByLabel("Weather scenario").selectOption("heat");
  await page.locator(".demo-steps button").first().click();
  await page.locator(".insight").waitFor();
  await page
    .getByRole("button", { name: "Save or unsave current location" })
    .click();
  await page.locator(".location-picker").click();
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: "Saved places" })
    .waitFor();
  await page.screenshot({ path: out + "/05-locations.png", fullPage: true });
  await page.getByRole("button", { name: "Close dialog" }).click();
  checks.push("Saved locations persist in browser");
  await page
    .locator(".topbar")
    .getByRole("button", { name: "Preferences", exact: true })
    .click();
  await page.getByLabel(/^Units/).selectOption("imperial");
  await page.screenshot({ path: out + "/06-settings.png", fullPage: true });
  await page.getByRole("button", { name: "Close dialog" }).click();
  if (!(await page.locator(".temperature").innerText()).includes("100"))
    throw Error("Fahrenheit conversion failed");
  await page.getByRole("button", { name: "Data details" }).click();
  await page.screenshot({ path: out + "/07-sources.png", fullPage: true });
  await page.getByRole("button", { name: "Close dialog" }).click();
  checks.push("Imperial units and per-metric source details");
  await page.getByRole("button", { name: /View all/ }).click();
  await page.screenshot({ path: out + "/08-alerts.png", fullPage: true });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: out + "/09-mobile.png", fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  if (overflow) throw Error("Mobile horizontal overflow");
  await page.getByRole("button", { name: "7 days", exact: true }).click();
  await page.screenshot({ path: out + "/10-mobile-daily.png", fullPage: true });
  checks.push("390px mobile layout and daily forecast, no page overflow");
  await page.setViewportSize({ width: 780, height: 844 });
  await page.evaluate(() => (document.documentElement.style.fontSize = "32px"));
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Text zoom overflow");
  checks.push("200% base text sizing without page overflow");
  if (errors.length) throw Error(errors.join("\n"));
  fs.writeFileSync(
    out + "/browser-checks.json",
    JSON.stringify({ passed: checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: checks, errors }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  api.kill();
  web.kill();
}
