import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../..", import.meta.url));
if (!process.env.BASELINE_FRONTEND)
  throw Error(
    "Set BASELINE_FRONTEND to the extracted previous frontend directory.",
  );
const out = root + "/docs/qa/ui-comparison";
fs.mkdirSync(out, { recursive: true });
const processes = [];
const api = spawn(
  process.env.TEST_PYTHON || "python",
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8050",
    "--no-access-log",
  ],
  {
    cwd: root + "/backend",
    stdio: "ignore",
    env: {
      ...process.env,
      RATE_LIMIT_PER_MINUTE: "1000",
      CORS_ORIGINS: "http://127.0.0.1:5185,http://127.0.0.1:5186",
    },
  },
);
processes.push(api);
for (const [path, port] of [
  [process.env.BASELINE_FRONTEND, 5185],
  [root + "/frontend", 5186],
])
  processes.push(
    spawn(
      "node",
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: path,
        stdio: "ignore",
        env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8050" },
      },
    ),
  );
async function wait(url) {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw Error("Server not ready");
}
let browser;
const errors = [];
try {
  await Promise.all([
    wait("http://127.0.0.1:8050/health"),
    wait("http://127.0.0.1:5185"),
    wait("http://127.0.0.1:5186"),
  ]);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const [version, port] of [
    ["before", 5185],
    ["after", 5186],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(version + ": " + e.message));
    page.on("requestfailed", (r) => console.log(version, r.url(), r.failure()));
    await page.addInitScript(() => {
      localStorage.setItem("mausam.onboarded", "true");
      localStorage.setItem("mausam.mode", '"demo"');
      localStorage.setItem(
        "mausam.profile",
        JSON.stringify({ interests: ["fitness", "health"], units: "metric" }),
      );
    });
    await page.route("https://embed.windy.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<div style="height:100vh;background:#e5efed;display:grid;place-items:center;font:16px system-ui;color:#28565b">External map transport fixture · selected coordinates preserved</div>',
      }),
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await page.locator(".insight").first().waitFor();
    await page.screenshot({ path: `${out}/${version}-desktop.png` });
    await page.locator("#for-you").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${version}-recommendations.png` });
    await page
      .getByRole("button", { name: "Why this for me?", exact: true })
      .first()
      .click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({ path: `${out}/${version}-explanation.png` });
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Explore weather map", exact: true })
      .click();
    await page.locator("iframe").waitFor();
    await page.screenshot({ path: `${out}/${version}-map.png` });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${out}/${version}-mobile.png` });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page
      .getByRole("button", { name: "Preferences", exact: true })
      .first()
      .click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({ path: `${out}/${version}-mobile-preferences.png` });
    await page.keyboard.press("Escape");
    await page.locator(".judge-toggle").click();
    await page.getByLabel("Weather scenario").selectOption("emergency");
    await page.locator(".emergency-layout").waitFor();
    await page.locator('[data-widget="safety"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${version}-emergency.png` });
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        before: "Part 2 archive",
        after: "Part 3 working tree",
        viewports: ["1440x1000", "390x844"],
        states: [
          "home",
          "recommendations",
          "explanation",
          "map",
          "preferences",
          "emergency",
        ],
        errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const page = browser?.contexts().at(-1)?.pages()[0];
  if (page) {
    await page.screenshot({ path: out + "/comparison-failure.png" });
    console.log((await page.locator("body").innerText()).slice(0, 1800));
  }
  console.error(errors);
  throw error;
} finally {
  await browser?.close();
  for (const process of processes) process.kill();
}
