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
    "8011",
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
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5181"],
  {
    cwd: root + "/frontend",
    stdio: "ignore",
    env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8011" },
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
    wait("http://127.0.0.1:8011/health"),
    wait("http://127.0.0.1:5181"),
  ]);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("http://127.0.0.1:8011/**", async (r) => {
    const response = await r.fetch();
    await r.fulfill({
      response,
      headers: {
        ...response.headers(),
        "access-control-allow-origin": "http://127.0.0.1:5181",
      },
    });
  });
  await page.addInitScript(() => {
    window.SpeechRecognition = undefined;
    window.webkitSpeechRecognition = undefined;
    localStorage.setItem("mausam.onboarded", "true");
    localStorage.setItem("mausam.mode", '"demo"');
    localStorage.setItem(
      "mausam.profile",
      JSON.stringify({
        interests: [
          "health",
          "fitness",
          "family",
          "events",
          "agriculture",
          "travel",
          "marine",
          "commute",
        ],
        units: "metric",
        activity: "general",
      }),
    );
  });
  let mapRequests = 0;
  await page.route("https://embed.windy.com/**", (r) => {
    mapRequests++;
    return r.fulfill({
      contentType: "text/html",
      body: "<html>Map transport fixture</html>",
    });
  });
  await page.goto("http://127.0.0.1:5181");
  await page.locator(".current-weather").waitFor();
  assert.equal(mapRequests, 0);
  assert.match(await page.title(), /Mausam Setu/);
  checks.push("Branding; no external map before explorer opens");
  await page.getByText("Customize my plans", { exact: true }).click();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1050 });
    const issues = await page.evaluate(() => {
      const bad = [];
      if (document.documentElement.scrollWidth > innerWidth + 1)
        bad.push("page");
      for (const e of document.querySelectorAll(
        ".plan-grid > *, .plan-fields > *, .planner-details > summary",
      )) {
        const b = e.getBoundingClientRect(),
          p = e.parentElement.getBoundingClientRect();
        if (
          b.left < p.left - 1 ||
          b.right > p.right + 1 ||
          e.scrollWidth > e.clientWidth + 2
        )
          bad.push(e.className);
      }
      return bad;
    });
    assert.deepEqual(issues, [], `${width}px: ${issues}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#plans").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/part1-plans-mobile.png" });
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  checks.push("Expanded plans at ten widths and mobile 200% text");
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page
    .getByRole("button", { name: "Explore weather map", exact: true })
    .click();
  await page.locator("iframe").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Load interactive map" }).count(),
    0,
  );
  assert.ok(mapRequests > 0);
  for (const [name, overlay] of [
    ["Temperature", "temp"],
    ["Rainfall", "rain"],
    ["Wind", "wind"],
    ["Humidity", "rh"],
    ["Radar", "radar"],
    ["Satellite", "satellite"],
    ["PM2.5", "pm2p5"],
  ]) {
    await page
      .getByRole("group", { name: "Weather map layers" })
      .getByRole("button", { name, exact: true })
      .click();
    assert.equal(
      new URL(
        await page.locator("iframe").getAttribute("src"),
      ).searchParams.get("overlay"),
      overlay,
    );
  }
  await page.getByRole("button", { name: "Choose another place" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /New Delhi/ })
    .first()
    .click();
  await page.waitForFunction(() =>
    document.querySelector("iframe")?.src.includes("lat=28.6139"),
  );
  assert.equal(await page.getByRole("dialog").count(), 1);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1050 });
    assert.equal(
      await page
        .getByRole("dialog")
        .evaluate((e) => e.scrollWidth > e.clientWidth + 1),
      false,
      `map ${width}`,
    );
  }
  await page.screenshot({ path: out + "/part1-map-desktop.png" });
  checks.push(
    "Map automatic load, seven layers, location recentering and ten modal widths",
  );
  await context.setOffline(true);
  await page
    .getByRole("heading", { name: "Map unavailable offline" })
    .waitFor();
  await context.setOffline(false);
  await page.locator("iframe").waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.unroute("https://embed.windy.com/**");
  await page.route("https://embed.windy.com/**", () => {});
  await page.clock.install();
  await page
    .getByRole("button", { name: "Explore weather map", exact: true })
    .click();
  await page
    .getByText("Loading interactive weather map…", { exact: true })
    .waitFor();
  await page.clock.runFor(21000);
  await page
    .getByText("Interactive weather map could not be loaded.", { exact: true })
    .waitFor();
  await page.unroute("https://embed.windy.com/**");
  await page.route("https://embed.windy.com/**", (r) =>
    r.fulfill({ contentType: "text/html", body: "<html>Restored</html>" }),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Retry", exact: true })
    .click();
  await page.locator("iframe").waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  checks.push("Map offline/reconnect and timeout/retry");
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator(".judge-toggle").click();
  await page.getByLabel("Weather scenario").selectOption("pleasant");
  await page.locator(".demo-steps button").first().click();
  await page.locator(".current-weather").waitFor();
  const fitness = await page
    .locator(".dynamic-homepage > [data-widget]")
    .evaluateAll((ns) => ns.map((n) => n.dataset.widget));
  await page.locator(".demo-steps button").nth(2).click();
  await page
    .getByRole("heading", { name: "Rainfall & your growing plans" })
    .waitFor();
  const agriculture = await page
    .locator(".dynamic-homepage > [data-widget]")
    .evaluateAll((ns) => ns.map((n) => n.dataset.widget));
  assert.notDeepEqual(fitness, agriculture);
  checks.push("Persona change reorders actual DOM sections");
  await page.getByLabel("Weather scenario").selectOption("storm");
  await page
    .getByRole("heading", { name: "Emergency mode", exact: true })
    .waitFor();
  assert.equal(
    await page
      .locator(".dynamic-homepage > [data-widget]")
      .first()
      .getAttribute("data-widget"),
    "safety",
  );
  assert.equal(await page.locator(".current-weather").isVisible(), false);
  await page.getByRole("button", { name: "Show full dashboard" }).click();
  assert.equal(await page.locator(".current-weather").isVisible(), true);
  await page.screenshot({ path: out + "/part1-emergency.png" });
  checks.push("Storm safety override and expandable emergency dashboard");
  await page.getByLabel("Weather scenario").selectOption("pleasant");
  await page.getByLabel("Language", { exact: true }).selectOption("hi");
  assert.equal(await page.locator("html").getAttribute("lang"), "hi");
  await page
    .getByRole("heading", { name: "मौसम जोखिम", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "मौसम से पूछें", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("textbox").fill("कल बारिश होगी?");
  await page.getByRole("button", { name: "पूछें", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /बारिश/ }).waitFor();
  await page.getByRole("button", { name: "संवाद बंद करें" }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out + "/part1-hindi.png" });
  await page.getByLabel("भाषा", { exact: true }).selectOption("en");
  checks.push("Hindi controls, risk and grounded tomorrow-rain answer");
  await page
    .getByRole("button", { name: "Accessibility", exact: true })
    .click();
  for (const label of [
    "Large text",
    "High contrast",
    "Reduced motion",
    "Strong visual warnings",
    "Screen-reader optimized mode",
    "Voice navigation",
  ])
    await page.getByLabel(label, { exact: true }).check();
  assert.equal(
    await page
      .locator("html")
      .evaluate(
        (e) =>
          e.classList.contains("highContrast") &&
          e.classList.contains("largeText"),
      ),
    true,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Ask Mausam", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Use microphone", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("dialog").getByRole("textbox").fill("open map");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await page.getByRole("heading", { name: "Weather map explorer" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  checks.push(
    "Independent accessibility controls, navigation intent and keyboard dismissal",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/part1-checks.json",
    JSON.stringify(
      {
        passed: checks,
        widths,
        errors,
        externalMap: "Mocked transport; actual Windy layers not verified",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: checks, errors }, null, 2));
} catch (e) {
  console.error(e);
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: out + "/part1-failure.png" });
    console.log((await page.locator("body").innerText()).slice(-2500));
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  api.kill();
  web.kill();
  setTimeout(() => api.kill("SIGKILL"), 1000).unref();
}
