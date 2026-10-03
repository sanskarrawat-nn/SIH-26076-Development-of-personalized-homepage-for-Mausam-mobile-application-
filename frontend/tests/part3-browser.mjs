import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../..", import.meta.url)),
  out = root + "/docs/qa";
const api = spawn(
  process.env.TEST_PYTHON || "python",
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8013",
    "--no-access-log",
  ],
  {
    cwd: root + "/backend",
    stdio: "ignore",
    env: { ...process.env, RATE_LIMIT_PER_MINUTE: "1000" },
  },
);
const web = spawn(
  "node",
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5183"],
  {
    cwd: root + "/frontend",
    stdio: "ignore",
    env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8013" },
  },
);
async function wait(url) {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw Error("Server unavailable");
}
let browser;
const checks = [],
  errors = [],
  widths = [360, 390, 412, 768, 1024, 1280, 1366, 1440, 1536, 1920];
try {
  await Promise.all([
    wait("http://127.0.0.1:8013/health"),
    wait("http://127.0.0.1:5183"),
  ]);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("http://127.0.0.1:8013/**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "access-control-allow-origin": "http://127.0.0.1:5183",
      },
    });
  });
  await page.route("https://embed.windy.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Map transport fixture" }),
  );
  await page.addInitScript(() => {
    localStorage.setItem("mausam.onboarded", "true");
    localStorage.setItem("mausam.mode", '"demo"');
    localStorage.setItem(
      "mausam.profile",
      JSON.stringify({
        interests: [
          "fitness",
          "health",
          "student",
          "family",
          "agriculture",
          "travel",
          "marine",
          "events",
          "hill",
          "commute",
        ],
      }),
    );
  });
  await page.goto("http://127.0.0.1:5183");
  await page.locator("#plans").waitFor();
  await page.locator(".judge-toggle").click();
  await page.getByLabel("Weather scenario").selectOption("pleasant");
  await page.waitForFunction(() =>
    document
      .querySelector(".data-ribbon")
      ?.innerText.toLowerCase()
      .includes("demo"),
  );
  async function noOverflow(label) {
    const issues = await page.evaluate(() => {
      const issues = [];
      if (document.documentElement.scrollWidth > innerWidth + 1)
        issues.push("page");
      const dialog = document.querySelector("dialog[open]");
      if (dialog && dialog.scrollWidth > dialog.clientWidth + 2)
        issues.push("dialog");
      for (const el of document.querySelectorAll(
        "input, select, textarea, .part2-card, .plan-grid > *",
      )) {
        if (!el.checkVisibility()) continue;
        const rect = el.getBoundingClientRect();
        if (rect.left < -1 || rect.right > innerWidth + 1)
          issues.push(el.tagName + ":" + (el.name || el.className));
      }
      return issues;
    });
    assert.deepEqual(issues, [], label);
  }
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1050 });
    // Open every disclosure to inspect the largest form/content state.
    await page.evaluate(() =>
      document.querySelectorAll("main details").forEach((el) => {
        el.open = true;
      }),
    );
    await noOverflow(`expanded home ${width}`);
    for (const name of ["Preferences", "Accessibility", "Ask Mausam"]) {
      await page.getByRole("button", { name, exact: true }).first().click();
      await page.getByRole("dialog").waitFor();
      if (name === "Ask Mausam")
        await page
          .getByRole("dialog")
          .getByLabel("Ask Mausam", { exact: true })
          .waitFor();
      await noOverflow(`${name} ${width}`);
      await page.keyboard.press("Tab");
      assert.ok(
        await page.evaluate(() =>
          document
            .querySelector("dialog[open]")
            .contains(document.activeElement),
        ),
      );
      await page.keyboard.press("Escape");
    }
  }
  checks.push(
    "Expanded dashboard/forms and Preferences, Accessibility, Ask dialogs at all ten widths; dialog keyboard focus",
  );
  await page.setViewportSize({ width: 1440, height: 1050 });
  const why = page
    .getByRole("button", { name: "Why this for me?", exact: true })
    .first();
  await why.click();
  await page.getByRole("dialog").waitFor();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1050 });
    await noOverflow(`Why ${width}`);
  }
  await page.keyboard.press("Escape");
  checks.push("Explanation dialog at all ten widths");
  await page.getByLabel("Weather scenario").selectOption("official_warning");
  await page.locator(".emergency-layout").waitFor();
  assert.match(
    await page.locator('[data-widget="safety"]').innerText(),
    /SIMULATED/,
  );
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1050 });
    await noOverflow(`Emergency ${width}`);
  }
  checks.push(
    "Simulated official warning triggers safety override at all ten widths",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-widget="safety"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/part3-emergency-mobile.png" });
  await page.getByLabel("Weather scenario").selectOption("hindi_voice");
  await page
    .getByRole("button", { name: "मौसम से पूछें", exact: true })
    .first()
    .click();
  const input = page.getByRole("dialog").locator("input");
  await input.fill("Kal morning running ke liye best time kya hai?");
  await page.getByRole("dialog").locator('button[type="submit"]').click();
  await page.waitForFunction(() =>
    document.querySelector(".voice-answer")?.innerText.includes("पूर्वानुमान"),
  );
  assert.match(await page.locator(".voice-answer").innerText(), /गारंटी नहीं/);
  await page.screenshot({ path: out + "/part3-hindi-answer.png" });
  await page.keyboard.press("Escape");
  checks.push(
    "Exact SIH Hindi running question receives a forecast-based tomorrow-morning response",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/part3-checks.json",
    JSON.stringify({ checks, errors, widths }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors, widths }, null, 2));
} catch (error) {
  console.error(error);
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) await page.screenshot({ path: out + "/part3-failure.png" });
  process.exitCode = 1;
} finally {
  await browser?.close();
  api.kill();
  web.kill();
  setTimeout(() => api.kill("SIGKILL"), 1000).unref();
}
