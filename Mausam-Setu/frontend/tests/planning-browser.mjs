import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";

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
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw Error("Unavailable " + url);
}
let browser;
const checks = [],
  errors = [];
try {
  await Promise.all([
    wait("http://127.0.0.1:8000/health"),
    wait("http://127.0.0.1:5173"),
  ]);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("mausam.onboarded", "true");
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
        notifications: false,
      }),
    );
  });
  await page.goto("http://127.0.0.1:5173");
  await page.locator(".judge-toggle").click();
  await page.getByLabel("Weather scenario").selectOption("pleasant");
  await page
    .getByRole("heading", { name: "Your plans", exact: true })
    .waitFor();
  await page.getByText("Customize my plans", { exact: true }).click();
  await page.getByLabel("Duration (minutes)", { exact: true }).fill("90");
  const refreshResponse = page.waitForResponse(
    (response) => response.url().includes("/home") && response.ok(),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await refreshResponse;
  await page.waitForTimeout(150);
  if (
    (await page
      .getByLabel("Duration (minutes)", { exact: true })
      .inputValue()) !== "90"
  ) {
    throw Error("Background refresh discarded an unsaved plan");
  }
  checks.push("Unsaved planning input survives background weather refresh");
  await page.getByLabel("School drop-off", { exact: true }).fill("11:00");
  await page.getByLabel("Event start", { exact: true }).fill("17:30");
  await page.getByLabel("Crop", { exact: true }).selectOption("tomato");
  await page
    .getByLabel("Growing region", { exact: true })
    .selectOption("south_india");
  await page
    .getByLabel("Planned planting date", { exact: true })
    .fill("2026-10-01");
  await page.getByLabel("Pollen sensitivity", { exact: true }).check();
  await page
    .getByRole("button", { name: "Apply my plans", exact: true })
    .click();
  await page.getByText(/90-minute running session/).waitFor();
  await page.getByText(/Within the sourced calendar/).waitFor();
  await page.locator(".comfort").first().waitFor();
  await page
    .locator(".planning-panel > .plan-grid")
    .screenshot({ path: out + "/16-planning-results.png" });
  checks.push(
    "Activity duration, sensitivities, school times, event comfort and sourced planting preferences apply",
  );
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mausam.profile")),
  );
  if (
    stored.planning.duration_minutes !== 90 ||
    stored.planning.school_dropoff !== "11:00"
  )
    throw Error("Preferences not saved");
  checks.push("Planning preferences persist on device");
  await page.getByText("Journey & airport weather", { exact: true }).click();
  await page
    .getByRole("button", { name: "Check journey", exact: true })
    .click();
  await page.getByText(/Simulated route totals/).waitFor();
  checks.push("Journey endpoint forecasts and explicit simulated traffic");
  await page.getByLabel("Journey type").selectOption("flight");
  if (await page.getByText(/Simulated route totals/).count())
    throw Error("Stale result after edit");
  await page
    .getByRole("button", { name: "Check journey", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Departure airport", exact: true })
    .waitFor();
  checks.push(
    "Flight planner handles missing airport data and clears stale results",
  );
  await page.getByText("High & low tides", { exact: true }).click();
  await page.getByRole("button", { name: "Check tides", exact: true }).click();
  await page.locator(".tide-list").waitFor();
  checks.push("Tide demo timetable is functional and labelled");
  await page.screenshot({
    path: out + "/14-planning-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    )
  )
    throw Error("Mobile overflow");
  await page.locator("#plans").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: out + "/15-planning-mobile.png",
    fullPage: true,
  });
  await page.addStyleTag({ content: "html{font-size:200%!important}" });
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    )
  ) {
    console.log(
      await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            text: e.textContent.slice(0, 70),
            right: e.getBoundingClientRect().right,
          }))
          .slice(0, 25),
      ),
    );
    await page.screenshot({ path: out + "/planning-overflow.png" });
    throw Error("200% mobile overflow");
  }
  checks.push(
    "Expanded planning, journey and tide sections fit 390px and 200% text",
  );
  if (errors.length) throw Error(errors.join("\n"));
  fs.writeFileSync(
    out + "/planning-checks.json",
    JSON.stringify({ passed: checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: checks, errors }, null, 2));
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  api.kill();
  web.kill();
}
