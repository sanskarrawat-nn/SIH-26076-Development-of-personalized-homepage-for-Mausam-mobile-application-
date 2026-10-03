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
    "8012",
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
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5182"],
  {
    cwd: root + "/frontend",
    stdio: "ignore",
    env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8012" },
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
  errors = [];
try {
  await Promise.all([
    wait("http://127.0.0.1:8012/health"),
    wait("http://127.0.0.1:5182"),
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
  await page.route("http://127.0.0.1:8012/**", async (r) => {
    const response = await r.fetch();
    await r.fulfill({
      response,
      headers: {
        ...response.headers(),
        "access-control-allow-origin": "http://127.0.0.1:5182",
      },
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("mausam.onboarded", "true");
    localStorage.setItem("mausam.mode", '"demo"');
    localStorage.setItem(
      "mausam.profile",
      JSON.stringify({ interests: ["student", "hill"], units: "metric" }),
    );
  });
  let maps = 0;
  await page.route("https://embed.windy.com/**", (r) => {
    maps++;
    return r.fulfill({
      contentType: "text/html",
      body: "<p>Test weather map transport</p>",
    });
  });
  await page.goto("http://127.0.0.1:5182");
  await page
    .getByRole("heading", { name: "Student schedule", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Conditions around you", exact: true })
    .waitFor();
  checks.push(
    "Student and Highland modules integrated into the dynamic homepage",
  );
  await page.locator(".judge-toggle").click();
  await page.getByLabel("Weather scenario").selectOption("student_commute");
  await page
    .getByRole("heading", { name: "Student schedule", exact: true })
    .waitFor();
  assert.match(await page.locator('[data-widget="plans"]').innerText(), /Rain/);
  await page
    .getByRole("button", { name: "Useful", exact: true })
    .first()
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("mausam.learning"))?.scores?.student > 0,
  );
  await page
    .getByRole("heading", { name: "Student schedule", exact: true })
    .waitFor();
  await page.getByText("Device preferences", { exact: true }).click();
  await page.getByRole("button", { name: "Reset learned preferences" }).click();
  await page.waitForFunction(
    () =>
      Object.keys(JSON.parse(localStorage.getItem("mausam.learning")).scores)
        .length === 0,
  );
  checks.push("Useful feedback persists and reset clears learned weights");
  await page
    .getByRole("heading", { name: "Conditions around you", exact: true })
    .waitFor();
  // Open collapsed controls again after the home query changed.
  const device = page.locator("details").filter({
    has: page
      .locator(":scope > summary")
      .filter({ hasText: /^Device preferences$/ }),
  });
  await device.evaluate((el) => (el.open = true));
  await page.getByLabel("Low Data Mode", { exact: true }).check();
  await page
    .getByRole("button", { name: "Explore weather map", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(maps, 0);
  await page
    .getByRole("dialog")
    .getByText(/Low Data Mode: external weather maps/)
    .waitFor();
  assert.match(await page.getByRole("dialog").innerText(), /Low Data Mode/);
  await page.keyboard.press("Escape");
  await device.evaluate((el) => (el.open = true));
  await page.getByLabel("Low Data Mode", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Explore weather map", exact: true })
    .click();
  await page.locator("iframe").waitFor();
  assert.ok(maps > 0);
  await page.keyboard.press("Escape");
  checks.push(
    "Low Data Mode suppresses heavy map; normal intentional opening auto-loads",
  );
  await page.getByLabel("Weather scenario").selectOption("community_flood");
  await page
    .getByRole("heading", { name: "Conditions around you", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Report map", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "waterlogging 1", exact: true })
    .click();
  assert.match(await page.getByRole("dialog").innerText(), /UNVERIFIED REPORT/);
  assert.match(await page.getByRole("dialog").innerText(), /DEMO/);
  await page.screenshot({ path: out + "/part2-community-map.png" });
  await page.keyboard.press("Escape");
  await page.getByLabel("Weather scenario").selectOption("verified_community");
  await page
    .getByRole("heading", { name: "Conditions around you", exact: true })
    .waitFor();
  await page.getByText("View report details", { exact: true }).click();
  assert.match(
    await page.locator("#community").innerText(),
    /VERIFIED LOCAL REPORT/,
  );
  checks.push(
    "Community demo markers, detail panel and explicit local review state",
  );
  await page.getByText("Add a plan", { exact: true }).click();
  await page.getByLabel("Start date and time").fill("2026-06-16T17:00");
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await page
    .locator("#saved-plans")
    .getByText("SIMULATED", { exact: true })
    .waitFor();
  assert.match(await page.locator("#saved-plans").innerText(), /Rain/);
  checks.push("Saved plan automatically evaluates complete event duration");
  for (const width of [360, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#community").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/part2-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator("#saved-plans").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/part2-desktop.png" });
  checks.push("Mobile and desktop layout: 360, 390, 768, 1440, 1920 pixels");
  await page.getByLabel("Weather scenario").selectOption("emergency");
  await page.locator(".emergency-layout").waitFor();
  assert.equal(
    await page
      .locator(".dynamic-homepage > [data-widget]")
      .first()
      .getAttribute("data-widget"),
    "safety",
  );
  checks.push("Emergency safety override remains first");

  const actualDemo = await (
    await fetch(
      "http://127.0.0.1:8012/api/home/personalized?mode=demo&scenario=pleasant",
    )
  ).json();
  // Explicit UI transport fixture; backend report validation is tested separately.
  const formContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const formPage = await formContext.newPage();
  formPage.on("pageerror", (e) => errors.push(e.message));
  await formPage.addInitScript(() => {
    localStorage.setItem("mausam.onboarded", "true");
    localStorage.setItem("mausam.mode", '"live"');
  });
  let savedReport = null,
    blocked = false;
  await formPage.route("http://127.0.0.1:8012/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body;
    if (path === "/api/home/personalized") body = actualDemo;
    else if (
      path === "/api/community/reports" &&
      route.request().method() === "POST"
    ) {
      const sent = route.request().postDataJSON();
      savedReport = {
        report_id: "ui-fixture",
        category: sent.category,
        latitude: 26.85,
        longitude: 80.95,
        approximate_location: "Rounded test area",
        timestamp: sent.timestamp,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        description: "Description awaiting privacy review.",
        photo: null,
        verification_status: "UNVERIFIED REPORT",
        confidence_score: 20,
        confidence_basis: ["UI transport fixture"],
        source: "Community observations",
        status: "community_unverified",
        distance_km: 1,
        confirming_reports: 0,
      };
      body = { report: savedReport, delete_token: "ui-receipt" };
    } else if (path === "/api/community/reports") {
      if (blocked) return route.abort();
      body = {
        reports: savedReport ? [savedReport] : [],
        retrieved_at: new Date().toISOString(),
      };
    } else if (path.endsWith("/delete")) {
      savedReport = null;
      body = { deleted: true };
    } else return route.abort();
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "http://127.0.0.1:5182" },
      body: JSON.stringify(body),
    });
  });
  await formPage.goto("http://127.0.0.1:5182");
  await formPage
    .getByRole("heading", { name: "Conditions around you", exact: true })
    .waitFor();
  await formPage.getByText("Report local weather", { exact: true }).click();
  await formPage
    .getByLabel("Description", { exact: true })
    .fill("Private text must stay out of the public response.");
  await formPage
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await formPage
    .getByText("Report submitted. Text and photo await privacy review.", {
      exact: true,
    })
    .waitFor();
  blocked = true;
  await formPage
    .getByRole("button", { name: "Refresh reports", exact: true })
    .click();
  await formPage.waitForFunction(() =>
    document.querySelector("#community")?.innerText.includes("OFFLINE"),
  );
  assert.match(await formPage.locator("#community").innerText(), /heavy rain/);
  await formPage.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("mausam.community.")) {
        const v = JSON.parse(localStorage.getItem(key));
        v.reports.forEach(
          (r) => (r.expires_at = new Date(Date.now() - 1000).toISOString()),
        );
        localStorage.setItem(key, JSON.stringify(v));
      }
    }
  });
  await formPage
    .getByRole("button", { name: "Refresh reports", exact: true })
    .click();
  await formPage.getByText("View report details", { exact: true }).click();
  await formPage
    .getByText("EXPIRED REPORT", { exact: false })
    .first()
    .waitFor();
  assert.match(
    await formPage.locator("#community").innerText(),
    /No active reports/,
  );
  checks.push(
    "Mobile report form, private receipt, cached community fallback and expiry (mocked transport)",
  );
  await formContext.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/part2-checks.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  console.error(error);
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: out + "/part2-failure.png" });
    console.log((await page.locator("body").innerText()).slice(-1800));
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  api.kill();
  web.kill();
  setTimeout(() => api.kill("SIGKILL"), 1000).unref();
}
