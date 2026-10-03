import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const api = spawn(
  process.env.TEST_PYTHON || "python",
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8033",
    "--no-access-log",
  ],
  { cwd: root + "/backend", stdio: "ignore" },
);
const web = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "5199",
  ],
  {
    cwd: root + "/frontend",
    stdio: "ignore",
    env: { ...process.env, API_PROXY_TARGET: "http://127.0.0.1:8033" },
  },
);
async function wait(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("No server");
}
let browser;
try {
  await Promise.all([
    wait("http://127.0.0.1:8033/health"),
    wait("http://127.0.0.1:5199"),
  ]);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("mausam.onboarded", "true");
    localStorage.setItem("mausam.mode", '\"demo\"');
  });
  await page.goto("http://127.0.0.1:5199");
  await page.locator(".current-weather").waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.locator(".current-weather").waitFor();
  await page.screenshot({
    path: root + "/docs/qa/11-home.png",
    fullPage: true,
  });
  await context.setOffline(true);
  await page.reload();
  await page.locator(".connection-banner").waitFor();
  await page.getByText("Offline — showing last available data.").waitFor();
  await page.screenshot({
    path: root + "/docs/qa/12-offline.png",
    fullPage: true,
  });
  const status = await page.locator(".data-ribbon .badge").innerText();
  if (!["DEMO DATA", "CACHED DATA"].includes(status))
    throw Error("Incorrect offline label: " + status);
  await page.getByLabel("Language", { exact: true }).selectOption("hi");
  const fontLoaded = await page.evaluate(async () => {
    await document.fonts.load('16px "Mausam Devanagari"', "मौसम");
    return document.fonts.check('16px "Mausam Devanagari"', "मौसम");
  });
  if (!fontLoaded) throw Error("Offline Hindi font unavailable");
  await page.getByLabel("भाषा", { exact: true }).selectOption("en");
  // Different preferences must not reuse the old profile response.
  await page
    .locator(".interest-strip")
    .getByRole("button", { name: "Travel", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Let’s reconnect your weather" })
    .waitFor();
  await page.screenshot({
    path: root + "/docs/qa/13-error.png",
    fullPage: true,
  });
  await context.setOffline(false);
  await page.locator(".current-weather").waitFor();
  fs.writeFileSync(
    root + "/docs/qa/offline-checks.json",
    JSON.stringify(
      {
        passed: [
          "Production shell opens offline",
          "Exact-query last data keeps Demo/Cached label",
          "Changed preferences never reuse mismatched cached response",
          "Online retry recovers",
          "Hindi font and catalogs available offline",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: production shell, offline labels, cache key isolation, recovery",
  );
} finally {
  await browser?.close();
  api.kill();
  web.kill();
}
